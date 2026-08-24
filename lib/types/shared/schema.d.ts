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
import type { AssistantConfig, ChatMessage, GlobalMemoryEntry } from './types.ts';
import type { CreateAssistantInput } from './contracts.ts';
/** 从 schemastery schema 推断输出类型（`Schema<S,T>` 可调用，返回 T）。 */
export type Infer<S> = S extends (...args: any[]) => infer T ? T : never;
export declare const ReasoningEffortSchema: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
export declare const ModelParamsSchema: z<Schemastery.ObjectS<{
    /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
    provider: z<string | null, string | null>;
    /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
    model: z<string, string>;
    /** 温度 0–2（默认 1.0 = 模型默认）。 */
    temperature: z<number, number>;
    /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
    topP: z<number, number>;
    /** 思考强度，默认 auto。 */
    reasoningEffort: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
    /** null = 无限制（不传 maxTokens）。 */
    maxTokens: z<number | null, number | null>;
    /** 流式输出，默认开。 */
    stream: z<boolean, boolean>;
    /** 携带的历史消息条数；0 = 全部。默认 20。 */
    contextLimit: z<number, number>;
}>, Schemastery.ObjectT<{
    /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
    provider: z<string | null, string | null>;
    /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
    model: z<string, string>;
    /** 温度 0–2（默认 1.0 = 模型默认）。 */
    temperature: z<number, number>;
    /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
    topP: z<number, number>;
    /** 思考强度，默认 auto。 */
    reasoningEffort: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
    /** null = 无限制（不传 maxTokens）。 */
    maxTokens: z<number | null, number | null>;
    /** 流式输出，默认开。 */
    stream: z<boolean, boolean>;
    /** 携带的历史消息条数；0 = 全部。默认 20。 */
    contextLimit: z<number, number>;
}>>;
export type ModelParamsOut = Infer<typeof ModelParamsSchema>;
export declare const SystemPromptConfigSchema: z<Schemastery.ObjectS<{
    /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
    template: z<string, string>;
    /** 自定义变量（覆盖内置同名变量）。 */
    customVariables: z<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>>;
}>, Schemastery.ObjectT<{
    /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
    template: z<string, string>;
    /** 自定义变量（覆盖内置同名变量）。 */
    customVariables: z<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>>;
}>>;
export type SystemPromptConfigOut = Infer<typeof SystemPromptConfigSchema>;
export declare const QuickReplySchema: z<Schemastery.ObjectS<{
    id: z<string, string>;
    /** 按钮标题。 */
    label: z<string, string>;
    /** 发送正文。 */
    text: z<string, string>;
}>, Schemastery.ObjectT<{
    id: z<string, string>;
    /** 按钮标题。 */
    label: z<string, string>;
    /** 发送正文。 */
    text: z<string, string>;
}>>;
export type QuickReplyOut = Infer<typeof QuickReplySchema>;
export declare const InjectionPositionSchema: z<"before" | "after" | "replace", "before" | "after" | "replace">;
export declare const InjectionTriggerSchema: z<"always" | "keywords", "always" | "keywords">;
export declare const InjectionBlockSchema: z<Schemastery.ObjectS<{
    id: z<string, string>;
    role: z<"user" | "assistant" | "system", "user" | "assistant" | "system">;
    position: z<"before" | "after" | "replace", "before" | "after" | "replace">;
    trigger: z<"always" | "keywords", "always" | "keywords">;
    keywords: z<string[], string[]>;
    enabled: z<boolean, boolean>;
    content: z<string, string>;
}>, Schemastery.ObjectT<{
    id: z<string, string>;
    role: z<"user" | "assistant" | "system", "user" | "assistant" | "system">;
    position: z<"before" | "after" | "replace", "before" | "after" | "replace">;
    trigger: z<"always" | "keywords", "always" | "keywords">;
    keywords: z<string[], string[]>;
    enabled: z<boolean, boolean>;
    content: z<string, string>;
}>>;
export type InjectionBlockOut = Infer<typeof InjectionBlockSchema>;
export declare const WorldbookPositionSchema: z<"before" | "after", "before" | "after">;
export declare const WorldbookEntrySchema: z<Schemastery.ObjectS<{
    id: z<string, string>;
    /** 触发关键词（子串匹配，大小写不敏感）。 */
    keys: z<string[], string[]>;
    content: z<string, string>;
    /** 优先级：数字大者先注入。 */
    priority: z<number, number>;
    position: z<"before" | "after", "before" | "after">;
    enabled: z<boolean, boolean>;
}>, Schemastery.ObjectT<{
    id: z<string, string>;
    /** 触发关键词（子串匹配，大小写不敏感）。 */
    keys: z<string[], string[]>;
    content: z<string, string>;
    /** 优先级：数字大者先注入。 */
    priority: z<number, number>;
    position: z<"before" | "after", "before" | "after">;
    enabled: z<boolean, boolean>;
}>>;
export type WorldbookEntryOut = Infer<typeof WorldbookEntrySchema>;
export declare const SkillRefSchema: z<Schemastery.ObjectS<{
    id: z<string, string>;
    /** 技能名（ctx.skills.list() 的 name）。 */
    name: z<string, string>;
    description: z<string, string>;
    enabled: z<boolean, boolean>;
}>, Schemastery.ObjectT<{
    id: z<string, string>;
    /** 技能名（ctx.skills.list() 的 name）。 */
    name: z<string, string>;
    description: z<string, string>;
    enabled: z<boolean, boolean>;
}>>;
export type SkillRefOut = Infer<typeof SkillRefSchema>;
export declare const MemoryConfigSchema: z<Schemastery.ObjectS<{
    enabled: z<boolean, boolean>;
    /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
    globalMemory: z<boolean, boolean>;
    useChatHistory: z<boolean, boolean>;
    /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
    timeAwareness: z<boolean, boolean>;
}>, Schemastery.ObjectT<{
    enabled: z<boolean, boolean>;
    /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
    globalMemory: z<boolean, boolean>;
    useChatHistory: z<boolean, boolean>;
    /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
    timeAwareness: z<boolean, boolean>;
}>>;
export type MemoryConfigOut = Infer<typeof MemoryConfigSchema>;
/** POST /api/selection 请求体（sessionId 必填；assistantId null = 取消激活）。 */
export declare const SelectionInputSchema: z<Schemastery.ObjectS<{
    sessionId: z<string, string>;
    /** null = 取消激活（恢复原生对话）。 */
    assistantId: z<string | null, string | null>;
}>, Schemastery.ObjectT<{
    sessionId: z<string, string>;
    /** null = 取消激活（恢复原生对话）。 */
    assistantId: z<string | null, string | null>;
}>>;
export type SelectionInputOut = Infer<typeof SelectionInputSchema>;
export declare const AssistantProfileSchema: z<Schemastery.ObjectS<{
    id: z<string, string>;
    name: z<string, string>;
    /** dataURL 或 http(s)/相对 URL；空串 = 无头像。 */
    avatar: z<string, string>;
    tags: z<string[], string[]>;
    /** WorkspaceId 或 ''（未绑定）。 */
    workspace: z<string, string>;
    createdAt: z<number, number>;
    updatedAt: z<number, number>;
}>, Schemastery.ObjectT<{
    id: z<string, string>;
    name: z<string, string>;
    /** dataURL 或 http(s)/相对 URL；空串 = 无头像。 */
    avatar: z<string, string>;
    tags: z<string[], string[]>;
    /** WorkspaceId 或 ''（未绑定）。 */
    workspace: z<string, string>;
    createdAt: z<number, number>;
    updatedAt: z<number, number>;
}>>;
export type AssistantProfileOut = Infer<typeof AssistantProfileSchema>;
/** 创建助手时的输入（id/时间戳由 host 生成）。 */
export declare const CreateAssistantInputSchema: z<Schemastery.ObjectS<{
    profile: z<Schemastery.ObjectS<{
        name: z<string, string>;
        avatar: z<string, string>;
        tags: z<string[], string[]>;
        workspace: z<string, string>;
    }>, Schemastery.ObjectT<{
        name: z<string, string>;
        avatar: z<string, string>;
        tags: z<string[], string[]>;
        workspace: z<string, string>;
    }>>;
    modelParams: z<Schemastery.ObjectS<{
        /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
        provider: z<string | null, string | null>;
        /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
        model: z<string, string>;
        /** 温度 0–2（默认 1.0 = 模型默认）。 */
        temperature: z<number, number>;
        /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
        topP: z<number, number>;
        /** 思考强度，默认 auto。 */
        reasoningEffort: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
        /** null = 无限制（不传 maxTokens）。 */
        maxTokens: z<number | null, number | null>;
        /** 流式输出，默认开。 */
        stream: z<boolean, boolean>;
        /** 携带的历史消息条数；0 = 全部。默认 20。 */
        contextLimit: z<number, number>;
    }>, Schemastery.ObjectT<{
        /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
        provider: z<string | null, string | null>;
        /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
        model: z<string, string>;
        /** 温度 0–2（默认 1.0 = 模型默认）。 */
        temperature: z<number, number>;
        /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
        topP: z<number, number>;
        /** 思考强度，默认 auto。 */
        reasoningEffort: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
        /** null = 无限制（不传 maxTokens）。 */
        maxTokens: z<number | null, number | null>;
        /** 流式输出，默认开。 */
        stream: z<boolean, boolean>;
        /** 携带的历史消息条数；0 = 全部。默认 20。 */
        contextLimit: z<number, number>;
    }>>;
    systemPrompt: z<Schemastery.ObjectS<{
        /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
        template: z<string, string>;
        /** 自定义变量（覆盖内置同名变量）。 */
        customVariables: z<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>>;
    }>, Schemastery.ObjectT<{
        /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
        template: z<string, string>;
        /** 自定义变量（覆盖内置同名变量）。 */
        customVariables: z<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>>;
    }>>;
    quickReplies: z<({
        id?: string | null | undefined;
        label?: string | null | undefined;
        text?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 按钮标题。 */
        label: z<string, string>;
        /** 发送正文。 */
        text: z<string, string>;
    }>[]>;
    injections: z<({
        id?: string | null | undefined;
        role?: "user" | "assistant" | "system" | null | undefined;
        position?: "before" | "after" | "replace" | null | undefined;
        trigger?: "always" | "keywords" | null | undefined;
        keywords?: string[] | null | undefined;
        enabled?: boolean | null | undefined;
        content?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        role: z<"user" | "assistant" | "system", "user" | "assistant" | "system">;
        position: z<"before" | "after" | "replace", "before" | "after" | "replace">;
        trigger: z<"always" | "keywords", "always" | "keywords">;
        keywords: z<string[], string[]>;
        enabled: z<boolean, boolean>;
        content: z<string, string>;
    }>[]>;
    worldbook: z<({
        id?: string | null | undefined;
        keys?: string[] | null | undefined;
        content?: string | null | undefined;
        priority?: number | null | undefined;
        position?: "before" | "after" | null | undefined;
        enabled?: boolean | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 触发关键词（子串匹配，大小写不敏感）。 */
        keys: z<string[], string[]>;
        content: z<string, string>;
        /** 优先级：数字大者先注入。 */
        priority: z<number, number>;
        position: z<"before" | "after", "before" | "after">;
        enabled: z<boolean, boolean>;
    }>[]>;
    skills: z<({
        id?: string | null | undefined;
        name?: string | null | undefined;
        description?: string | null | undefined;
        enabled?: boolean | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 技能名（ctx.skills.list() 的 name）。 */
        name: z<string, string>;
        description: z<string, string>;
        enabled: z<boolean, boolean>;
    }>[]>;
    memory: z<Schemastery.ObjectS<{
        enabled: z<boolean, boolean>;
        /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
        globalMemory: z<boolean, boolean>;
        useChatHistory: z<boolean, boolean>;
        /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
        timeAwareness: z<boolean, boolean>;
    }>, Schemastery.ObjectT<{
        enabled: z<boolean, boolean>;
        /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
        globalMemory: z<boolean, boolean>;
        useChatHistory: z<boolean, boolean>;
        /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
        timeAwareness: z<boolean, boolean>;
    }>>;
}>, Schemastery.ObjectT<{
    profile: z<Schemastery.ObjectS<{
        name: z<string, string>;
        avatar: z<string, string>;
        tags: z<string[], string[]>;
        workspace: z<string, string>;
    }>, Schemastery.ObjectT<{
        name: z<string, string>;
        avatar: z<string, string>;
        tags: z<string[], string[]>;
        workspace: z<string, string>;
    }>>;
    modelParams: z<Schemastery.ObjectS<{
        /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
        provider: z<string | null, string | null>;
        /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
        model: z<string, string>;
        /** 温度 0–2（默认 1.0 = 模型默认）。 */
        temperature: z<number, number>;
        /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
        topP: z<number, number>;
        /** 思考强度，默认 auto。 */
        reasoningEffort: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
        /** null = 无限制（不传 maxTokens）。 */
        maxTokens: z<number | null, number | null>;
        /** 流式输出，默认开。 */
        stream: z<boolean, boolean>;
        /** 携带的历史消息条数；0 = 全部。默认 20。 */
        contextLimit: z<number, number>;
    }>, Schemastery.ObjectT<{
        /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
        provider: z<string | null, string | null>;
        /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
        model: z<string, string>;
        /** 温度 0–2（默认 1.0 = 模型默认）。 */
        temperature: z<number, number>;
        /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
        topP: z<number, number>;
        /** 思考强度，默认 auto。 */
        reasoningEffort: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
        /** null = 无限制（不传 maxTokens）。 */
        maxTokens: z<number | null, number | null>;
        /** 流式输出，默认开。 */
        stream: z<boolean, boolean>;
        /** 携带的历史消息条数；0 = 全部。默认 20。 */
        contextLimit: z<number, number>;
    }>>;
    systemPrompt: z<Schemastery.ObjectS<{
        /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
        template: z<string, string>;
        /** 自定义变量（覆盖内置同名变量）。 */
        customVariables: z<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>>;
    }>, Schemastery.ObjectT<{
        /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
        template: z<string, string>;
        /** 自定义变量（覆盖内置同名变量）。 */
        customVariables: z<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>>;
    }>>;
    quickReplies: z<({
        id?: string | null | undefined;
        label?: string | null | undefined;
        text?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 按钮标题。 */
        label: z<string, string>;
        /** 发送正文。 */
        text: z<string, string>;
    }>[]>;
    injections: z<({
        id?: string | null | undefined;
        role?: "user" | "assistant" | "system" | null | undefined;
        position?: "before" | "after" | "replace" | null | undefined;
        trigger?: "always" | "keywords" | null | undefined;
        keywords?: string[] | null | undefined;
        enabled?: boolean | null | undefined;
        content?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        role: z<"user" | "assistant" | "system", "user" | "assistant" | "system">;
        position: z<"before" | "after" | "replace", "before" | "after" | "replace">;
        trigger: z<"always" | "keywords", "always" | "keywords">;
        keywords: z<string[], string[]>;
        enabled: z<boolean, boolean>;
        content: z<string, string>;
    }>[]>;
    worldbook: z<({
        id?: string | null | undefined;
        keys?: string[] | null | undefined;
        content?: string | null | undefined;
        priority?: number | null | undefined;
        position?: "before" | "after" | null | undefined;
        enabled?: boolean | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 触发关键词（子串匹配，大小写不敏感）。 */
        keys: z<string[], string[]>;
        content: z<string, string>;
        /** 优先级：数字大者先注入。 */
        priority: z<number, number>;
        position: z<"before" | "after", "before" | "after">;
        enabled: z<boolean, boolean>;
    }>[]>;
    skills: z<({
        id?: string | null | undefined;
        name?: string | null | undefined;
        description?: string | null | undefined;
        enabled?: boolean | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 技能名（ctx.skills.list() 的 name）。 */
        name: z<string, string>;
        description: z<string, string>;
        enabled: z<boolean, boolean>;
    }>[]>;
    memory: z<Schemastery.ObjectS<{
        enabled: z<boolean, boolean>;
        /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
        globalMemory: z<boolean, boolean>;
        useChatHistory: z<boolean, boolean>;
        /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
        timeAwareness: z<boolean, boolean>;
    }>, Schemastery.ObjectT<{
        enabled: z<boolean, boolean>;
        /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
        globalMemory: z<boolean, boolean>;
        useChatHistory: z<boolean, boolean>;
        /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
        timeAwareness: z<boolean, boolean>;
    }>>;
}>>;
/** 助手全集配置（含 id，读/写/更新的落盘形状）。 */
export declare const AssistantConfigSchema: z<Schemastery.ObjectS<{
    id: z<string, string>;
    profile: z<Schemastery.ObjectS<{
        id: z<string, string>;
        name: z<string, string>;
        /** dataURL 或 http(s)/相对 URL；空串 = 无头像。 */
        avatar: z<string, string>;
        tags: z<string[], string[]>;
        /** WorkspaceId 或 ''（未绑定）。 */
        workspace: z<string, string>;
        createdAt: z<number, number>;
        updatedAt: z<number, number>;
    }>, Schemastery.ObjectT<{
        id: z<string, string>;
        name: z<string, string>;
        /** dataURL 或 http(s)/相对 URL；空串 = 无头像。 */
        avatar: z<string, string>;
        tags: z<string[], string[]>;
        /** WorkspaceId 或 ''（未绑定）。 */
        workspace: z<string, string>;
        createdAt: z<number, number>;
        updatedAt: z<number, number>;
    }>>;
    modelParams: z<Schemastery.ObjectS<{
        /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
        provider: z<string | null, string | null>;
        /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
        model: z<string, string>;
        /** 温度 0–2（默认 1.0 = 模型默认）。 */
        temperature: z<number, number>;
        /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
        topP: z<number, number>;
        /** 思考强度，默认 auto。 */
        reasoningEffort: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
        /** null = 无限制（不传 maxTokens）。 */
        maxTokens: z<number | null, number | null>;
        /** 流式输出，默认开。 */
        stream: z<boolean, boolean>;
        /** 携带的历史消息条数；0 = 全部。默认 20。 */
        contextLimit: z<number, number>;
    }>, Schemastery.ObjectT<{
        /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
        provider: z<string | null, string | null>;
        /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
        model: z<string, string>;
        /** 温度 0–2（默认 1.0 = 模型默认）。 */
        temperature: z<number, number>;
        /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
        topP: z<number, number>;
        /** 思考强度，默认 auto。 */
        reasoningEffort: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
        /** null = 无限制（不传 maxTokens）。 */
        maxTokens: z<number | null, number | null>;
        /** 流式输出，默认开。 */
        stream: z<boolean, boolean>;
        /** 携带的历史消息条数；0 = 全部。默认 20。 */
        contextLimit: z<number, number>;
    }>>;
    systemPrompt: z<Schemastery.ObjectS<{
        /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
        template: z<string, string>;
        /** 自定义变量（覆盖内置同名变量）。 */
        customVariables: z<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>>;
    }>, Schemastery.ObjectT<{
        /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
        template: z<string, string>;
        /** 自定义变量（覆盖内置同名变量）。 */
        customVariables: z<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>>;
    }>>;
    quickReplies: z<({
        id?: string | null | undefined;
        label?: string | null | undefined;
        text?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 按钮标题。 */
        label: z<string, string>;
        /** 发送正文。 */
        text: z<string, string>;
    }>[]>;
    injections: z<({
        id?: string | null | undefined;
        role?: "user" | "assistant" | "system" | null | undefined;
        position?: "before" | "after" | "replace" | null | undefined;
        trigger?: "always" | "keywords" | null | undefined;
        keywords?: string[] | null | undefined;
        enabled?: boolean | null | undefined;
        content?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        role: z<"user" | "assistant" | "system", "user" | "assistant" | "system">;
        position: z<"before" | "after" | "replace", "before" | "after" | "replace">;
        trigger: z<"always" | "keywords", "always" | "keywords">;
        keywords: z<string[], string[]>;
        enabled: z<boolean, boolean>;
        content: z<string, string>;
    }>[]>;
    worldbook: z<({
        id?: string | null | undefined;
        keys?: string[] | null | undefined;
        content?: string | null | undefined;
        priority?: number | null | undefined;
        position?: "before" | "after" | null | undefined;
        enabled?: boolean | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 触发关键词（子串匹配，大小写不敏感）。 */
        keys: z<string[], string[]>;
        content: z<string, string>;
        /** 优先级：数字大者先注入。 */
        priority: z<number, number>;
        position: z<"before" | "after", "before" | "after">;
        enabled: z<boolean, boolean>;
    }>[]>;
    skills: z<({
        id?: string | null | undefined;
        name?: string | null | undefined;
        description?: string | null | undefined;
        enabled?: boolean | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 技能名（ctx.skills.list() 的 name）。 */
        name: z<string, string>;
        description: z<string, string>;
        enabled: z<boolean, boolean>;
    }>[]>;
    memory: z<Schemastery.ObjectS<{
        enabled: z<boolean, boolean>;
        /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
        globalMemory: z<boolean, boolean>;
        useChatHistory: z<boolean, boolean>;
        /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
        timeAwareness: z<boolean, boolean>;
    }>, Schemastery.ObjectT<{
        enabled: z<boolean, boolean>;
        /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
        globalMemory: z<boolean, boolean>;
        useChatHistory: z<boolean, boolean>;
        /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
        timeAwareness: z<boolean, boolean>;
    }>>;
}>, Schemastery.ObjectT<{
    id: z<string, string>;
    profile: z<Schemastery.ObjectS<{
        id: z<string, string>;
        name: z<string, string>;
        /** dataURL 或 http(s)/相对 URL；空串 = 无头像。 */
        avatar: z<string, string>;
        tags: z<string[], string[]>;
        /** WorkspaceId 或 ''（未绑定）。 */
        workspace: z<string, string>;
        createdAt: z<number, number>;
        updatedAt: z<number, number>;
    }>, Schemastery.ObjectT<{
        id: z<string, string>;
        name: z<string, string>;
        /** dataURL 或 http(s)/相对 URL；空串 = 无头像。 */
        avatar: z<string, string>;
        tags: z<string[], string[]>;
        /** WorkspaceId 或 ''（未绑定）。 */
        workspace: z<string, string>;
        createdAt: z<number, number>;
        updatedAt: z<number, number>;
    }>>;
    modelParams: z<Schemastery.ObjectS<{
        /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
        provider: z<string | null, string | null>;
        /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
        model: z<string, string>;
        /** 温度 0–2（默认 1.0 = 模型默认）。 */
        temperature: z<number, number>;
        /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
        topP: z<number, number>;
        /** 思考强度，默认 auto。 */
        reasoningEffort: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
        /** null = 无限制（不传 maxTokens）。 */
        maxTokens: z<number | null, number | null>;
        /** 流式输出，默认开。 */
        stream: z<boolean, boolean>;
        /** 携带的历史消息条数；0 = 全部。默认 20。 */
        contextLimit: z<number, number>;
    }>, Schemastery.ObjectT<{
        /** null = 自动跟随主模型（'' 在 host 层归一化为 null）。 */
        provider: z<string | null, string | null>;
        /** 模型 id；provider 为 null 时可为 ''（跟随主模型）。 */
        model: z<string, string>;
        /** 温度 0–2（默认 1.0 = 模型默认）。 */
        temperature: z<number, number>;
        /** Top-p 0–1（RikkaHub 语义：null=模型默认 → 用 1.0 表示不约束）。⚠️ 见 ARCHITECTURE：暂不传给 llm.stream。 */
        topP: z<number, number>;
        /** 思考强度，默认 auto。 */
        reasoningEffort: z<"auto" | "off" | "low" | "medium" | "high" | "max", "auto" | "off" | "low" | "medium" | "high" | "max">;
        /** null = 无限制（不传 maxTokens）。 */
        maxTokens: z<number | null, number | null>;
        /** 流式输出，默认开。 */
        stream: z<boolean, boolean>;
        /** 携带的历史消息条数；0 = 全部。默认 20。 */
        contextLimit: z<number, number>;
    }>>;
    systemPrompt: z<Schemastery.ObjectS<{
        /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
        template: z<string, string>;
        /** 自定义变量（覆盖内置同名变量）。 */
        customVariables: z<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>>;
    }>, Schemastery.ObjectT<{
        /** 模板，支持 {{var}} 与 {var}；空串 = 无系统提示词段（仍有注入/skill/记忆段）。 */
        template: z<string, string>;
        /** 自定义变量（覆盖内置同名变量）。 */
        customVariables: z<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>>;
    }>>;
    quickReplies: z<({
        id?: string | null | undefined;
        label?: string | null | undefined;
        text?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 按钮标题。 */
        label: z<string, string>;
        /** 发送正文。 */
        text: z<string, string>;
    }>[]>;
    injections: z<({
        id?: string | null | undefined;
        role?: "user" | "assistant" | "system" | null | undefined;
        position?: "before" | "after" | "replace" | null | undefined;
        trigger?: "always" | "keywords" | null | undefined;
        keywords?: string[] | null | undefined;
        enabled?: boolean | null | undefined;
        content?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        role: z<"user" | "assistant" | "system", "user" | "assistant" | "system">;
        position: z<"before" | "after" | "replace", "before" | "after" | "replace">;
        trigger: z<"always" | "keywords", "always" | "keywords">;
        keywords: z<string[], string[]>;
        enabled: z<boolean, boolean>;
        content: z<string, string>;
    }>[]>;
    worldbook: z<({
        id?: string | null | undefined;
        keys?: string[] | null | undefined;
        content?: string | null | undefined;
        priority?: number | null | undefined;
        position?: "before" | "after" | null | undefined;
        enabled?: boolean | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 触发关键词（子串匹配，大小写不敏感）。 */
        keys: z<string[], string[]>;
        content: z<string, string>;
        /** 优先级：数字大者先注入。 */
        priority: z<number, number>;
        position: z<"before" | "after", "before" | "after">;
        enabled: z<boolean, boolean>;
    }>[]>;
    skills: z<({
        id?: string | null | undefined;
        name?: string | null | undefined;
        description?: string | null | undefined;
        enabled?: boolean | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        id: z<string, string>;
        /** 技能名（ctx.skills.list() 的 name）。 */
        name: z<string, string>;
        description: z<string, string>;
        enabled: z<boolean, boolean>;
    }>[]>;
    memory: z<Schemastery.ObjectS<{
        enabled: z<boolean, boolean>;
        /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
        globalMemory: z<boolean, boolean>;
        useChatHistory: z<boolean, boolean>;
        /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
        timeAwareness: z<boolean, boolean>;
    }>, Schemastery.ObjectT<{
        enabled: z<boolean, boolean>;
        /** 默认私有池（globalMemory=false，对齐 RikkaHub 默认）。 */
        globalMemory: z<boolean, boolean>;
        useChatHistory: z<boolean, boolean>;
        /** 时间感知开关（默认开）：system 末尾注入一行自然时间上下文；关 = 不注入。 */
        timeAwareness: z<boolean, boolean>;
    }>>;
}>>;
export type AssistantConfigOut = Infer<typeof AssistantConfigSchema>;
/**
 * 说明：schemastery object 的输出类型要求所有声明字段必填，故可选字段（tokens）不声明——
 * 未声明的键在校验时透传保留（ObjectS 含 Dict 索引签名），repository 层 load 后由 types 补齐可选语义。
 */
export declare const ChatMessageSchema: z<Schemastery.ObjectS<{
    id: z<string, string>;
    role: z<"user" | "assistant" | "system", "user" | "assistant" | "system">;
    content: z<string, string>;
    ts: z<number, number>;
}>, Schemastery.ObjectT<{
    id: z<string, string>;
    role: z<"user" | "assistant" | "system", "user" | "assistant" | "system">;
    content: z<string, string>;
    ts: z<number, number>;
}>>;
export type ChatMessageOut = Infer<typeof ChatMessageSchema>;
/** 可选字段 tags 不声明（同 ChatMessageSchema 的说明：未声明键透传保留）。 */
export declare const GlobalMemoryEntrySchema: z<Schemastery.ObjectS<{
    id: z<string, string>;
    content: z<string, string>;
    ts: z<number, number>;
}>, Schemastery.ObjectT<{
    id: z<string, string>;
    content: z<string, string>;
    ts: z<number, number>;
}>>;
export type GlobalMemoryEntryOut = Infer<typeof GlobalMemoryEntrySchema>;
export declare const PluginSettingsSchema: z<Schemastery.ObjectS<{
    /** 用户昵称（{{user_name}} 来源）。 */
    userName: z<string, string>;
    /** 语言覆盖；空 = 跟随平台 locale.preference。 */
    locale: z<string, string>;
    /** 时区覆盖；空 = 系统 Intl 探测。 */
    timezone: z<string, string>;
    /** 自定义数据目录；空 = ${DSH_HOME||~/.dsh}/dsh-assistant-panel。 */
    dataDir: z<string, string>;
}>, Schemastery.ObjectT<{
    /** 用户昵称（{{user_name}} 来源）。 */
    userName: z<string, string>;
    /** 语言覆盖；空 = 跟随平台 locale.preference。 */
    locale: z<string, string>;
    /** 时区覆盖；空 = 系统 Intl 探测。 */
    timezone: z<string, string>;
    /** 自定义数据目录；空 = ${DSH_HOME||~/.dsh}/dsh-assistant-panel。 */
    dataDir: z<string, string>;
}>>;
export type PluginSettingsOut = Infer<typeof PluginSettingsSchema>;
/** 校验 + 补默认值 → AssistantConfig（类型级与 types.ts 对齐）。 */
export declare function parseAssistantConfig(data: unknown): AssistantConfig;
/** 校验创建输入 → 返回可落盘形状的 Omit 部分。 */
export declare function parseCreateInput(data: unknown): CreateAssistantInput;
/** 校验聊天消息。 */
export declare function parseChatMessage(data: unknown): ChatMessage;
/** 校验全局记忆条目。 */
export declare function parseGlobalMemoryEntry(data: unknown): GlobalMemoryEntry;
/** 校验选择写入输入（POST /selection）。 */
export declare function parseSelectionInput(data: unknown): SelectionInputOut;
