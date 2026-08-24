/**
 * dsh-assistant-panel — 提示词变量引擎（docs/ARCHITECTURE.md §4 变量表 + 世界书）。
 *
 * 纠偏改造后职责收窄：本文件只保留**变量解析与匹配工具**（时间格式化、变量表、
 * 模板替换、关键词匹配、世界书命中）；系统提示词/messages 的**组装**（含时间感知、
 * 注入块、记忆、截断）迁移到 src/activate.ts（assembleAssistantContext /
 * rebuildActivatedRequest），输入从旧「chat 历史数组」换成「主会话 llm/stream 请求」。
 *
 * 变量语法：{{name}} 与 {name} 双语法，customVariables 覆盖同名内置变量。
 * 变量表：内置变量（cur_date/cur_time/cur_datetime/model_id/model_name/timezone/locale/
 * user_name/assistant_name/assistant_tags/workspace/chat_count）+
 * 扩展变量（last_chat_time/elapsed_since_last，由 activate.ts 注入）。
 */
import type { Context } from 'cordis';
import type { LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm';
import type { AssistantConfig, WorldbookEntry } from './shared/types.ts';
/** 世界书 token 预算（超预算条目从低优先级截断丢弃）。 */
export declare const WB_TOKEN_BUDGET = 1024;
/** 宿主运行时上下文（由 index.ts 组装注入）。 */
export interface RuntimeContext {
    ctx: Context;
    /** 插件设置解析出的 profile（userName/locale/timezone/dataDir）。 */
    profile: {
        userName: string;
        locale: string;
        timezone: string;
        dataDir: string;
    };
    /** 最近一次主模型路由（llm/stream waterfall 捕获；可能为 null）。 */
    lastRoute: {
        provider: string;
        model: string;
    } | null;
    /** 当前会话的主模型路由解析（provider/model 空值时的兜底）。 */
    defaultRoute: {
        provider: string;
        model: string;
    };
}
/** 变量替换所需的运行时信息。 */
export interface TemplateVariablesInput {
    runtime: RuntimeContext;
    assistant: AssistantConfig;
    modelInfo: LlmResolvedModelInfo | null;
    chatCount: number;
    /** 基准时间戳（默认 Date.now()）。 */
    ts?: number;
}
/** 格式化本地日期（YYYY-MM-DD）。 */
export declare function formatDate(ts: number, timezone: string): string;
/** 格式化本地时间（HH:MM）。 */
export declare function formatTime(ts: number, timezone: string): string;
/** 解析时区：设置优先 → 系统 Intl。 */
export declare function resolveTimezone(setting: string): string;
/** 获取工作区标题（未绑定/不存在返回空串）。 */
export declare function workspaceTitle(ctx: Context, workspaceId: string): string;
/** 构建变量表（含 customVariables 覆盖）。 */
export declare function buildVariableTable(input: TemplateVariablesInput): Record<string, string>;
/**
 * 模板替换：{{name}} 与 {name} 双语法单遍替换。
 * 未识别的占位符原样保留。
 */
export declare function resolveTemplate(template: string, vars: Record<string, string>): string;
/** 大小写不敏感子串匹配：任一 keyword 命中 text 即 true。 */
export declare function matchKeywords(keywords: string[], text: string): boolean;
/** 粗估文本 token 数（汉字/词近似）。 */
export declare function estimateTokens(text: string): number;
/** 世界书命中 + 排序 + token 预算截断。 */
export declare function matchWorldbook(entries: WorldbookEntry[], historyText: string): WorldbookEntry[];
