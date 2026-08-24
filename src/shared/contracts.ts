/**
 * @dsh-external/dsh-assistant-panel — host HTTP API 契约（client ⇄ host 唯一通道）。
 *
 * 职责边界（见 docs/ARCHITECTURE.md「进程划分」）：
 *  - host：在 ctx.webServer.register 注册 `{prefix: API_BASE}`（prefix 路由），
 *    内部按「方法 + 路径段」分派到各 handler；
 *  - client：一律经 `fetch(API_BASE + ...)` 调用；聊天走 POST + ReadableStream 消费 SSE
 *    （EventSource 仅支持 GET，本契约的 chat 是 POST，故用 fetch 流式读取）。
 *
 * 统一响应信封：`{ ok: true, data: T }` 或 `{ ok: false, error: { code, message, details? } }`。
 * 本文件为纯类型 + 编译期常量，零运行时依赖（`import type` 引用 ./types.ts）。
 */
import type {
  AssistantConfig,
  AssistantId,
  AssistantMemoryEntry,
  ChatId,
  ChatMessage,
  ChatSession,
  GlobalMemoryEntry,
  MemoryEntryId,
  ModelParams,
  SessionSelection,
  WorkspaceId,
} from './types.ts'

/** API 根路径（与 host 注册的 prefix 路由一致；不含尾部斜杠）。 */
export const API_BASE = '/assistant-panel/api' as const

// ─────────────────────────────────────────────────────────────────────────────
// 统一信封
// ─────────────────────────────────────────────────────────────────────────────

/** 错误码（machine-readable；message 供展示）。 */
export type ApiErrorCode =
  | 'BAD_REQUEST'        // 参数/JSON 解析失败
  | 'NOT_FOUND'          // 资源不存在（助手/聊天/记忆/工作区）
  | 'CONFLICT'           // 名称/id 冲突
  | 'UNSUPPORTED'        // 能力不支持（如 topP 暂不生效的语义提示）
  | 'LLM_ERROR'          // ctx.llm.stream 调用失败
  | 'INTERNAL'           // 其他内部错误
  | 'ABORTED'            // 请求被中断/取消

/** 失败响应中的 error 体。 */
export interface ApiErrorBody {
  code: ApiErrorCode
  /** 人类可读错误描述。 */
  message: string
  /** 可选的机器可读附加信息（如校验失败的字段路径）。 */
  details?: unknown
}

/** 统一响应信封：成功 `{ok:true,data}` / 失败 `{ok:false,error}`。 */
export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody }

// ─────────────────────────────────────────────────────────────────────────────
// 路由表（webServer prefix 分派）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 路由表。GET/PUT/DELETE 中的 `:param` 为路径段（prefix 路由分派时按 / 切分解析）。
 * POST 请求体一律 application/json（URL 编码表单不支持）。
 */
export type ApiRoute =
  // 健康检查 / 元信息
  | 'GET    /api/health'
  // 助手档案 CRUD
  | 'GET    /api/assistants'
  | 'POST   /api/assistants'
  | 'GET    /api/assistants/:id'
  | 'PUT    /api/assistants/:id'
  | 'DELETE /api/assistants/:id'
  // 会话级选择（主会话内助手激活；chat/chats 端点已整体退役，不再存在独立聊天 API）
  | 'GET    /api/selection?sessionId='
  | 'POST   /api/selection'                  // {sessionId, assistantId|null} → 激活/取消
  // 记忆
  | 'GET    /api/memory?assistantId=&global='
  | 'POST   /api/memory'
  | 'PUT    /api/memory/:id'
  | 'DELETE /api/memory/:id'
  // skill / 模型 / 工作区 / 档案（只读枚举）
  | 'GET    /api/skills?cwd='
  | 'GET    /api/models'
  | 'GET    /api/workspaces'
  | 'GET    /api/profile'
  | 'PUT    /api/profile'

// ─────────────────────────────────────────────────────────────────────────────
// 各路由的请求/响应形状
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/health */
export interface HealthInfo {
  status: 'ok'
  pluginVersion: string
  /** 数据目录（${DSH_HOME||~/.dsh}/dsh-assistant-panel 解析后）。 */
  dataDir: string
  uptimeMs: number
}
export type HealthResp = ApiEnvelope<HealthInfo>

/** GET /api/assistants → 列表（摘要，避免整包配置）。 */
export interface AssistantSummary {
  id: AssistantId
  name: string
  avatar: string
  tags: string[]
  workspace: WorkspaceId | ''
  updatedAt: number
}
export type ListAssistantsResp = ApiEnvelope<{ assistants: AssistantSummary[] }>

/** POST /api/assistants 请求体：除 id 与 profile 时间戳外全量必填。 */
export type CreateAssistantInput = Omit<AssistantConfig, 'id'> & {
  profile: Omit<AssistantConfig['profile'], 'id' | 'createdAt' | 'updatedAt'>
}
export type CreateAssistantResp = ApiEnvelope<{ assistant: AssistantConfig }>

/** GET /api/assistants/:id */
export type GetAssistantResp = ApiEnvelope<{ assistant: AssistantConfig }>

/** PUT /api/assistants/:id 请求体：可部分字段；profile 子对象整体替换（patch 语义见 ARCHITECTURE）。 */
export type UpdateAssistantInput = Partial<Omit<AssistantConfig, 'id'>> & {
  profile?: Partial<Omit<AssistantConfig['profile'], 'id' | 'createdAt' | 'updatedAt'>>
}
export type UpdateAssistantResp = ApiEnvelope<{ assistant: AssistantConfig }>

/** DELETE /api/assistants/:id → 连带删除该助手私有记忆与快捷回复视图。 */
export type DeleteAssistantResp = ApiEnvelope<{ id: AssistantId }>

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ 聊天契约（退役段）——@deprecated
//
// 纠偏改造移除独立聊天：POST /api/chat、GET /api/chats 等端点已从路由表删除
// （聊天由 DSH 主会话 llm/stream 承载；激活经 selection API + host waterfall，
// 见 docs/ARCHITECTURE-ACTIVATION.md）。以下类型仅保留给旧客户端/历史参考，
// **禁止新代码使用**；host/client 工程师完成对应删除后本段随之下架。
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @deprecated 聊天端点已退役。禁止新代码使用。
 */
export interface ChatRequest {
  assistantId: AssistantId
  /** 本次用户输入。 */
  message: string
  /** 续聊：传上一轮返回的 chatId；缺省 = 新建会话。 */
  chatId?: ChatId
  /** 单次覆盖模型参数（不写回档案；如临时换模型/关流式）。 */
  overrides?: Partial<ModelParams>
}

/**
 * @deprecated 聊天 SSE 已退役（/chat 端点移除）。禁止新代码使用，随聊天端点删除后下架。
 * 原语义（仅供历史参考）：`data: <json>\n\n` 帧 + `: ping\n\n` 空闲心跳 + `event: <type>` 行。
 */
export type ChatEvent =
  /** 首帧：流建立、返回会话 id。 */
  | { type: 'connected'; chatId: ChatId; assistantId: AssistantId }
  /** 正文增量（按序拼接即完整回复）。 */
  | { type: 'text-delta'; delta: string }
  /** 思考增量（deepseek 风格 reasoning；可按 UI 折叠展示）。 */
  | { type: 'reasoning-delta'; delta: string }
  /** 工具调用增量（未来扩展，先留契约）。 */
  | { type: 'tool-call-delta'; id: string; name: string; argumentsDelta: string }
  /** 记忆抽取完成（异步副作用通知）。 */
  | { type: 'memory-saved'; entryId: MemoryEntryId }
  /** 终帧：完整消息落库。 */
  | { type: 'done'; message: ChatMessage }
  /** 错误帧（收起连接，code 复用 ApiErrorCode）。 */
  | { type: 'error'; code: ApiErrorCode; message: string }

/** @deprecated 同上（聊天 SSE 退役）。 */
export const CHAT_EVENT_TYPES = [
  'connected', 'text-delta', 'reasoning-delta', 'tool-call-delta', 'memory-saved', 'done', 'error',
] as const
/** @deprecated 同上（聊天 SSE 退役）。 */
export type ChatEventName = (typeof CHAT_EVENT_TYPES)[number]

/** @deprecated 聊天端点已退役。禁止新代码使用；随聊天端点删除后下架。 */
export interface ChatSummary {
  id: ChatId
  assistantId: AssistantId
  title: string
  createdAt: number
  updatedAt: number
  /** 消息条数（便于列表展示）。 */
  messageCount: number
}
/** @deprecated 聊天端点已退役。 */
export type ListChatsResp = ApiEnvelope<{ chats: ChatSummary[] }>

/** @deprecated 聊天端点已退役。 */
export type GetChatMessagesResp = ApiEnvelope<{ chat: ChatSession }>

/** @deprecated 聊天端点已退役。 */
export type DeleteChatResp = ApiEnvelope<{ id: ChatId }>

// ─────────────────────────────────────────────────────────────────────────────
// 会话级选择（selection API）——主会话内助手激活/取消
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/selection?sessionId=xxx → 当前会话选择状态（激活的助手 + 最近对话时间）。 */
export type GetSelectionResp = ApiEnvelope<{ selection: SessionSelection }>

/** POST /api/selection 请求体：激活或取消会话级助手。 */
export interface SetSelectionRequest {
  /** DSH 主会话 id（字符串）。 */
  sessionId: string
  /** 目标助手 id；null = 取消激活（恢复原生对话；host 删除 selection.json 条目）。 */
  assistantId: AssistantId | null
}

/** POST /api/selection 响应：落盘后的选择状态。 */
export type SetSelectionResp = ApiEnvelope<{ selection: SessionSelection }>

// ─────────────────────────────────────────────────────────────────────────────
// 记忆
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/memory 查询参数：global=true 读全局池；否则按 assistantId 读私有池。 */
export interface MemoryListQuery {
  assistantId?: AssistantId
  global?: boolean
}
export type MemoryListResp = ApiEnvelope<{
  /** 全局池返回 GlobalMemoryEntry；私有池返回 AssistantMemoryEntry。 */
  entries: GlobalMemoryEntry[] | AssistantMemoryEntry[]
}>

/** POST /api/memory 请求体。 */
export interface CreateMemoryRequest {
  content: string
  tags?: string[]
  /** 私有池必填；global 池忽略。 */
  assistantId?: AssistantId
}
export type CreateMemoryResp = ApiEnvelope<{ entry: GlobalMemoryEntry | AssistantMemoryEntry }>

/** PUT /api/memory/:id。 */
export interface UpdateMemoryRequest {
  content?: string
  tags?: string[]
}
export type UpdateMemoryResp = ApiEnvelope<{ entry: GlobalMemoryEntry | AssistantMemoryEntry }>

/** DELETE /api/memory/:id */
export type DeleteMemoryResp = ApiEnvelope<{ id: MemoryEntryId }>

// ─────────────────────────────────────────────────────────────────────────────
// skill / 模型 / 工作区 / profile（只读枚举 + profile 读写）
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/skills?cwd= → 对齐 ctx.skills.list(). */
export interface SkillInfo {
  /** 技能名（写入 SkillRef.name）。 */
  name: string
  description: string
  whenToUse?: string
  modelInvocable: boolean
  userInvocable: boolean
  /** 来源标签（provider/source 方面，展示用）。 */
  source?: string
}
export type ListSkillsResp = ApiEnvelope<{ skills: SkillInfo[] }>

/** GET /api/models → host 侧 ctx.llm 枚举（listProviders/listModels/resolveModelInfo）。 */
export interface ModelInfo {
  id: string
  name: string
  description?: string
  contextWindow?: number
  defaultMaxTokens?: number
  /** 该模型支持的思考强度档位（resolveModelInfo().reasoning.efforts）。 */
  reasoningEfforts?: string[]
  /** 默认思考强度（resolveModelInfo().reasoning.defaultEffort）。 */
  defaultEffort?: string
}
export interface ProviderInfo {
  id: string
  name: string
  models: ModelInfo[]
}
export type ListModelsResp = ApiEnvelope<{ providers: ProviderInfo[] }>

/** GET /api/workspaces → 对齐 ctx.workspaceRegistry.list(). */
export interface WorkspaceInfo {
  id: WorkspaceId
  path: string
  title: string
}
export type ListWorkspacesResp = ApiEnvelope<{ workspaces: WorkspaceInfo[] }>

/** 插件级 profile（身份/本地化，写入 settings.json）。 */
export interface PluginProfile {
  /** 用户昵称（{{user_name}} 变量来源；DSH 无全局用户档案，插件自建）。 */
  userName: string
  /** 语言环境（对齐 settings.yaml locale.preference；缺省由 host Intl 探测）。 */
  locale: string
  /** 时区（Intl.DateTimeFormat().resolvedOptions().timeZone）。 */
  timezone: string
  /** 数据目录。 */
  dataDir: string
}
export type GetProfileResp = ApiEnvelope<{ profile: PluginProfile }>

/** PUT /api/profile 请求体：仅可写字段。 */
export interface UpdateProfileRequest {
  userName?: string
  locale?: string
  timezone?: string
}
export type UpdateProfileResp = ApiEnvelope<{ profile: PluginProfile }>
