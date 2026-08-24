/**
 * @dsh-external/dsh-assistant-panel — 共享纯类型（host + client 共用）。
 *
 * ⚠️ 本文件必须保持 **零运行时依赖**：
 *  - 全部内容为 type / interface / 字面量联合 / type-only 别名；
 *  - 不允许 import 任何运行时模块（schemastery、dsh-* 等）；
 *  - host 编译（NodeNext + rewriteRelativeImportExtensions）与 client 打包（tsdown）
 *    都能直接使用；工程代码请用 `import type { ... } from '../shared/types.ts'`。
 *
 * 时间戳约定：全部为 epoch 毫秒（`Date.now()` 语义）。见 docs/ARCHITECTURE.md「持久化布局」。
 */

/** 时戳：epoch 毫秒数（Date.now() 语义）。 */
export type Timestamp = number

/** 类型级品牌：给 string 打上唯一语义标牌，编译期防串用，运行时零开销。 */
export type Brand<T, Name extends string> = T & { readonly __brand?: Name }

/** 助手档案 id。 */
export type AssistantId = Brand<string, 'AssistantId'>
/**
 * @deprecated chats 退役（纠偏改造）：本插件不再生成/维护独立会话 id——
 * 聊天历史由 DSH SessionStore 承载（~/.dsh/sessions）。保留仅作历史参考，
 * 删除聊天端点后随之下架。
 */
export type ChatId = Brand<string, 'ChatId'>
/** 记忆条目 id。 */
export type MemoryEntryId = Brand<string, 'MemoryEntryId'>
/** 工作区 id（对齐 ctx.workspaceRegistry.list() 的 Workspace.id）。 */
export type WorkspaceId = Brand<string, 'WorkspaceId'>

/** 消息角色。 */
export type MessageRole = 'user' | 'assistant' | 'system'

/**
 * 思考强度。DSH 底层（ReasoningEffortId）当前暴露 off/low/high/max 四档；
 * `auto` = 交给 provider 默认（resolveModelInfo().reasoning.defaultEffort）；
 * `medium` = 需求层的五档语义，host 组装时按 adapter 能力就近映射（见 ARCHITECTURE「决策」）。
 */
export type ReasoningEffort = 'auto' | 'off' | 'low' | 'medium' | 'high' | 'max'

/** 模型参数（侧边栏助手设置 → 生成参数）。 */
export interface ModelParams {
  /**
   * 提供商路由 id；null = 自动（跟随会话主模型，见 ARCHITECTURE「模型路由」）。
   * 留空串（''）在宿主层归一化为 null。
   */
  provider: string | null
  /** 模型 id（resolveModelInfo 返回的 model.id）。provider 为 null 时可为 ''（跟随主模型）。 */
  model: string
  /** 温度 0–2；语义与 ctx.llm.stream 的 temperature 对齐。 */
  temperature: number
  /**
   * Top-p 0–1。⚠️ 设计决策：DSH GenerateOptions/LlmCallConfig 当前无 topP 字段，
   * 本字段作为设置保留、参与校验与持久化，但暂不传递给 ctx.llm.stream（见 ARCHITECTURE「决策」）。
   */
  topP: number
  /** 思考强度，默认 'auto'。 */
  reasoningEffort: ReasoningEffort
  /** 最大生成 token；null = 无限制（不传 maxTokens）。 */
  maxTokens: number | null
  /** 流式输出开关（默认 true）。 */
  stream: boolean
  /** 携带的历史消息条数（取最近 N 条）；0 = 全部。 */
  contextLimit: number
}

/** 系统提示词变量名（内置变量表见 docs/ARCHITECTURE.md「变量表」）。 */
export type SystemVariableName =
  | 'cur_date'
  | 'cur_time'
  | 'cur_datetime'
  | 'model_id'
  | 'model_name'
  | 'timezone'
  | 'locale'
  | 'user_name'
  | 'assistant_name'
  | 'assistant_tags'
  | 'workspace'
  | 'chat_count'
  | 'last_chat_time'
  | 'elapsed_since_last'

/** 系统提示词配置。 */
export interface SystemPromptConfig {
  /** 系统提示词模板，支持 {{var}} 与 {var} 双语法（见 ARCHITECTURE「变量表」）。 */
  template: string
  /** 用户自定义变量（覆盖同名的内置变量）。 */
  customVariables: Record<string, string>
}

/** 快捷回复（一键发送的消息模板）。 */
export interface QuickReply {
  id: string
  /** 按钮标题。 */
  label: string
  /** 点击后发送的正文。 */
  text: string
}

/** 注入块位置（相对系统提示词块；role 决定注入成哪类消息）。 */
export type InjectionPosition = 'before' | 'after' | 'replace'

/** 注入块触发方式（注入模式）。 */
export type InjectionTrigger = 'always' | 'keywords'

/**
 * 注入模式（Mode Injection）：固定片段，命中条件时注入到组装后的消息流。
 * 语义参考 RikkaHub mode injection + 世界书常驻条目（constant active）。
 */
export interface InjectionBlock {
  id: string
  /** 注入成哪一类消息（role 为 'user' 时注入为 user 消息，'assistant' 时为 assistant 消息，'system' 时并入系统提示词段）。 */
  role: MessageRole
  /** 相对位置：before = 系统提示词之前；after = 系统提示词之后（最常见）；replace = 替换系统提示词。 */
  position: InjectionPosition
  /** always = 无条件注入；keywords = 命中关键词才注入。 */
  trigger: InjectionTrigger
  /** trigger 为 keywords 时的触发词（对最近若干条历史消息做匹配，见 ARCHITECTURE「世界书」）。 */
  keywords: string[]
  enabled: boolean
  /** 注入内容（可含 {{var}} 占位符）。 */
  content: string
}

/** 世界书条目在消息流中的插入位置。 */
export type WorldbookPosition = 'before' | 'after'

/**
 * 世界书条目（Lorebook）：关键词命中后注入设定资料。
 * 语义参考 RikkaHub lorebook：keys 命中 → 按 priority 降序 → 合并注入。
 */
export interface WorldbookEntry {
  id: string
  /** 触发关键词（大小写不敏感子串匹配），匹配最近 contextLimit 条历史消息。 */
  keys: string[]
  /** 注入内容（可含 {{var}} 占位符）。 */
  content: string
  /** 优先级（数字大者先注入、排前）。 */
  priority: number
  /** before = 插到最近 user 消息之前；after = 插到最近 user 消息之后。 */
  position: WorldbookPosition
  enabled: boolean
}

/** Skill 引用（注册表里的技能开关）。name 对齐 ctx.skills.list() 的 SkillSummary.name。 */
export interface SkillRef {
  /** 本地引用 id（在助手档案内唯一）。 */
  id: string
  /** 技能名（ctx.skills.list() 返回的 name）。 */
  name: string
  /** 展示用描述（ctx.skills.list() 返回的 description / whenToUse）。 */
  description: string
  enabled: boolean
}

/** 记忆配置（开关/全局池/参考聊天/时间感知）。 */
export interface MemoryConfig {
  /** 记忆总开关。 */
  enabled: boolean
  /** true = 使用全局记忆池（global-memory.jsonl）；false = 使用助手私有池。 */
  globalMemory: boolean
  /** 是否参考聊天记录（最近会话摘要/历史相关性，见 ARCHITECTURE「记忆」）。 */
  useChatHistory: boolean
  /**
   * 时间感知开关（纠偏 design：原 gapReminderMinutes 时间间隔提醒已废弃移除）。
   * 开 → 在 system 末尾追加一行**自然上下文**（当前时间 + 上次对话时间/间隔），
   * 不生成刻意 `[时间提醒]` 消息、不使用命令式口吻；关 → 不注入。
   * 时间源：host 侧 session/event 的 user/message（event.time）维护 lastChatTs。
   * 变量：{{cur_datetime}} / {{last_chat_time}} / {{elapsed_since_last}}。默认 true。
   */
  timeAwareness: boolean
}

/**
 * 会话级选择状态（selection.json 中一条；主会话内助手激活的依据）。
 *
 * 语义：assistantId 非 null = 该 DSH 会话选中了助手 → host 在 llm/stream 主会话
 * 请求（sessionId 精确匹配 + purpose 为 undefined）上注入人设/模型参数/世界书/
 * 记忆/时间感知；assistantId null（或 selection.json 无条目）= 完全原生路径，零开销。
 *
 * 会话隔离：sessionId 是 DSH 主会话 id；subagent 用独立随机 id、compaction/session-title
 * 带 purpose，均不命中本选择（见 docs/ARCHITECTURE-ACTIVATION.md §2/§4）。
 */
export interface SessionSelection {
  /** DSH 主会话 id（字符串；与 DSH SessionId 一致，插件侧不再二次品牌化）。 */
  sessionId: string
  /** 选中的助手 id；null = 未激活（恢复原生对话）。 */
  assistantId: AssistantId | null
  /** 最近一次用户对话时间（epoch 毫秒；session/event user/message 的 event.time）；无 = null。 */
  lastChatTs: number | null
}

/** 助手档案（身份信息）。 */
export interface AssistantProfile {
  id: AssistantId
  /** 助手名称。 */
  name: string
  /** 头像：dataURL（如 data:image/png;base64,...）或 http(s)/相对 URL；空串 = 无头像。 */
  avatar: string
  /** 标签（用于过滤/检索）。 */
  tags: string[]
  /** 绑定工作区（WorkspaceId，对齐 ctx.workspaceRegistry）。空串 = 未绑定。 */
  workspace: WorkspaceId | ''
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** 助手全集配置 = 身份 + 模型参数 + 提示词 + 扩展 + 记忆。 */
export interface AssistantConfig {
  /** 助手 id。不变式：`config.id === config.profile.id`。 */
  id: AssistantId
  profile: AssistantProfile
  modelParams: ModelParams
  systemPrompt: SystemPromptConfig
  quickReplies: QuickReply[]
  /** 注入模式列表（全部打开状态以 enabled 为准）。 */
  injections: InjectionBlock[]
  /** 世界书条目列表。 */
  worldbook: WorldbookEntry[]
  /** 启用的 skill 列表。 */
  skills: SkillRef[]
  memory: MemoryConfig
}

/**
 * @deprecated chats 退役（纠偏改造）：聊天记录由 DSH 会话本身承载，本插件不再
 * 维护独立聊天历史。禁止新代码使用；host/client 工程师移除 ChatStore、
 * /chat /chats 端点与聊天窗 UI 后删除本类型。
 */
export interface ChatMessage {
  id: Brand<string, 'MessageId'>
  role: MessageRole
  /** 文本内容（纯文本；多模态/图片后续版本扩展）。 */
  content: string
  /** 消息时间戳（epoch 毫秒）。 */
  ts: Timestamp
  /** 该消息的 token 数（可选；assistant 消息由 usage 回填，user 消息由预估填充）。 */
  tokens?: number
}

/**
 * @deprecated 同上（chats 退役）。禁止新代码使用；随聊天存储与端点移除后删除。
 */
export interface ChatSession {
  id: ChatId
  /** 所属助手。 */
  assistantId: AssistantId
  /** 会话标题（LLM 生成或首条消息摘要）。 */
  title: string
  createdAt: Timestamp
  updatedAt: Timestamp
  messages: ChatMessage[]
}

/** 全局记忆条目（global-memory.jsonl 的一行）。 */
export interface GlobalMemoryEntry {
  id: MemoryEntryId
  /** 记忆内容（事实/偏好等短文本）。 */
  content: string
  ts: Timestamp
  /** 可选标签（来源助手名、主题等）。 */
  tags?: string[]
}

/** 助手私有记忆条目（助手私有记忆池的一行）。 */
export interface AssistantMemoryEntry extends GlobalMemoryEntry {
  /** 所属助手 id。 */
  assistantId: AssistantId
}

/** 从 assistant 原始配置中挑选出的、可被 quickReply 快捷消息直接使用的展开式。 */
export interface AssistantSummary {
  id: AssistantId
  name: string
  avatar: string
  tags: string[]
  workspace: WorkspaceId | ''
  updatedAt: Timestamp
}
