/**
 * dsh-assistant-panel — 提示词组装引擎（docs/ARCHITECTURE.md §4）。
 *
 * 固定管线：系统模板 → 变量替换 → 注入块 → 世界书匹配 → skill 说明
 *          → 记忆注入 → 时间间隔提醒 → 历史截断 → 组装 messages → ctx.llm.stream
 *
 * 变量语法：{{name}} 与 {name} 双语法，customVariables 覆盖同名内置变量。
 * 替换对象：系统提示词模板、注入块 content、世界书 content、记忆文本。
 */

import type { Context } from 'cordis'
import {
  createAssistantMessage,
  createUserMessage,
  createMessage,
  type Message,
  type LlmResolvedModelInfo,
} from '@deepseek-ai/dsh-llm'
import type {
  AssistantConfig,
  ChatMessage,
  InjectionBlock,
  WorldbookEntry,
} from './shared/types.ts'
import { detectUserName } from './store.ts'

/** 世界书 token 预算（超预算条目从低优先级截断丢弃）。 */
export const WB_TOKEN_BUDGET = 1024
/** 记忆检索：最近取多少条候选。 */
const MEMORY_CANDIDATES = 50
/** 最终注入的记忆条数。 */
const MEMORY_TOP = 5
/** 会话摘要截断长度（useChatHistory=true 时）。 */
const CHAT_SUMMARY_MAX = 200

/** 宿主运行时上下文（由 index.ts 组装注入）。 */
export interface RuntimeContext {
  ctx: Context
  /** 插件设置解析出的 profile（userName/locale/timezone/dataDir）。 */
  profile: {
    userName: string
    locale: string
    timezone: string
    dataDir: string
  }
  /** 最近一次主模型路由（llm/stream waterfall 捕获；可能为 null）。 */
  lastRoute: { provider: string; model: string } | null
  /** 当前会话的主模型路由解析（provider/model 空值时的兜底）。 */
  defaultRoute: { provider: string; model: string }
}

/** 变量替换所需的运行时信息。 */
export interface TemplateVariablesInput {
  runtime: RuntimeContext
  assistant: AssistantConfig
  modelInfo: LlmResolvedModelInfo | null
  chatCount: number
  /** 基准时间戳（默认 Date.now()）。 */
  ts?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 变量表
// ─────────────────────────────────────────────────────────────────────────────

/** 格式化本地日期（YYYY-MM-DD）。 */
function formatDate(ts: number, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(ts)
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    return new Date(ts).toISOString().slice(0, 10)
  }
}

/** 格式化本地时间（HH:MM）。 */
function formatTime(ts: number, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(ts)
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    return `${get('hour')}:${get('minute')}`
  } catch {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}

/** 解析时区：设置优先 → 系统 Intl。 */
export function resolveTimezone(setting: string): string {
  if (setting && setting.trim() !== '') return setting
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

/** 获取工作区标题（未绑定/不存在返回空串）。 */
function workspaceTitle(ctx: Context, workspaceId: string): string {
  if (!workspaceId) return ''
  try {
    const registry = (ctx as unknown as { workspaceRegistry?: { get(id: string): { title: string } | undefined } }).workspaceRegistry
    return registry?.get(workspaceId)?.title ?? ''
  } catch {
    return ''
  }
}

/** 构建变量表（含 customVariables 覆盖）。 */
export function buildVariableTable(input: TemplateVariablesInput): Record<string, string> {
  const { runtime, assistant, modelInfo, chatCount, ts } = input
  const { ctx, profile, lastRoute, defaultRoute } = runtime
  const now = ts ?? Date.now()
  const timezone = resolveTimezone(profile.timezone)
  const locale = profile.locale || 'zh'
  const modelProvider = assistant.modelParams.provider ?? lastRoute?.provider ?? defaultRoute.provider
  const model = assistant.modelParams.model || lastRoute?.model || defaultRoute.model
  const modelName = modelInfo?.name ?? (model || modelProvider)
  const vars: Record<string, string> = {
    cur_date: formatDate(now, timezone),
    cur_time: formatTime(now, timezone),
    cur_datetime: `${formatDate(now, timezone)} ${formatTime(now, timezone)}`,
    model_id: model || '',
    model_name: modelName || model || '',
    timezone,
    locale,
    user_name: profile.userName || detectUserName(),
    assistant_name: assistant.profile.name,
    assistant_tags: assistant.profile.tags.join(', '),
    workspace: workspaceTitle(ctx, assistant.profile.workspace),
    chat_count: String(chatCount),
  }
  // customVariables 覆盖内置变量
  const custom = assistant.systemPrompt.customVariables ?? {}
  for (const [k, v] of Object.entries(custom)) {
    vars[k] = v
  }
  return vars
}

/**
 * 模板替换：{{name}} 与 {name} 双语法单遍替换。
 * 未识别的占位符原样保留。
 */
export function resolveTemplate(template: string, vars: Record<string, string>): string {
  if (!template) return ''
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, name: string) => {
    return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m
  }).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, name: string) => {
    return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 世界书 / 注入匹配
// ─────────────────────────────────────────────────────────────────────────────

/** 大小写不敏感子串匹配：任一 keyword 命中 text 即 true。 */
export function matchKeywords(keywords: string[], text: string): boolean {
  const lower = text.toLowerCase()
  return keywords.some(kw => kw && lower.includes(kw.toLowerCase()))
}

/** 粗估文本 token 数（汉字/词近似）。 */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) ?? []).length
  const rest = text.replace(/[\u4e00-\u9fff\u3040-\u30ff]/g, ' ')
  const words = rest.split(/\s+/).filter(Boolean).length
  return cjk + Math.ceil(words * 1.3)
}

/** 世界书命中 + 排序 + token 预算截断。 */
export function matchWorldbook(entries: WorldbookEntry[], historyText: string): WorldbookEntry[] {
  const hit = entries.filter((e) => e.enabled && matchKeywords(e.keys, historyText))
  hit.sort((a, b) => b.priority - a.priority)
  let budget = WB_TOKEN_BUDGET
  const kept: WorldbookEntry[] = []
  for (const entry of hit) {
    const cost = estimateTokens(entry.content)
    if (cost > budget) continue
    kept.push(entry)
    budget -= cost
  }
  return kept
}

// ─────────────────────────────────────────────────────────────────────────────
// 组装结果
// ─────────────────────────────────────────────────────────────────────────────

export interface AssembledPayload {
  /** 系统提示词文本（system 参数）。 */
  system: string
  /** 模型可见消息（含注入/世界书 system 消息与最后的新 user 消息）。 */
  messages: Message[]
  /** 世界书命中的条目（供引用）。 */
  worldbookHits: WorldbookEntry[]
  /** 是否插入了时间提醒。 */
  gapReminderInserted: boolean
}

export interface BuildPayloadOptions {
  assistant: AssistantConfig
  /** 原始（未截断）历史消息。 */
  history: ChatMessage[]
  /** 本条请求的新 user 消息。 */
  newUserMessage: ChatMessage
  /** 最近一条 user 消息的时间戳（用于时间提醒；null = 无历史）。 */
  lastUserTs: number | null
  /** 宿主运行时。 */
  runtime: RuntimeContext
  /** 当前模型信息（用于变量表）。 */
  modelInfo: LlmResolvedModelInfo | null
  /** 记忆池条目（预取后传入）。 */
  memories: Array<{ id: string; content: string; ts: number; tags?: string[] }>
}

/**
 * 组装一次聊天的完整 payload。
 * history 为原始（未截断）历史；truncation 在最后做。
 */
export function buildPayload(opts: BuildPayloadOptions): AssembledPayload {
  const { assistant, history, newUserMessage, lastUserTs, runtime, modelInfo, memories } = opts
  const vars = buildVariableTable({
    runtime,
    assistant,
    modelInfo,
    chatCount: history.length,
    ts: newUserMessage.ts,
  })

  // ── ① 系统提示词模板 + ② 变量替换 ──
  const template = resolveTemplate(assistant.systemPrompt.template, vars)

  // ── ③ 注入块（role='system' 并入系统段）──
  const systemInjections: InjectionBlock[] = assistant.injections.filter(
    (inj) => inj.enabled && inj.role === 'system',
  )
  const beforeParts = systemInjections.filter(i => i.position === 'before')
  const afterParts = systemInjections.filter(i => i.position === 'after')
  const replaceParts = systemInjections.filter(i => i.position === 'replace')

  const renderParts = (blocks: InjectionBlock[], triggerHistory: string): InjectionBlock[] => {
    return blocks.filter((b) => {
      if (b.trigger === 'always') return true
      return matchKeywords(b.keywords, triggerHistory)
    })
  }
  const triggerText = history.map((m) => m.content).join('\n')
  const renderedBefore = renderParts(beforeParts, triggerText).map((b) => resolveTemplate(b.content, vars))
  const renderedAfter = renderParts(afterParts, triggerText).map((b) => resolveTemplate(b.content, vars))
  const renderedReplace = renderParts(replaceParts, triggerText).map((b) => resolveTemplate(b.content, vars))

  let systemParts: string[]
  if (renderedReplace.length > 0) {
    // replace：替换模板段（模板内容丢弃）
    systemParts = [...renderedReplace]
  } else {
    systemParts = [...renderedBefore, template, ...renderedAfter]
  }

  // ── ⑤ skill 说明 ──
  const enabledSkills = assistant.skills.filter((s) => s.enabled)
  if (enabledSkills.length > 0) {
    const lines = enabledSkills.map((s) => `- ${s.name}: ${s.description}`)
    systemParts.push('[可用技能]\n' + lines.join('\n'))
  }

  // ── ⑥ 记忆注入 ──
  if (assistant.memory.enabled && memories.length > 0) {
    // 简单打分：与最近 user 消息关键词交集 + 时间衰减，取 top MEMORY_TOP
    const recentUserText = newUserMessage.content
    const scored = memories
      .map((m) => {
        const kw = m.content.toLowerCase().split(/[\s，。！？、,.;:！]+/).filter(w => w.length >= 2)
        const overlap = kw.filter(w => recentUserText.toLowerCase().includes(w)).length
        const ageHours = (Date.now() - m.ts) / 3_600_000
        const decay = Math.max(0, 1 - ageHours / (24 * 30))
        return { entry: m, score: overlap * 2 + decay }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MEMORY_TOP)
    const memoryText = scored.map(({ entry }) => resolveTemplate(entry.content, vars)).join('\n')
    systemParts.push('[记忆]\n' + memoryText)
  }

  // ── ⑥b 参考聊天摘要（useChatHistory=true）──
  if (assistant.memory.enabled && assistant.memory.useChatHistory) {
    const firstUser = history.find((m) => m.role === 'user')
    if (firstUser) {
      const summary = firstUser.content.length > CHAT_SUMMARY_MAX
        ? firstUser.content.slice(0, CHAT_SUMMARY_MAX) + '…'
        : firstUser.content
      systemParts.push('[最近会话参考]\n' + summary)
    }
  }

  const system = systemParts.filter((s) => s !== '').join('\n\n')

  // ── ⑧ 历史截断 ──
  const truncated = truncateHistory(history, assistant.modelParams.contextLimit)

  // ── ③b 注入块（role='user'/'assistant'）：围绕新 user 消息 ──
  const userInjections = assistant.injections.filter(i => i.enabled && i.role === 'user')
  const assistantInjections = assistant.injections.filter(i => i.enabled && i.role === 'assistant')
  const renderRoleBefore = (kind: 'user' | 'assistant'): string[] => {
    const list = (kind === 'user' ? userInjections : assistantInjections).filter(i => i.position === 'before')
    return renderParts(list, triggerText).map(b => resolveTemplate(b.content, vars))
  }
  const renderRoleAfter = (kind: 'user' | 'assistant'): string[] => {
    const list = (kind === 'user' ? userInjections : assistantInjections).filter(i => i.position === 'after')
    return renderParts(list, triggerText).map(b => resolveTemplate(b.content, vars))
  }
  const merge = (parts: string[]): string => parts.join('\n')

  // ── ④ 世界书 ──
  const historyText = [...truncated, newUserMessage].map(m => m.content).join('\n')
  const worldbookHits = matchWorldbook(assistant.worldbook, historyText)
  const wbBefore = resolveTemplate(
    worldbookHits.filter(w => w.position === 'before').map(w => w.content).join('\n\n'),
    vars,
  )
  const wbAfter = resolveTemplate(
    worldbookHits.filter(w => w.position === 'after').map(w => w.content).join('\n\n'),
    vars,
  )

  // ── ⑦ 时间间隔提醒 ──
  let gapReminderInserted = false
  let gapReminderText = ''
  const gapMinutes = assistant.memory.gapReminderMinutes
  if (assistant.memory.enabled && gapMinutes !== null && gapMinutes > 0 && lastUserTs !== null) {
    const gapMs = newUserMessage.ts - lastUserTs
    const threshold = gapMinutes * 60_000
    if (gapMs >= threshold) {
      const mins = Math.floor(gapMs / 60_000)
      const gap = mins >= 60
        ? `${Math.floor(mins / 60)} 小时 ${mins % 60} 分`
        : `${mins} 分钟`
      const timezone = resolveTimezone(runtime.profile.timezone)
      const localtime = formatTime(newUserMessage.ts, timezone)
      gapReminderText = `[时间提醒] 距上一次交流已过去 ${gap}。现在是 ${localtime}。请结合当前时间来作答。`
      gapReminderInserted = true
    }
  }

  // ── 组装最终 messages ──
  const messages: Message[] = []
  // 历史
  for (const h of truncated) {
    messages.push(toModelMessage(h))
  }

  // 新 user 消息之前的注入/世界书/时间提醒
  const beforeText = merge(renderRoleBefore('user'))
  const beforeAssistantText = merge(renderRoleBefore('assistant'))
  if (beforeText) {
    messages.push(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: beforeText }] }))
  }
  if (beforeAssistantText) {
    messages.push(createAssistantMessage({ content: [{ type: 'text', text: beforeAssistantText }], source: { provider: '', model: '' } }))
  }
  if (wbBefore) {
    messages.push(createSystemMessage(wbBefore))
  }
  if (gapReminderText) {
    messages.push(createSystemMessage(gapReminderText))
  }

  // 新 user 消息
  messages.push(createUserMessage({
    source: { kind: 'user' },
    content: [{ type: 'text', text: newUserMessage.content }],
  }))

  // 新 user 消息之后的注入/世界书
  if (wbAfter) messages.push(createSystemMessage(wbAfter))
  const afterAssistantText = merge(renderRoleAfter('assistant'))
  if (afterAssistantText) {
    messages.push(createAssistantMessage({ content: [{ type: 'text', text: afterAssistantText }], source: { provider: '', model: '' } }))
  }
  const afterUserText = merge(renderRoleAfter('user'))
  if (afterUserText) {
    messages.push(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: afterUserText }] }))
  }

  return { system, messages, worldbookHits, gapReminderInserted }
}

/** 构造一条 system-role 消息（plugin 来源）。 */
function createSystemMessage(text: string): Message {
  return createMessage({
    role: 'system',
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: '@dsh-external/dsh-assistant-panel' },
  })
}

/** 历史截断：取最近 N 条（0=全部）；不以 assistant 开头以保证 pair 完整性。 */
export function truncateHistory(history: ChatMessage[], contextLimit: number): ChatMessage[] {
  let out = history
  if (contextLimit !== 0 && history.length > contextLimit) {
    out = history.slice(-contextLimit)
  }
  while (out.length > 0 && out[0].role === 'assistant') out = out.slice(1)
  return out
}

/** ChatMessage → dsh-llm Message。 */
export function toModelMessage(msg: ChatMessage): Message {
  if (msg.role === 'user') {
    return createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: msg.content }] })
  }
  if (msg.role === 'assistant') {
    return createAssistantMessage({ content: [{ type: 'text', text: msg.content }], source: { provider: '', model: '' } })
  }
  return createSystemMessage(msg.content)
}
