/**
 * dsh-assistant-panel — HTTP API 路由（api.ts）。
 *
 * 注册在 ctx.webServer prefix 路由 /assistant-panel/api（见 src/shared/contracts.ts API_BASE）。
 * 统一信封 { ok: true, data } / { ok: false, error: { code, message, details? } }。
 * JSON 响应：content-type application/json + no-store + connection close（status-bar 先例）；
 * SSE：/api/chat 用 keep-alive（hmr 先例）。
 * 错误码：BAD_REQUEST / NOT_FOUND / CONFLICT / UNSUPPORTED / LLM_ERROR / INTERNAL / ABORTED。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from 'cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  API_BASE,
  type ApiErrorCode,
  type ApiEnvelope,
  type ChatRequest,
  type CreateAssistantInput,
  type UpdateAssistantInput,
} from './shared/contracts.ts'
import {
  type AssistantConfig,
  type AssistantId,
  type ChatId,
  type ChatMessage,
  type GlobalMemoryEntry,
  type MemoryEntryId,
  type AssistantMemoryEntry,
} from './shared/types.ts'
import { uid, detectUserName } from './store.ts'
import type {
  AssistantStore,
  ChatStore,
  MemoryStore,
  SettingsStore,
} from './store.ts'
import { handleChat, type ChatDeps } from './chat.ts'
import type { RuntimeContext } from './prompt.ts'

/** 路由处理器依赖集合。 */
export interface ApiDeps extends ChatDeps {
  ctx: Context
  settings: SettingsStore
  dataDir: string
  pluginVersion: string
  startedAt: number
}

/** 统一 JSON 响应。 */
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'connection': 'close',
  })
  res.end(JSON.stringify(body))
}

/** 成功信封。 */
function ok<T>(res: ServerResponse, data: T): void {
  json(res, 200, { ok: true, data } satisfies ApiEnvelope<T>)
}

/** 失败信封。 */
function fail(res: ServerResponse, status: number, code: ApiErrorCode, message: string, details?: unknown): void {
  json(res, status, { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } } satisfies ApiEnvelope<never>)
}

/** 读取请求体（JSON）。 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** 解析 JSON body；失败抛 BAD_REQUEST。 */
async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  const text = await readBody(req)
  if (!text.trim()) throw new Error('empty-body')
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('invalid-json')
  }
}

/**
 * 注册 /assistant-panel/api 前缀路由。
 * 内部按「方法 + 路径段」分派。
 */
export function registerApiRoutes(ctx: Context, deps: ApiDeps): () => void {
  return ctx.webServer.register({
    kind: 'prefix',
    path: API_BASE,
    handler: async (req, res) => {
      try {
        await dispatch(req, res, deps)
      } catch (e) {
        fail(res, 500, 'INTERNAL', String(e))
      }
    },
  })
}

/** 从 URL 提取路径段（相对 API_BASE）。 */
function segments(url: URL): string[] {
  const rest = url.pathname.slice(API_BASE.length)
  return rest.split('/').filter(Boolean)
}

async function dispatch(req: IncomingMessage, res: ServerResponse, deps: ApiDeps): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const seg = segments(url)
  const method = (req.method ?? 'GET').toUpperCase()
  const query = url.searchParams

  // ── 健康检查 ──
  if (method === 'GET' && seg.length === 1 && seg[0] === 'health') {
    ok(res, {
      status: 'ok',
      pluginVersion: deps.pluginVersion,
      dataDir: deps.dataDir,
      uptimeMs: Date.now() - deps.startedAt,
    })
    return
  }

  // ── 助手 CRUD ──
  if (seg[0] === 'assistants') {
    await dispatchAssistants(method, seg, query, req, res, deps)
    return
  }

  // ── 聊天 ──
  if (seg[0] === 'chat') {
    if (method === 'POST' && seg.length === 1) {
      let body: ChatRequest
      try {
        body = await parseJsonBody<ChatRequest>(req)
      } catch (e) {
        fail(res, 400, 'BAD_REQUEST', String(e))
        return
      }
      if (!body.assistantId || typeof body.message !== 'string' || !body.message.trim()) {
        fail(res, 400, 'BAD_REQUEST', '缺少 assistantId 或 message')
        return
      }
      await handleChat(req, res, body, deps)
      return
    }
    fail(res, 404, 'NOT_FOUND', 'chat 路由不存在')
    return
  }

  // ── 会话（chats）──
  if (seg[0] === 'chats') {
    await dispatchChats(method, seg, query, req, res, deps)
    return
  }

  // ── 记忆 ──
  if (seg[0] === 'memory') {
    await dispatchMemory(method, seg, query, req, res, deps)
    return
  }

  // ── skills / models / workspaces / profile（只读枚举 + profile 读写）──
  if (seg[0] === 'skills' && method === 'GET') {
    await dispatchSkills(query, res, deps)
    return
  }
  if (seg[0] === 'models' && method === 'GET') {
    await dispatchModels(res, deps)
    return
  }
  if (seg[0] === 'workspaces' && method === 'GET') {
    await dispatchWorkspaces(res, deps)
    return
  }
  if (seg[0] === 'profile') {
    await dispatchProfile(method, req, res, deps)
    return
  }

  fail(res, 404, 'NOT_FOUND', 'unknown route: ' + method + ' ' + url.pathname)
}

// ─────────────────────────────────────────────────────────────────────────────
// 助手
// ─────────────────────────────────────────────────────────────────────────────

async function dispatchAssistants(
  method: string,
  seg: string[],
  query: URLSearchParams,
  req: IncomingMessage,
  res: ServerResponse,
  deps: ApiDeps,
): Promise<void> {
  // GET /assistants
  if (method === 'GET' && seg.length === 1) {
    ok(res, { assistants: deps.assistants.summaries() })
    return
  }
  // POST /assistants
  if (method === 'POST' && seg.length === 1) {
    let input: CreateAssistantInput
    try {
      input = await parseJsonBody<CreateAssistantInput>(req)
    } catch (e) {
      fail(res, 400, 'BAD_REQUEST', String(e))
      return
    }
    if (!input.profile?.name) {
      fail(res, 400, 'BAD_REQUEST', '缺少 profile.name')
      return
    }
    try {
      const assistant = deps.assistants.create(input)
      ok(res, { assistant })
    } catch (e) {
      fail(res, 400, 'BAD_REQUEST', '创建失败: ' + String(e))
    }
    return
  }
  // /assistants/:id
  if (seg.length === 2) {
    const id = seg[1] as AssistantId
    if (method === 'GET') {
      const assistant = deps.assistants.get(id)
      if (!assistant) { fail(res, 404, 'NOT_FOUND', '助手不存在'); return }
      ok(res, { assistant })
      return
    }
    if (method === 'PUT') {
      let patch: UpdateAssistantInput
      try {
        patch = await parseJsonBody<UpdateAssistantInput>(req)
      } catch (e) {
        fail(res, 400, 'BAD_REQUEST', String(e))
        return
      }
      const updated = deps.assistants.update(id, patch)
      if (!updated) { fail(res, 404, 'NOT_FOUND', '助手不存在'); return }
      ok(res, { assistant: updated })
      return
    }
    if (method === 'DELETE') {
      const existed = deps.assistants.get(id)
      if (!existed) { fail(res, 404, 'NOT_FOUND', '助手不存在'); return }
      deps.assistants.delete(id)
      // 连带删除私有记忆池
      deps.memory.list(false, id).forEach((entry) => {
        deps.memory.delete(entry.id, false, id)
      })
      // 连带删除该助手全部会话（与 UI 提示「连带其私有记忆与会话」一致）
      deps.chats.list(id).forEach((chat) => {
        deps.chats.delete(chat.id)
      })
      ok(res, { id })
      return
    }
  }
  fail(res, 404, 'NOT_FOUND', 'assistants 路由不存在')
}

// ─────────────────────────────────────────────────────────────────────────────
// 会话（chats）
// ─────────────────────────────────────────────────────────────────────────────

async function dispatchChats(
  method: string,
  seg: string[],
  query: URLSearchParams,
  req: IncomingMessage,
  res: ServerResponse,
  deps: ApiDeps,
): Promise<void> {
  // GET /chats?assistantId=
  if (method === 'GET' && seg.length === 1) {
    const assistantId = (query.get('assistantId') ?? undefined) as AssistantId | undefined
    ok(res, { chats: deps.chats.list(assistantId) })
    return
  }
  // DELETE /chats/:chatId
  if (method === 'DELETE' && seg.length === 2) {
    const chatId = seg[1] as ChatId
    const existed = deps.chats.delete(chatId)
    if (!existed) { fail(res, 404, 'NOT_FOUND', '会话不存在'); return }
    ok(res, { id: chatId })
    return
  }
  // GET /chats/:chatId/messages
  if (method === 'GET' && seg.length === 3 && seg[2] === 'messages') {
    const chatId = seg[1] as ChatId
    const session = deps.chats.get(chatId)
    if (!session) { fail(res, 404, 'NOT_FOUND', '会话不存在'); return }
    ok(res, { chat: session })
    return
  }
  fail(res, 404, 'NOT_FOUND', 'chats 路由不存在')
}

// ─────────────────────────────────────────────────────────────────────────────
// 记忆
// ─────────────────────────────────────────────────────────────────────────────

/** 解析记忆请求的池选择：global=true 全局池；否则 assistantId 私有池。 */
function memoryPool(query: URLSearchParams): { global: boolean; assistantId?: AssistantId } {
  const global = query.get('global') === 'true'
  const assistantId = (query.get('assistantId') ?? undefined) as AssistantId | undefined
  return { global, assistantId }
}

async function dispatchMemory(
  method: string,
  seg: string[],
  query: URLSearchParams,
  req: IncomingMessage,
  res: ServerResponse,
  deps: ApiDeps,
): Promise<void> {
  const { global, assistantId } = memoryPool(query)

  // GET /memory?global=&assistantId=
  if (method === 'GET' && seg.length === 1) {
    const entries = deps.memory.list(global, assistantId)
    ok(res, { entries })
    return
  }
  // POST /memory
  if (method === 'POST' && seg.length === 1) {
    let body: { content?: string; tags?: string[]; assistantId?: AssistantId }
    try {
      body = await parseJsonBody(req)
    } catch (e) {
      fail(res, 400, 'BAD_REQUEST', String(e))
      return
    }
    if (!body.content || !body.content.trim()) {
      fail(res, 400, 'BAD_REQUEST', '缺少 content')
      return
    }
    if (!global && !(body.assistantId ?? assistantId)) {
      fail(res, 400, 'BAD_REQUEST', '私有池缺少 assistantId')
      return
    }
    const targetAssistant = global ? undefined : (body.assistantId ?? assistantId)
    const now = Date.now()
    const entry: GlobalMemoryEntry = {
      id: uid('mem') as MemoryEntryId,
      content: body.content,
      ts: now,
      ...(body.tags && body.tags.length > 0 ? { tags: body.tags } : {}),
    }
    deps.memory.add(entry, global, targetAssistant)
    const out = global ? entry : { ...entry, assistantId: targetAssistant }
    ok(res, { entry: out })
    return
  }
  // PUT /memory/:id
  if (method === 'PUT' && seg.length === 2) {
    const id = seg[1] as MemoryEntryId
    let body: { content?: string; tags?: string[] }
    try {
      body = await parseJsonBody(req)
    } catch (e) {
      fail(res, 400, 'BAD_REQUEST', String(e))
      return
    }
    const updated = deps.memory.update(id, body, global, assistantId)
    if (!updated) { fail(res, 404, 'NOT_FOUND', '记忆条目不存在'); return }
    ok(res, { entry: updated })
    return
  }
  // DELETE /memory/:id
  if (method === 'DELETE' && seg.length === 2) {
    const id = seg[1] as MemoryEntryId
    const existed = deps.memory.delete(id, global, assistantId)
    if (!existed) { fail(res, 404, 'NOT_FOUND', '记忆条目不存在'); return }
    ok(res, { id })
    return
  }
  fail(res, 404, 'NOT_FOUND', 'memory 路由不存在')
}

// ─────────────────────────────────────────────────────────────────────────────
// skills / models / workspaces / profile
// ─────────────────────────────────────────────────────────────────────────────

async function dispatchSkills(query: URLSearchParams, res: ServerResponse, deps: ApiDeps): Promise<void> {
  const cwd = query.get('cwd') ?? undefined
  let skills: Array<{ name: string; description: string; whenToUse?: string; modelInvocable: boolean; userInvocable: boolean; source?: string }> = []
  try {
    const ctxSkills = (deps.ctx as unknown as { skills?: { list(opts?: { cwd?: string }): Promise<Array<{ name: string; description: string; whenToUse?: string; invocation: { modelInvocable: boolean; userInvocable: boolean }; source?: string; provider?: string }>> } }).skills
    if (ctxSkills) {
      const list = await ctxSkills.list(cwd ? { cwd } : {})
      skills = list.map((s) => ({
        name: s.name,
        description: s.description,
        ...(s.whenToUse ? { whenToUse: s.whenToUse } : {}),
        modelInvocable: s.invocation.modelInvocable,
        userInvocable: s.invocation.userInvocable,
        ...(s.provider ? { source: s.provider } : {}),
      }))
    }
  } catch (e) {
    ok(res, { skills: [], note: 'skill 服务不可用: ' + String(e) })
    return
  }
  ok(res, { skills })
}

async function dispatchModels(res: ServerResponse, deps: ApiDeps): Promise<void> {
  try {
    const llm = deps.llm
    const listProviders = llm.listProviders() ?? []
    const current = deps.runtime.lastRoute ?? deps.runtime.defaultRoute
    const providers: Array<{ id: string; name: string; models: ModelView[] }> = []
    for (const p of listProviders) {
      const models: ModelView[] = []
      try {
        const list = await llm.listModels(p.id)
        for (const m of list) {
          let resolved: Awaited<ReturnType<typeof llm.resolveModelInfo>> | null = null
          try {
            resolved = await llm.resolveModelInfo(p.id, m.id)
          } catch {
            resolved = null
          }
          models.push({
            id: m.id,
            name: m.name,
            ...(m.description ? { description: m.description } : {}),
            ...(resolved?.context ? { contextWindow: resolved.context.contextWindow } : {}),
            ...(resolved?.defaultMaxTokens !== undefined ? { defaultMaxTokens: resolved.defaultMaxTokens } : {}),
            ...(resolved?.reasoning ? { reasoningEfforts: resolved.reasoning.efforts.map((e) => e.id) } : {}),
            ...(resolved?.reasoning?.defaultEffort ? { defaultEffort: resolved.reasoning.defaultEffort } : {}),
            // 标记当前会话主模型为 default（lastRoute 优先，其次 defaultRoute）
            ...(current && p.id === current.provider && m.id === current.model ? { default: true } : {}),
          })
        }
      } catch {
        // 单 provider 枚举失败跳过
      }
      providers.push({ id: p.id, name: p.name, models })
    }
    ok(res, { providers })
  } catch {
    // llm 服务不可用 → 兜底 settings 目录（DESIGN：冷启动快照）
    const fallback = modelsFallback(deps)
    ok(res, { providers: fallback })
  }
}

/** 模型的展示视图（含 default 标记；default 超出 contracts.ts 的 ModelInfo，客户端按需读取）。 */
interface ModelView {
  id: string
  name: string
  description?: string
  contextWindow?: number
  defaultMaxTokens?: number
  reasoningEfforts?: string[]
  defaultEffort?: string
  default?: boolean
}

/** 兜底：从 settings 服务读模型目录（llm-deepseek / llm-pi-ai 段，等同 settings.yaml 快照）。 */
function modelsFallback(deps: ApiDeps): Array<{ id: string; name: string; models: Array<{ id: string; name: string; contextWindow?: number; maxTokens?: number }> }> {
  const providers: Array<{ id: string; name: string; models: Array<{ id: string; name: string; contextWindow?: number; maxTokens?: number }> }> = []
  try {
    const settingsSvc = deps.ctx.settings
    // llm-deepseek: { models: [{ id, name, contextWindow, maxTokens }] }
    const ds = settingsSvc?.get(settingsNamespace('llm-deepseek')) as { models?: Array<{ id: string; name?: string; contextWindow?: number; maxTokens?: number }> } | undefined
    if (ds?.models?.length) {
      providers.push({
        id: 'llm-deepseek',
        name: 'DeepSeek',
        models: ds.models.map((m) => ({ id: m.id, name: m.name ?? m.id, ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}), ...(m.maxTokens ? { maxTokens: m.maxTokens } : {}) })),
      })
    }
    // llm-pi-ai: { providers: { <name>: { models: [...] } } }
    const pi = settingsSvc?.get(settingsNamespace('llm-pi-ai')) as { providers?: Record<string, { models?: Array<{ id: string; name?: string; contextWindow?: number; maxTokens?: number }> }> } | undefined
    if (pi?.providers) {
      for (const [name, entry] of Object.entries(pi.providers)) {
        if (!entry?.models?.length) continue
        providers.push({
          id: name,
          name,
          models: entry.models.map((m) => ({ id: m.id, name: m.name ?? m.id, ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}), ...(m.maxTokens ? { maxTokens: m.maxTokens } : {}) })),
        })
      }
    }
  } catch {
    // 任何失败返回空表
  }
  return providers
}

async function dispatchWorkspaces(res: ServerResponse, deps: ApiDeps): Promise<void> {
  let workspaces: Array<{ id: string; path: string; title: string }> = []
  try {
    const registry = (deps.ctx as unknown as { workspaceRegistry?: { list(): Array<{ id: string; path: string; title: string }> } }).workspaceRegistry
    if (registry) {
      workspaces = registry.list().map((w) => ({ id: w.id, path: w.path, title: w.title }))
    }
  } catch {
    workspaces = []
  }
  ok(res, { workspaces })
}

async function dispatchProfile(method: string, req: IncomingMessage, res: ServerResponse, deps: ApiDeps): Promise<void> {
  if (method === 'GET') {
    ok(res, { profile: deps.settings.profile() })
    return
  }
  if (method === 'PUT') {
    let body: { userName?: string; locale?: string; timezone?: string }
    try {
      body = await parseJsonBody(req)
    } catch (e) {
      fail(res, 400, 'BAD_REQUEST', String(e))
      return
    }
    const patch: { userName?: string; locale?: string; timezone?: string } = {}
    if (body.userName !== undefined) patch.userName = body.userName
    if (body.locale !== undefined) patch.locale = body.locale
    if (body.timezone !== undefined) patch.timezone = body.timezone
    const profile = deps.settings.update(patch)
    ok(res, {
      profile: {
        userName: profile.userName ?? '',
        locale: profile.locale ?? '',
        timezone: profile.timezone ?? '',
        dataDir: deps.dataDir,
      },
    })
    return
  }
  fail(res, 404, 'NOT_FOUND', 'profile 路由不存在')
}

export const _internal = { json, ok, fail, readBody, parseJsonBody }
