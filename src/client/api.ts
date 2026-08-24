/**
 * @bananiceee/dsh-zhushou — client API 层（host REST 唯一通道）。
 * 全部经 fetch(API_BASE + ...) 同源调用；信封解包 + 错误归一。
 * 聊天已退役（/chat、/chats 端点移除）：对话由 DSH 主会话承载，本层仅保留
 * 助手档案 / 会话级选择 / 记忆 / 枚举 / profile 的调用。
 * 零外部依赖（只 import 共享契约的纯类型 + API_BASE 常量）。
 */
import { API_BASE } from '../shared/contracts.ts'
import type {
  AssistantSummary,
  CreateMemoryRequest,
  HealthInfo,
  ProviderInfo,
  SetSelectionRequest,
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
  GlobalMemoryEntry,
  MemoryEntryId,
  SessionSelection,
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

// ── 会话级选择（selection API）────────────────────────────────────────────────
// 选中 = 该 DSH 主会话以助手人设/模型/参数对话；null = 取消（恢复原生）。
// 契约：GET /selection?sessionId=、POST /selection（请求体 SetSelectionRequest）。

/** GET /selection?sessionId=xxx → 当前会话选择状态（无条目 → assistantId null）。 */
export function getSelection(sessionId: string): Promise<{ selection: SessionSelection }> {
  return request('/selection?sessionId=' + encodeURIComponent(sessionId))
}

/** POST /selection → 激活（assistantId 非 null）/ 取消（null）。返回落盘后的状态。 */
export function setSelection(
  sessionId: string,
  assistantId: AssistantId | null,
): Promise<{ selection: SessionSelection }> {
  const body: SetSelectionRequest = { sessionId, assistantId }
  return request('/selection', { method: 'POST', body: JSON.stringify(body) })
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
