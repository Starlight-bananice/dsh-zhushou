/**
 * @dsh-external/dsh-assistant-panel — client API 层（host REST + SSE 唯一通道）。
 * 全部经 fetch(API_BASE + ...) 同源调用；信封解包 + 错误归一；聊天走 POST + ReadableStream SSE。
 * 零外部依赖（只 import 共享契约的纯类型 + API_BASE 常量）。
 */
import { API_BASE } from '../shared/contracts.ts'
import type {
  AssistantSummary,
  ChatEvent,
  ChatRequest,
  ChatSummary,
  CreateAssistantInput,
  CreateMemoryRequest,
  HealthInfo,
  ProviderInfo,
  SkillInfo,
  UpdateAssistantInput,
  UpdateMemoryRequest,
  WorkspaceInfo,
} from '../shared/contracts.ts'
import type {
  AssistantConfig,
  AssistantId,
  AssistantMemoryEntry,
  AssistantProfile,
  ChatId,
  ChatMessage,
  ChatSession,
  GlobalMemoryEntry,
  MemoryEntryId,
} from '../shared/types.ts'

/** 业务错误（信封 error 归一）。 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 从任意异常取展示文案。 */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return String(e)
}

/** 统一请求：解包信封；失败抛 ApiError。 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined) headers.set('content-type', 'application/json')
  let res: Response
  try {
    res = await fetch(API_BASE + path, { ...init, headers })
  } catch (e) {
    throw new ApiError('INTERNAL', '网络请求失败：' + (e instanceof Error ? e.message : String(e)))
  }
  let body: { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
  try {
    body = (await res.json()) as typeof body
  } catch {
    throw new ApiError('INTERNAL', '响应解析失败（HTTP ' + res.status + '）')
  }
  if (!body.ok) throw new ApiError(body.error.code, body.error.message)
  return body.data
}

// ── 健康 ─────────────────────────────────────────────────────────────────────

export function getHealth(): Promise<HealthInfo> {
  return request('/health')
}

// ── 助手档案 ─────────────────────────────────────────────────────────────────
// 注：contracts.CreateAssistantInput 的交叉类型会让 profile 必须带 id/时间戳，
// 这里用语义正确的 CreateAssistantBody（顶层去 id，profile 去 id/createdAt/updatedAt）。
export type CreateAssistantBody = Omit<AssistantConfig, 'id' | 'profile'> & {
  profile: Omit<AssistantProfile, 'id' | 'createdAt' | 'updatedAt'>
}

export function listAssistants(): Promise<{ assistants: AssistantSummary[] }> {
  return request('/assistants')
}

export function createAssistant(input: CreateAssistantBody): Promise<{ assistant: AssistantConfig }> {
  return request('/assistants', { method: 'POST', body: JSON.stringify(input) })
}

export function getAssistant(id: AssistantId): Promise<{ assistant: AssistantConfig }> {
  return request('/assistants/' + encodeURIComponent(id))
}

export function updateAssistant(id: AssistantId, patch: UpdateAssistantInput): Promise<{ assistant: AssistantConfig }> {
  return request('/assistants/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(patch) })
}

export function deleteAssistant(id: AssistantId): Promise<{ id: AssistantId }> {
  return request('/assistants/' + encodeURIComponent(id), { method: 'DELETE' })
}

// ── 聊天 / 会话 ───────────────────────────────────────────────────────────────

export function listChats(assistantId: AssistantId): Promise<{ chats: ChatSummary[] }> {
  return request('/chats?assistantId=' + encodeURIComponent(assistantId))
}

export function getChatMessages(chatId: ChatId): Promise<{ chat: ChatSession }> {
  return request('/chats/' + encodeURIComponent(chatId) + '/messages')
}

export function deleteChat(chatId: ChatId): Promise<{ id: ChatId }> {
  return request('/chats/' + encodeURIComponent(chatId), { method: 'DELETE' })
}

/** SSE 聊天事件回调。 */
export interface ChatStreamHandlers {
  onConnected?: (chatId: ChatId) => void
  onDelta?: (delta: string) => void
  onReasoning?: (delta: string) => void
  onDone?: (message: ChatMessage) => void
  onError?: (code: string, message: string) => void
  onMemorySaved?: (entryId: MemoryEntryId) => void
}

/**
 * POST /chat SSE 消费：fetch + ReadableStream，按 \n\n 分帧解析
 * （首帧注释行 ':' 跳过；event:/data: 行提取）。EventSource 不支持 POST，故手动读流。
 */
export async function streamChat(
  req: ChatRequest,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(API_BASE + '/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    })
  } catch (e) {
    if (signal?.aborted) throw new ApiError('ABORTED', '已停止')
    throw new ApiError('INTERNAL', '聊天请求失败：' + (e instanceof Error ? e.message : String(e)))
  }
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => '')
    throw new ApiError('INTERNAL', '聊天请求失败（HTTP ' + res.status + '）' + (txt ? '：' + txt.slice(0, 200) : ''))
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (block: string) => {
    let eventName = 'message'
    const datas: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue // SSE 注释（心跳）
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:')) datas.push(line.slice(5).trimStart())
    }
    if (!datas.length) return
    let ev: ChatEvent
    try {
      ev = JSON.parse(datas.join('\n')) as ChatEvent
    } catch {
      return // 坏帧忽略
    }
    switch (ev.type) {
      case 'connected': handlers.onConnected?.(ev.chatId); break
      case 'text-delta': handlers.onDelta?.(ev.delta); break
      case 'reasoning-delta': handlers.onReasoning?.(ev.delta); break
      case 'tool-call-delta': break
      case 'memory-saved': handlers.onMemorySaved?.(ev.entryId); break
      case 'done': handlers.onDone?.(ev.message); break
      case 'error': handlers.onError?.(ev.code, ev.message); break
    }
  }

  // 行缓冲：按 \n\n 切帧（兼容 \r\n）
  let carry = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += carry + decoder.decode(value, { stream: true })
    carry = ''
    let idx = buffer.indexOf('\n\n')
    while (idx >= 0) {
      dispatch(buffer.slice(0, idx).replace(/\r/g, ''))
      buffer = buffer.slice(idx + 2)
      idx = buffer.indexOf('\n\n')
    }
  }
  buffer = (carry + buffer).replace(/\r/g, '')
  if (buffer.trim()) dispatch(buffer)
}

// ── 记忆 ─────────────────────────────────────────────────────────────────────

export function listMemory(query: { assistantId?: AssistantId; global?: boolean }): Promise<{
  entries: GlobalMemoryEntry[] | AssistantMemoryEntry[]
}> {
  const q = new URLSearchParams()
  if (query.assistantId) q.set('assistantId', query.assistantId)
  if (query.global) q.set('global', 'true')
  return request('/memory?' + q.toString())
}

export function createMemory(req: CreateMemoryRequest): Promise<{
  entry: GlobalMemoryEntry | AssistantMemoryEntry
}> {
  return request('/memory', { method: 'POST', body: JSON.stringify(req) })
}

export function updateMemory(id: MemoryEntryId, req: UpdateMemoryRequest): Promise<{
  entry: GlobalMemoryEntry | AssistantMemoryEntry
}> {
  return request('/memory/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(req) })
}

export function deleteMemory(id: MemoryEntryId): Promise<{ id: MemoryEntryId }> {
  return request('/memory/' + encodeURIComponent(id), { method: 'DELETE' })
}

// ── skill / 模型 / 工作区 / profile（只读枚举）────────────────────────────────

export function listSkills(): Promise<{ skills: SkillInfo[] }> {
  return request('/skills')
}

export function listModels(): Promise<{ providers: ProviderInfo[] }> {
  return request('/models')
}

export function listWorkspaces(): Promise<{ workspaces: WorkspaceInfo[] }> {
  return request('/workspaces')
}
