/**
 * dsh-assistant-panel — LLM 代理（chat.ts）。
 *
 * 职责：
 *  - 组装 GenerateOptions（provider/model/system/messages/temperature/reasoningEffort/maxTokens）；
 *  - 把 ctx.llm.stream() 的 StreamChunk 转发为 SSE（text-delta / reasoning-delta / done / error），
 *    POST /api/chat 走 fetch + ReadableStream（EventSource 不支持 POST）；
 *  - stream=false 时聚合后一次返回（仍走 SSE 协议，单条 text-delta + done）；
 *  - 会话落库：user + assistant 消息按 ts 写入 chats/<chatId>.jsonl。
 *
 * 模型路由：assistant.modelParams.provider/model 为空 → 用 lastRoute（主模型 waterfall 捕获）→ 兜底 defaultRoute。
 * reasoningEffort：'auto' 不传该字段让服务端自决；'medium' 就近映射为 'low'（ARCHITECTURE 决策 2）。
 * topP：设置保留但暂不传递给 stream（ARCHITECTURE 决策 1）。
 */

import type { ServerResponse } from 'node:http'
import { ReasoningEffortId, createAssistantMessage, type Message } from '@deepseek-ai/dsh-llm'
import type LlmRuntime from '@deepseek-ai/dsh-llm'
import type { ChatRequest } from './shared/contracts.ts'
import type { AssistantConfig, ChatId, ChatMessage, ChatSession } from './shared/types.ts'
import { uid } from './store.ts'
import { buildPayload, type RuntimeContext } from './prompt.ts'
import type { AssistantStore, ChatStore, MemoryStore } from './store.ts'

/** SSE 事件 payload（与 contracts.ts 的 ChatEvent 对齐的子集 + 运行期补充）。 */
export type ChatSsePayload =
  | { type: 'connected'; chatId: ChatId; assistantId: string }
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'done'; message: ChatMessage }
  | { type: 'error'; code: string; message: string }

export interface ChatDeps {
  llm: LlmRuntime
  assistants: AssistantStore
  chats: ChatStore
  memory: MemoryStore
  runtime: RuntimeContext
}

/** 写入一条 SSE 数据帧（event + data 双行）。 */
export function sseData(res: ServerResponse, payload: ChatSsePayload): void {
  res.write('event: ' + payload.type + '\n')
  res.write('data: ' + JSON.stringify(payload) + '\n\n')
}

/** 解析后的聊天请求上下文。 */
interface PreparedChat {
  assistant: AssistantConfig
  chatId: ChatId
  history: ChatMessage[]
  newUserMessage: ChatMessage
}

/** 准备聊天：解析助手、确定会话、构造新 user 消息。抛错带 message。 */
function prepareChat(body: ChatRequest, deps: ChatDeps): PreparedChat {
  const assistant = deps.assistants.get(body.assistantId)
  if (!assistant) throw new Error('assistant-not-found')
  const newUserMessage: ChatMessage = {
    id: uid('msg') as ChatMessage['id'],
    role: 'user',
    content: body.message,
    ts: Date.now(),
  }
  let chatId: ChatId = body.chatId ?? ('' as ChatId)
  let history: ChatMessage[] = []
  if (body.chatId) {
    const session: ChatSession | undefined = deps.chats.get(body.chatId)
    if (!session) throw new Error('chat-not-found')
    chatId = session.id
    history = session.messages
  } else {
    chatId = deps.chats.createChat(body.assistantId)
  }
  return { assistant, chatId, history, newUserMessage }
}

/** 解析模型路由：档案 provider/model 优先，空值回退 lastRoute → defaultRoute。 */
export function resolveRoute(assistant: AssistantConfig, runtime: RuntimeContext): { provider: string; model: string } {
  const p = assistant.modelParams.provider
  const m = assistant.modelParams.model
  if (p && m) return { provider: p, model: m }
  if (p) return { provider: p, model: runtime.lastRoute?.model ?? runtime.defaultRoute.model }
  if (m) return { provider: runtime.lastRoute?.provider ?? runtime.defaultRoute.provider, model: m }
  return runtime.lastRoute ?? runtime.defaultRoute
}

/** 组装 GenerateOptions。 */
export interface StreamOptionsExtra {
  temperature?: number
  reasoningEffort?: string
  maxTokens?: number | null
}

export function buildStreamOptions(
  route: { provider: string; model: string },
  payload: { system: string; messages: Message[] },
  extra?: StreamOptionsExtra,
): Parameters<LlmRuntime['stream']>[0] {
  const options: Parameters<LlmRuntime['stream']>[0] = {
    provider: route.provider,
    model: route.model,
    system: payload.system || undefined,
    messages: payload.messages,
  }
  if (extra?.temperature !== undefined) options.temperature = extra.temperature
  if (extra?.reasoningEffort && extra.reasoningEffort !== 'auto') {
    const effort = extra.reasoningEffort === 'medium' ? 'low' : extra.reasoningEffort
    options.reasoningEffort = ReasoningEffortId(effort)
  }
  if (extra?.maxTokens !== undefined && extra.maxTokens !== null) {
    options.maxTokens = extra.maxTokens
  }
  return options
}

/** 聚合一次流式调用（非流式模式用）。 */
async function runStream(
  llm: LlmRuntime,
  options: Parameters<LlmRuntime['stream']>[0],
): Promise<{ text: string; reasoning: string }> {
  let text = ''
  let reasoning = ''
  const stream = llm.stream(options)
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') text += chunk.text
    else if (chunk.type === 'reasoning-delta') reasoning += chunk.text
  }
  return { text, reasoning }
}

/**
 * 处理一次聊天请求（SSE 主入口；调用方已解析 body 且校验过必需字段）。
 */
export async function handleChat(req: { method?: string }, res: ServerResponse, body: ChatRequest, deps: ChatDeps): Promise<void> {
  let prepared: PreparedChat
  try {
    prepared = prepareChat(body, deps)
  } catch (e) {
    // 助手/会话不存在 → 直接 JSON 错误
    res.writeHead(404, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'connection': 'close',
    })
    res.end(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND', message: String(e) } }))
    return
  }
  const { assistant, chatId, history, newUserMessage } = prepared

  // 确定路由与模型信息
  const route = resolveRoute(assistant, deps.runtime)
  let modelInfo: Awaited<ReturnType<LlmRuntime['resolveModelInfo']>> | null = null
  try {
    modelInfo = await deps.llm.resolveModelInfo(route.provider, route.model)
  } catch {
    modelInfo = null
  }

  // 记忆预取（最近 50 条候选）
  const memories = deps.memory.recent(
    assistant.memory.globalMemory,
    assistant.memory.globalMemory ? undefined : assistant.id,
    50,
  )
  const lastUserTs = history.length > 0 ? deps.chats.lastUserMessageTs(chatId) : null

  // 组装 payload
  const payload = buildPayload({
    assistant,
    history,
    newUserMessage,
    lastUserTs,
    runtime: deps.runtime,
    modelInfo,
    memories,
  })

  // 落库 user 消息（流开始前持久化）
  deps.chats.appendMessage(chatId, newUserMessage)

  // ── SSE 启动 ──
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    'connection': 'keep-alive',
  })
  res.write(': connected\n\n')
  sseData(res, { type: 'connected', chatId, assistantId: assistant.id })

  const options = buildStreamOptions(route, payload, {
    temperature: assistant.modelParams.temperature,
    reasoningEffort: assistant.modelParams.reasoningEffort,
    maxTokens: assistant.modelParams.maxTokens,
  })
  const useStreaming = assistant.modelParams.stream && body.overrides?.stream !== false

  try {
    if (!useStreaming) {
      // 非流式聚合
      const { text, reasoning } = await runStream(deps.llm, options)
      const assistantMsg: ChatMessage = {
        id: uid('msg') as ChatMessage['id'],
        role: 'assistant',
        content: text,
        ts: Date.now(),
      }
      deps.chats.appendMessage(chatId, assistantMsg)
      if (reasoning) sseData(res, { type: 'reasoning-delta', delta: reasoning })
      if (text) sseData(res, { type: 'text-delta', delta: text })
      sseData(res, { type: 'done', message: assistantMsg })
    } else {
      // 流式：逐帧转发
      let text = ''
      let reasoning = ''
      for await (const chunk of deps.llm.stream(options)) {
        if (chunk.type === 'text-delta') {
          text += chunk.text
          sseData(res, { type: 'text-delta', delta: chunk.text })
        } else if (chunk.type === 'reasoning-delta') {
          reasoning += chunk.text
          sseData(res, { type: 'reasoning-delta', delta: chunk.text })
        }
      }
      const assistantMsg: ChatMessage = {
        id: uid('msg') as ChatMessage['id'],
        role: 'assistant',
        content: text,
        ts: Date.now(),
      }
      deps.chats.appendMessage(chatId, assistantMsg)
      sseData(res, { type: 'done', message: assistantMsg })
    }
  } catch (e) {
    sseData(res, { type: 'error', code: 'LLM_ERROR', message: String(e) })
    try { res.end() } catch { /* 已关闭 */ }
    return
  }
  try { res.end() } catch { /* 已关闭 */ }
}

/** 供 prompt 之外的模块复用的 assistant 消息构造（预留）。 */
export function makeAssistantModelMessage(text: string, provider: string, model: string): Message {
  return createAssistantMessage({
    content: [{ type: 'text', text }],
    source: { provider, model },
  })
}
