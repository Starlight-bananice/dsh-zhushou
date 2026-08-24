/**
 * @bananiceee/dsh-zhushou — host 侧运行时校验 schema（schemastery）。
 *
 * ⚠️ 使用边界：
 *  - 本文件是 **host-only** 模块（import schemastery 运行时依赖，已在 peerDependencies）
 *  - **client 禁止 import 本文件**（浏览器打包不应携带 schemastery）；client 只 import ../shared/types.ts
 *  - 默认值全部落在本层（types.ts 是纯类型，不得含运行时默认值）
 *
 * 依赖：`import z from 'schemastery'`（默认导出，3.18.x）。
 * 说明：schemastery 无 `.nullable()` 构建器 → 可空字段用 `z.union([<base>, z.const(null)])` 表达。
 * 类型侧以 types.ts 为准；本层 schema 用于 host 校验与默认值注入（repository 层 `z.object(...)[data]` 调用即校验+补默认）。
 */
import z from 'schemastery';
/** 思考强度枚举（z.union 数组；host 侧输入校验，非法值抛 ValidationError）。 */
const REASONING_EFFORTS = ['auto', 'off', 'low', 'medium', 'high', 'max'];
/** 可空字符串：'' 或 null。 */
const nullableString = z.union([z.string(), z.const(null)]);
// ─────────────────────────────────────────────────────────────────────────────
// 模型参数
// ─────────────────────────────────────────────────────────────────────────────
export const ReasoningEffortSchema = z.union(REASONING_EFFORTS);
export const ModelParamsSchema = z.object({
    /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
    provider: nullableString,
    /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
    model: z.string().default(''),
    /** 温度 0–2（默认 1.0 = 模型默认）。 */
    temperature: z.number().min(0).max(2).default(1.0),
    /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
    topP: z.number().min(0).max(1).default(1.0),
    /** 思考强度，默认 auto。 */
    reasoningEffort: ReasoningEffortSchema.default('auto'),
    /** null = 无限制（不传 maxTokens）。 */
    maxTokens: z.union([z.number().min(1), z.const(null)]).default(null),
    /** 流式输出，默认开。 */
    stream: z.boolean().default(true),
    /** 携带的历史消息条数；0 = 全部。默认 20。 */
    contextLimit: z.natural().default(20),
});
// ─────────────────────────────────────────────────────────────────────────────
// 系统提示词
// ─────────────────────────────────────────────────────────────────────────────
export const SystemPromptConfigSchema = z.object({
    /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
    template: z.string().default(''),
    /** 自定义变量（覆盖内置同名变量）。 */
    customVariables: z.dict(z.string()).default({}),
});
// ─────────────────────────────────────────────────────────────────────────────
// 快捷回复
// ─────────────────────────────────────────────────────────────────────────────
export const QuickReplySchema = z.object({
    id: z.string(),
    /** 按钮标题。 */
    label: z.string(),
    /** 发送正文。 */
    text: z.string(),
});
// ─────────────────────────────────────────────────────────────────────────────
// 注入模式
// ─────────────────────────────────────────────────────────────────────────────
export const InjectionPositionSchema = z.union(['before', 'after', 'replace']);
export const InjectionTriggerSchema = z.union(['always', 'keywords']);
export const InjectionBlockSchema = z.object({
    id: z.string(),
    role: z.union(['system', 'user', 'assistant']),
    position: InjectionPositionSchema,
    trigger: InjectionTriggerSchema,
    keywords: z.array(z.string()).default([]),
    enabled: z.boolean().default(true),
    content: z.string(),
});
// ─────────────────────────────────────────────────────────────────────────────
// 世界书
// ─────────────────────────────────────────────────────────────────────────────
export const WorldbookPositionSchema = z.union(['before', 'after']);
export const WorldbookEntrySchema = z.object({
    id: z.string(),
    /** 触发关键词（子串匹配，大小写不敏感）。 */
    keys: z.array(z.string()).min(1),
    content: z.string(),
    /** 优先级：数字大者先注入。 */
    priority: z.number().default(0),
    position: WorldbookPositionSchema.default('before'),
    enabled: z.boolean().default(true),
});
// ─────────────────────────────────────────────────────────────────────────────
// Skill 引用
// ─────────────────────────────────────────────────────────────────────────────
export const SkillRefSchema = z.object({
    id: z.string(),
    /** 技能名（ctx.skills.list() 的 name）。 */
    name: z.string(),
    description: z.string().default(''),
    enabled: z.boolean().default(true),
});
// ─────────────────────────────────────────────────────────────────────────────
// 记忆配置
// ─────────────────────────────────────────────────────────────────────────────
export const MemoryConfigSchema = z.object({
    enabled: z.boolean().default(true),
    /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
    globalMemory: z.boolean().default(false),
    useChatHistory: z.boolean().default(false),
    /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
    timeAwareness: z.boolean().default(true),
});
// ─────────────────────────────────────────────────────────────────────────────
// 会话级选择（selection API）
// ─────────────────────────────────────────────────────────────────────────────
/** POST /api/selection 请求体（sessionId 必填；assistantId null = 取消激活）。 */
export const SelectionInputSchema = z.object({
    sessionId: z.string().required().description('DSH 主会话 id'),
    /** null = 取消激活（恢复原生对话）。 */
    assistantId: z.union([z.string().min(1), z.const(null)]).default(null),
});
// ─────────────────────────────────────────────────────────────────────────────
// 助手档案 / 配置
// ─────────────────────────────────────────────────────────────────────────────
export const AssistantProfileSchema = z.object({
    id: z.string(),
    name: z.string().required().description('助手名称'),
    /** dataURL 或 http(s)/相对 URL；空串 = 无头像。 */
    avatar: z.string().default(''),
    tags: z.array(z.string()).default([]),
    /** WorkspaceId 或 ''（未绑定）。 */
    workspace: z.string().default(''),
    createdAt: z.number(),
    updatedAt: z.number(),
});
/** 创建助手时的输入（id/时间戳由 host 生成）。 */
export const CreateAssistantInputSchema = z.object({
    profile: z.object({
        name: z.string().required(),
        avatar: z.string().default(''),
        tags: z.array(z.string()).default([]),
        workspace: z.string().default(''),
    }),
    modelParams: ModelParamsSchema,
    systemPrompt: SystemPromptConfigSchema,
    quickReplies: z.array(QuickReplySchema).default([]),
    injections: z.array(InjectionBlockSchema).default([]),
    worldbook: z.array(WorldbookEntrySchema).default([]),
    skills: z.array(SkillRefSchema).default([]),
    memory: MemoryConfigSchema,
});
/** 助手全集配置（含 id，读/写/更新的落盘形状）。 */
export const AssistantConfigSchema = z.object({
    id: z.string(),
    profile: AssistantProfileSchema,
    modelParams: ModelParamsSchema,
    systemPrompt: SystemPromptConfigSchema,
    quickReplies: z.array(QuickReplySchema).default([]),
    injections: z.array(InjectionBlockSchema).default([]),
    worldbook: z.array(WorldbookEntrySchema).default([]),
    skills: z.array(SkillRefSchema).default([]),
    memory: MemoryConfigSchema,
});
// ─────────────────────────────────────────────────────────────────────────────
// 聊天消息 / 记忆条目
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 说明：schemastery object 的输出类型要求所有声明字段必填，故可选字段（tokens）不声明——
 * 未声明的键在校验时透传保留（ObjectS 含 Dict 索引签名），repository 层 load 后由 types 补齐可选语义。
 */
export const ChatMessageSchema = z.object({
    id: z.string(),
    role: z.union(['user', 'assistant', 'system']),
    content: z.string(),
    ts: z.number(),
});
/** 可选字段 tags 不声明（同 ChatMessageSchema 的说明：未声明键透传保留）。 */
export const GlobalMemoryEntrySchema = z.object({
    id: z.string(),
    content: z.string().required(),
    ts: z.number(),
});
// ─────────────────────────────────────────────────────────────────────────────
// 插件级设置（settings.json / ctx.settings.section 形状）
// ─────────────────────────────────────────────────────────────────────────────
export const PluginSettingsSchema = z.object({
    /** 用户昵称（{{user_name}} 来源）。 */
    userName: z.string().default(''),
    /** 语言覆盖；空 = 跟随平台 locale.preference。 */
    locale: z.string().default(''),
    /** 时区覆盖；空 = 系统 Intl 探测。 */
    timezone: z.string().default(''),
    /** 自定义数据目录；空 = ${DSH_HOME||~/.dsh}/dsh-assistant-panel。 */
    dataDir: z.string().default(''),
});
// ─────────────────────────────────────────────────────────────────────────────
// 便捷校验函数（host repository 层调用；数据非法抛 ValidationError）
// ─────────────────────────────────────────────────────────────────────────────
/** 校验 + 补默认值 → AssistantConfig（类型级与 types.ts 对齐）。 */
export function parseAssistantConfig(data) {
    // 边界：schemastery 调用签名收 ObjectS 输入；unknown 在此显式收窄（校验由 schema 负责）
    return AssistantConfigSchema(data);
}
/** 校验创建输入 → 返回可落盘形状的 Omit 部分。 */
export function parseCreateInput(data) {
    return CreateAssistantInputSchema(data);
}
/** 校验聊天消息。 */
export function parseChatMessage(data) {
    return ChatMessageSchema(data);
}
/** 校验全局记忆条目。 */
export function parseGlobalMemoryEntry(data) {
    return GlobalMemoryEntrySchema(data);
}
/** 校验选择写入输入（POST /selection）。 */
export function parseSelectionInput(data) {
    return SelectionInputSchema(data);
}
//# sourceMappingURL=schema.js.map