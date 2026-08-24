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
import { detectUserName } from "./store.js";
/** 世界书 token 预算（超预算条目从低优先级截断丢弃）。 */
export const WB_TOKEN_BUDGET = 1024;
// ─────────────────────────────────────────────────────────────────────────────
// 时间格式化
// ─────────────────────────────────────────────────────────────────────────────
/** 格式化本地日期（YYYY-MM-DD）。 */
export function formatDate(ts, timezone) {
    try {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(ts);
        const get = (t) => parts.find(p => p.type === t)?.value ?? '';
        return `${get('year')}-${get('month')}-${get('day')}`;
    }
    catch {
        return new Date(ts).toISOString().slice(0, 10);
    }
}
/** 格式化本地时间（HH:MM）。 */
export function formatTime(ts, timezone) {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(ts);
        const get = (t) => parts.find(p => p.type === t)?.value ?? '';
        return `${get('hour')}:${get('minute')}`;
    }
    catch {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
}
/** 解析时区：设置优先 → 系统 Intl。 */
export function resolveTimezone(setting) {
    if (setting && setting.trim() !== '')
        return setting;
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    catch {
        return 'UTC';
    }
}
/** 获取工作区标题（未绑定/不存在返回空串）。 */
export function workspaceTitle(ctx, workspaceId) {
    if (!workspaceId)
        return '';
    try {
        const registry = ctx.workspaceRegistry;
        return registry?.get(workspaceId)?.title ?? '';
    }
    catch {
        return '';
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// 变量表 / 模板替换
// ─────────────────────────────────────────────────────────────────────────────
/** 构建变量表（含 customVariables 覆盖）。 */
export function buildVariableTable(input) {
    const { runtime, assistant, modelInfo, chatCount, ts } = input;
    const { ctx, profile, lastRoute, defaultRoute } = runtime;
    const now = ts ?? Date.now();
    const timezone = resolveTimezone(profile.timezone);
    const locale = profile.locale || 'zh';
    const modelProvider = assistant.modelParams.provider ?? lastRoute?.provider ?? defaultRoute.provider;
    const model = assistant.modelParams.model || lastRoute?.model || defaultRoute.model;
    const modelName = modelInfo?.name ?? (model || modelProvider);
    const vars = {
        cur_date: formatDate(now, timezone),
        cur_time: formatTime(now, timezone),
        cur_datetime: `${formatDate(now, timezone)} ${formatTime(now, timezone)}`,
        model_id: model || '',
        model_name: modelName || model || '',
        timezone,
        locale,
        user_name: profile.userName || detectUserName(),
        assistant_name: assistant.profile.name,
        assistant_tags: assistant.profile.tags.join(', '),
        workspace: workspaceTitle(ctx, assistant.profile.workspace),
        chat_count: String(chatCount),
    };
    // customVariables 覆盖内置变量
    const custom = assistant.systemPrompt.customVariables ?? {};
    for (const [k, v] of Object.entries(custom)) {
        vars[k] = v;
    }
    return vars;
}
/**
 * 模板替换：{{name}} 与 {name} 双语法单遍替换。
 * 未识别的占位符原样保留。
 */
export function resolveTemplate(template, vars) {
    if (!template)
        return '';
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, name) => {
        return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m;
    }).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, name) => {
        return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m;
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// 关键词匹配 / 世界书
// ─────────────────────────────────────────────────────────────────────────────
/** 大小写不敏感子串匹配：任一 keyword 命中 text 即 true。 */
export function matchKeywords(keywords, text) {
    const lower = text.toLowerCase();
    return keywords.some(kw => kw && lower.includes(kw.toLowerCase()));
}
/** 粗估文本 token 数（汉字/词近似）。 */
export function estimateTokens(text) {
    const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) ?? []).length;
    const rest = text.replace(/[\u4e00-\u9fff\u3040-\u30ff]/g, ' ');
    const words = rest.split(/\s+/).filter(Boolean).length;
    return cjk + Math.ceil(words * 1.3);
}
/** 世界书命中 + 排序 + token 预算截断。 */
export function matchWorldbook(entries, historyText) {
    const hit = entries.filter((e) => e.enabled && matchKeywords(e.keys, historyText));
    hit.sort((a, b) => b.priority - a.priority);
    let budget = WB_TOKEN_BUDGET;
    const kept = [];
    for (const entry of hit) {
        const cost = estimateTokens(entry.content);
        if (cost > budget)
            continue;
        kept.push(entry);
        budget -= cost;
    }
    return kept;
}
//# sourceMappingURL=prompt.js.map