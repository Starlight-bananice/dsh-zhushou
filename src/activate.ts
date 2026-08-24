/**
 * dsh-assistant-panel — 激活管线（会话级助手 → 主会话 llm/stream 请求重建）。
 *
 * 纠偏改造（docs/ARCHITECTURE-ACTIVATION.md §2/§3）：
 *  - 旧 chat.ts buildPayload 的「chat 历史数组」输入换成「主会话 llm/stream 请求」；
 *  - 时间提醒（gapReminderMinutes / [时间提醒] 消息）整体移除，改为**时间感知开关**
 *    timeAwareness：开 → system 末尾追加一行自然时间上下文（无命令式口吻）；
 *  - 变量表增补 {{last_chat_time}} / {{elapsed_since_last}}（数据源 = selection.lastChatTs）。
 *
 * 用法（index.ts llm/stream 拦截器）：options.purpose===undefined &&
 * selection 命中时 rebuildActivatedRequest(options, ...)，短路返回 ctx.llm.stream(rebuilt)。
 */

import {
  ReasoningEffortId,
  createAssistantMessage,
  createUserMessage,
  deepFreeze,
  type GenerateOptions,
  type LlmResolvedModelInfo,
  type Message,
} from '@deepseek-ai/dsh-llm'
import type { AssistantConfig, InjectionBlock } from './shared/types.ts'
import {
  buildVariableTable,
  matchKeywords,
  matchWorldbook,
  resolveTemplate,
  resolveTimezone,
  formatTime,
  type RuntimeContext,
} from './prompt.ts'

// ─────────────────────────────────────────────────────────────────────────────
// 常量（记忆检索与摘要）
// ─────────────────────────────────────────────────────────────────────────────

/** 记忆检索：最近取多少条候选。 */
const MEMORY_CANDIDATES = 50
/** 最终注入的记忆条数。 */
const MEMORY_TOP = 5
/** 会话摘要截断长度（useChatHistory=true 时）。 */
const CHAT_SUMMARY_MAX = 200

/** 记忆池候选条目（MemoryStore.recent 返回形状）。 */
export interface MemoryCandidate {
  id: string
  content: string
  ts: number
  tags?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// 时间感知：变量 + 间隔
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 人类可读间隔（距上次对话）。语义：刚刚 / N 分钟 / N 小时 M 分钟 / N 天 / N 个月 / N 年。
 */
export function formatElapsed(from: number, now: number): string {
  const diff = Math.max(0, now - from)
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟`
  if (diff < day) {
    const h = Math.floor(diff / hour)
    const m = Math.floor((diff % hour) / minute)
    return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
  }
  const d = Math.floor(diff / day)
  if (d < 30) return `${d} 天`
  const mo = Math.floor(diff / (30 * day))
  if (mo < 12) return `${mo} 个月`
  return `${Math.floor(diff / (365 * day))} 年`
}

/** 时间感知自然上下文行模板（无 [时间提醒] 前缀、无命令式口吻）。 */
const TIME_AWARENESS_LINE = '（当前时间：{{cur_datetime}}；用户上次对话：{{last_chat_time}}（约 {{elapsed_since_last}} 前））'

// ─────────────────────────────────────────────────────────────────────────────
// 变量表扩展
// ─────────────────────────────────────────────────────────────────────────────

export interface ActivationVariablesInput {
  runtime: RuntimeContext
  assistant: AssistantConfig
  lastChatTs: number | null
  /** 请求消息（chat_count 来源）。 */
  messages: Message[]
  modelInfo?: LlmResolvedModelInfo | null
  /** 基准时间（默认 Date.now()）。 */
  ts?: number
}

/**
 * 构建激活变量表 = 内置变量表 + {{last_chat_time}}/{{elapsed_since_last}}。
 * lastChatTs 为 null → 两变量均为 '未知'。
 */
export function buildActivationVars(input: ActivationVariablesInput): Record<string, string> {
  const { runtime, assistant, lastChatTs, messages, modelInfo, ts } = input
  const now = ts ?? Date.now()
  const vars = buildVariableTable({
    runtime,
    assistant,
    modelInfo: modelInfo ?? null,
    chatCount: messages.length,
    ts: now,
  })
  if (lastChatTs !== null) {
    const timezone = resolveTimezone(runtime.profile.timezone)
    vars.last_chat_time = formatTime(lastChatTs, timezone)
    vars.elapsed_since_last = formatElapsed(lastChatTs, now)
  } else {
    vars.last_chat_time = '未知'
    vars.elapsed_since_last = '未知'
  }
  return vars
}

// ─────────────────────────────────────────────────────────────────────────────
// assembleAssistantContext：组装要追加到 options.system 的整段文本
// ─────────────────────────────────────────────────────────────────────────────

export interface AssembleContextOptions {
  /** 请求消息（关键词触发 / chat_count / 首条 user 摘要）。 */
  messages?: Message[]
  /** 记忆池候选（最近 MEMORY_CANDIDATES 条；缺省不注入记忆段）。 */
  memories?: MemoryCandidate[]
  modelInfo?: LlmResolvedModelInfo | null
  /** 基准时间（默认 Date.now()）。 */
  ts?: number
}

/**
 * 组装助手激活上下文（追加到 options.system 的整段文本）。
 *
 * 段顺序（非空段 join('\n\n')）：
 *   ① 系统提示词模板（{{var}}/{var} 双语法，customVariables 覆盖）
 *   ② system 注入块（role='system'：before/after/replace 语义；trigger=keywords 对最近消息匹配）
 *   ③ skill 说明（enabled → "- name: description" 行）
 *   ④ 记忆段（global/private 池；关键词交集 + 时间衰减打分 → top 5；useChatHistory 附首条 user 摘要）
 *   ⑤ 世界书 system 合并段（命中按 priority 降序 → WB_TOKEN_BUDGET 截断 → 合并）
 *   ⑥ 时间感知行（assistant.memory.timeAwareness 开才追加；关 = 无此行）
 */
export function assembleAssistantContext(
  assistant: AssistantConfig,
  runtime: RuntimeContext,
  lastChatTs: number | null,
  opts: AssembleContextOptions = {},
): string {
  const { messages = [], memories = [], modelInfo, ts } = opts
  const now = ts ?? Date.now()
  const vars = buildActivationVars({ runtime, assistant, lastChatTs, messages, modelInfo, ts: now })

  // ── ① 系统提示词模板 ──
  const template = resolveTemplate(assistant.systemPrompt.template, vars)

  // ── ② system 注入块（before/after/replace）──
  const systemInjections = assistant.injections.filter(i => i.enabled && i.role === 'system')
  const triggerText = messagesText(messages)
  const renderParts = (blocks: InjectionBlock[]): string[] => {
    return blocks
      .filter((b) => b.trigger === 'always' || matchKeywords(b.keywords, triggerText))
      .map((b) => resolveTemplate(b.content, vars))
      .filter((t) => t !== '')
  }
  const beforeParts = renderParts(systemInjections.filter(i => i.position === 'before'))
  const afterParts = renderParts(systemInjections.filter(i => i.position === 'after'))
  const replaceParts = renderParts(systemInjections.filter(i => i.position === 'replace'))

  let systemParts: string[]
  if (replaceParts.length > 0) {
    systemParts = [...replaceParts] // replace：替换模板段
  } else {
    systemParts = [...beforeParts, template, ...afterParts]
  }

  // ── ③ skill 说明 ──
  const enabledSkills = assistant.skills.filter(s => s.enabled)
  if (enabledSkills.length > 0) {
    const lines = enabledSkills.map(s => `- ${s.name}: ${s.description}`)
    systemParts.push('[可用技能]\n' + lines.join('\n'))
  }

  // ── ④ 记忆段（打分 + 摘要）──
  if (assistant.memory.enabled && memories.length > 0) {
    const anchor = latestUserMessage(messages)
    const recentUserText = anchor ? messageText(anchor) : ''
    const scored = memories
      .map((m) => {
        const kw = m.content.toLowerCase().split(/[\s，。！？、,.;:！]+/).filter(w => w.length >= 2)
        const overlap = kw.filter(w => recentUserText.toLowerCase().includes(w)).length
        const ageHours = (now - m.ts) / 3_600_000
        const decay = Math.max(0, 1 - ageHours / (24 * 30))
        return { entry: m, score: overlap * 2 + decay }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MEMORY_TOP)
    const memoryText = scored.map(({ entry }) => resolveTemplate(entry.content, vars)).join('\n')
    systemParts.push('[记忆]\n' + memoryText)
  }

  // ④b 参考聊天摘要（useChatHistory=true；与记忆池条数无关）
  if (assistant.memory.enabled && assistant.memory.useChatHistory) {
    const firstUser = messages.find(m => m.role === 'user' && m.source.kind === 'user')
    if (firstUser) {
      const text = messageText(firstUser)
      const summary = text.length > CHAT_SUMMARY_MAX ? text.slice(0, CHAT_SUMMARY_MAX) + '…' : text
      systemParts.push('[最近会话参考]\n' + summary)
    }
  }

  // ── ⑤ 世界书 system 合并段 ──
  const worldbookHits = matchWorldbook(assistant.worldbook, triggerText)
  if (worldbookHits.length > 0) {
    const wbText = resolveTemplate(
      worldbookHits.map(w => w.content).join('\n\n'),
      vars,
    )
    if (wbText) systemParts.push('[世界书]\n' + wbText)
  }

  // ── ⑥ 时间感知行 ──
  if (assistant.memory.timeAwareness) {
    systemParts.push(resolveTemplate(TIME_AWARENESS_LINE, vars))
  }

  return systemParts.filter(s => s !== '').join('\n\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// 消息工具（dsh-llm Message[]）
// ─────────────────────────────────────────────────────────────────────────────

/** 取消息文本（text 块拼接；tool-call/tool-result 等非文本块忽略）。 */
export function messageText(msg: Message): string {
  const out: string[] = []
  for (const block of msg.content) {
    if (block.type === 'text') out.push(block.text)
  }
  return out.join('\n')
}

/** 全部消息拼接文本（关键词触发 / 世界书匹配用）。 */
export function messagesText(messages: Message[]): string {
  return messages.map(messageText).join('\n')
}

/** 最近一条 role==='user' 且 source.kind==='user'（人类输入）的消息；无则回退最近一条 role==='user'。 */
export function latestUserMessage(messages: Message[]): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user' && m.source.kind === 'user') return m
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i]
  }
  return undefined
}

/** 消息是否携带 tool-call 内容块（tool-call pair 约束判定）。 */
function hasToolCall(msg: Message | undefined): boolean {
  return msg !== undefined && msg.content.some(b => b.type === 'tool-call')
}

/**
 * 截断：取最近 N 条（0 = 全部）。pair 完整性：首条为 assistant（其 user 被裁掉）
 * 或 tool-result（其 tool-call assistant 被裁掉）时继续前移。
 */
export function truncateMessages(messages: Message[], contextLimit: number): Message[] {
  let out = messages
  if (contextLimit !== 0 && messages.length > contextLimit) {
    out = messages.slice(-contextLimit)
  }
  while (out.length > 0) {
    const first = out[0]
    if (first.role === 'assistant') { out = out.slice(1); continue }
    if (first.role === 'user' && first.source.kind === 'tool') { out = out.slice(1); continue }
    break
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 注入 + 重组 messages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 在截断后的消息流中注入 user/assistant 注入块（围绕最近一条用户消息；同 role 同位置
 * 多条合并为一条）。遵守 tool-call pair 约束：绝不插到「user 消息与其后紧跟 tool-call
 * 的 assistant 消息」之间。时间上下文（时间感知行）不插消息（只在 system 里）。
 *
 * @returns 新消息数组（注入后；长度可能与输入不同）
 */
export function injectMessages(
  assistant: AssistantConfig,
  messages: Message[],
  vars: Record<string, string>,
): Message[] {
  const anchorIdx = indexOfLatestUserMessage(messages)
  if (anchorIdx < 0) return messages // 无 user 消息 → 不注入

  const triggerText = messagesText(messages)
  const render = (blocks: InjectionBlock[]): string => {
    return resolveTemplate(
      blocks
        .filter((b) => b.enabled && (b.trigger === 'always' || matchKeywords(b.keywords, triggerText)))
        .map((b) => b.content)
        .join('\n'),
      vars,
    )
  }

  const userBefore = render(assistant.injections.filter(i => i.role === 'user' && i.position === 'before'))
  const userAfter = render(assistant.injections.filter(i => i.role === 'user' && i.position === 'after'))
  const asstBefore = render(assistant.injections.filter(i => i.role === 'assistant' && i.position === 'before'))
  const asstAfter = render(assistant.injections.filter(i => i.role === 'assistant' && i.position === 'after'))

  // tool-call pair 约束：anchor 后紧跟含 tool-call 的 assistant → after 注入挪到该 assistant 之后
  const nextAfterAnchor = messages[anchorIdx + 1]
  const pairBlocked = hasToolCall(nextAfterAnchor) && messages[anchorIdx + 1]?.role === 'assistant'
  const afterInsertPos = pairBlocked ? anchorIdx + 2 : anchorIdx + 1

  const out: Message[] = []
  // 前段
  out.push(...messages.slice(0, anchorIdx))
  // before 注入（用户消息先、assistant 消息后，与旧 buildPayload 顺序一致）
  if (userBefore) {
    out.push(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: userBefore }] }))
  }
  if (asstBefore) {
    out.push(createAssistantMessage({ content: [{ type: 'text', text: asstBefore }], source: { provider: '', model: '' } }))
  }
  // anchor（最近用户消息）
  out.push(messages[anchorIdx])
  // 中间（tool-call assistant，若 pair 被挡）
  out.push(...messages.slice(anchorIdx + 1, afterInsertPos))
  // after 注入（assistant 消息先、user 消息后，与旧 buildPayload 顺序一致）
  if (asstAfter) {
    out.push(createAssistantMessage({ content: [{ type: 'text', text: asstAfter }], source: { provider: '', model: '' } }))
  }
  if (userAfter) {
    out.push(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: userAfter }] }))
  }
  // 后段
  out.push(...messages.slice(afterInsertPos))
  return out
}

/** 最近一条人类 user 消息下标（回退最近 role==='user'）。 */
function indexOfLatestUserMessage(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && messages[i].source.kind === 'user') return i
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return i
  }
  return -1
}

// ─────────────────────────────────────────────────────────────────────────────
// rebuildActivatedRequest：完整请求重建
// ─────────────────────────────────────────────────────────────────────────────

export interface RebuildActivatedRequestOptions {
  /** 原始主会话请求（deepFrozen；只读，不原地改）。 */
  options: GenerateOptions
  assistant: AssistantConfig
  runtime: RuntimeContext
  /** selection.lastChatTs（时间感知数据源；null = 未知）。 */
  lastChatTs: number | null
  /** 记忆池候选（最近 50 条；调用方从 MemoryStore.recent 预取）。 */
  memories: MemoryCandidate[]
  /** 基准时间（默认 Date.now()）。 */
  ts?: number
}

/**
 * 重建主会话请求（激活管线核心）。
 *
 * 变更点（docs/ARCHITECTURE-ACTIVATION.md §2.2–§2.5）：
 *  - 模型覆盖：provider && model 均非空才覆盖；reasoningEffort auto→省略 /
 *    medium→low / off|low|high|max→原样；temperature===1.0 不覆盖；maxTokens null 不传；topP 不传；
 *  - system：options.system + '\n\n' + assembleAssistantContext(...)（options.system 恒有值的主会话；
 *    context 为空时保持原 system）；
 *  - messages：截断（contextLimit，pair 完整）+ user/assistant 注入块（时间上下文不插消息）；
 *  - 返回 deepFrozen 的新对象（不标记 isAgentLoopRequest——invariant 对重入请求放行）。
 */
export function rebuildActivatedRequest(opts: RebuildActivatedRequestOptions): GenerateOptions {
  const { options, assistant, runtime, lastChatTs, memories, ts } = opts
  const now = ts ?? Date.now()
  const mp = assistant.modelParams

  // 时间感知行 + 注入需要的变量表（一次构建复用）
  const vars = buildActivationVars({
    runtime,
    assistant,
    lastChatTs,
    messages: options.messages ?? [],
    ts: now,
  })

  // e. system 追加
  const context = assembleAssistantContext(assistant, runtime, lastChatTs, {
    messages: options.messages ?? [],
    memories,
    ts: now,
  })
  const baseSystem = options.system ?? ''
  const system = context !== ''
    ? (baseSystem !== '' ? baseSystem + '\n\n' + context : context)
    : baseSystem

  // f. messages 注入与 contextLimit 截断（保留 pair；时间上下文不插消息）
  const truncated = truncateMessages(options.messages ?? [], mp.contextLimit)
  const messages = injectMessages(assistant, truncated, vars)

  // d. 模型覆盖
  const rebuilt: GenerateOptions = {
    ...options,
    ...(mp.provider && mp.model ? { provider: mp.provider, model: mp.model } : {}),
    ...(mp.temperature !== 1.0 ? { temperature: mp.temperature } : {}),
    ...(mp.reasoningEffort !== 'auto'
      ? { reasoningEffort: ReasoningEffortId(mp.reasoningEffort === 'medium' ? 'low' : mp.reasoningEffort) }
      : {}),
    ...(mp.maxTokens !== null ? { maxTokens: mp.maxTokens } : {}),
    system,
    messages,
  }
  return deepFreeze(rebuilt)
}

/** 记忆候选常量导出（index.ts 预取用）。 */
export { MEMORY_CANDIDATES }
