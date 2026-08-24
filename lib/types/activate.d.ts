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
import { type GenerateOptions, type LlmResolvedModelInfo, type Message } from '@deepseek-ai/dsh-llm';
import type { AssistantConfig } from './shared/types.ts';
import { type RuntimeContext } from './prompt.ts';
/** 记忆检索：最近取多少条候选。 */
declare const MEMORY_CANDIDATES = 50;
/** 记忆池候选条目（MemoryStore.recent 返回形状）。 */
export interface MemoryCandidate {
    id: string;
    content: string;
    ts: number;
    tags?: string[];
}
/**
 * 人类可读间隔（距上次对话）。语义：刚刚 / N 分钟 / N 小时 M 分钟 / N 天 / N 个月 / N 年。
 */
export declare function formatElapsed(from: number, now: number): string;
export interface ActivationVariablesInput {
    runtime: RuntimeContext;
    assistant: AssistantConfig;
    lastChatTs: number | null;
    /** 请求消息（chat_count 来源）。 */
    messages: Message[];
    modelInfo?: LlmResolvedModelInfo | null;
    /** 基准时间（默认 Date.now()）。 */
    ts?: number;
}
/**
 * 构建激活变量表 = 内置变量表 + {{last_chat_time}}/{{elapsed_since_last}}。
 * lastChatTs 为 null → 两变量均为 '未知'。
 */
export declare function buildActivationVars(input: ActivationVariablesInput): Record<string, string>;
export interface AssembleContextOptions {
    /** 请求消息（关键词触发 / chat_count / 首条 user 摘要）。 */
    messages?: Message[];
    /** 记忆池候选（最近 MEMORY_CANDIDATES 条；缺省不注入记忆段）。 */
    memories?: MemoryCandidate[];
    modelInfo?: LlmResolvedModelInfo | null;
    /** 基准时间（默认 Date.now()）。 */
    ts?: number;
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
export declare function assembleAssistantContext(assistant: AssistantConfig, runtime: RuntimeContext, lastChatTs: number | null, opts?: AssembleContextOptions): string;
/** 取消息文本（text 块拼接；tool-call/tool-result 等非文本块忽略）。 */
export declare function messageText(msg: Message): string;
/** 全部消息拼接文本（关键词触发 / 世界书匹配用）。 */
export declare function messagesText(messages: Message[]): string;
/** 最近一条 role==='user' 且 source.kind==='user'（人类输入）的消息；无则回退最近一条 role==='user'。 */
export declare function latestUserMessage(messages: Message[]): Message | undefined;
/**
 * 截断：取最近 N 条（0 = 全部）。pair 完整性：首条为 assistant（其 user 被裁掉）
 * 或 tool-result（其 tool-call assistant 被裁掉）时继续前移。
 */
export declare function truncateMessages(messages: Message[], contextLimit: number): Message[];
/**
 * 在截断后的消息流中注入 user/assistant 注入块（围绕最近一条用户消息；同 role 同位置
 * 多条合并为一条）。遵守 tool-call pair 约束：绝不插到「user 消息与其后紧跟 tool-call
 * 的 assistant 消息」之间。时间上下文（时间感知行）不插消息（只在 system 里）。
 *
 * @returns 新消息数组（注入后；长度可能与输入不同）
 */
export declare function injectMessages(assistant: AssistantConfig, messages: Message[], vars: Record<string, string>): Message[];
export interface RebuildActivatedRequestOptions {
    /** 原始主会话请求（deepFrozen；只读，不原地改）。 */
    options: GenerateOptions;
    assistant: AssistantConfig;
    runtime: RuntimeContext;
    /** selection.lastChatTs（时间感知数据源；null = 未知）。 */
    lastChatTs: number | null;
    /** 记忆池候选（最近 50 条；调用方从 MemoryStore.recent 预取）。 */
    memories: MemoryCandidate[];
    /** 基准时间（默认 Date.now()）。 */
    ts?: number;
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
export declare function rebuildActivatedRequest(opts: RebuildActivatedRequestOptions): GenerateOptions;
/** 记忆候选常量导出（index.ts 预取用）。 */
export { MEMORY_CANDIDATES };
