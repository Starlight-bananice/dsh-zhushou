/**
 * @bananiceee/dsh-zhushou — 侧边栏助手插件（host 侧）。
 *
 * 入口职责：
 *  - 声明插件 name / inject（webServer、llm、settings 等）；
 *  - 插件级配置 schema（dataDir 等）；
 *  - 捕获主模型路由（llm/stream waterfall）→ lastRoute 兜底；
 *  - 会话级选择（selection.json）：session/event 订阅维护 lastChatTs；
 *  - **激活拦截**（llm/stream waterfall 短路）：选中助手 → 重建请求
 *    （系统提示词/消息注入/模型参数/上下文截断/时间感知）；
 *  - ctx.effect 挂载：存储层 + webServer 前缀路由 /assistant-panel/api。
 *
 * 数据目录：插件设置 dataDir → ${DSH_HOME || ~/.dsh}/dsh-assistant-panel。
 * 参考：dsh-status-bar（webServer 注册 + session/event 先例）、DESIGN-ACTIVATION §2（瀑布短路）。
 */
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import z from 'schemastery';
import { AssistantStore, MemoryStore, SettingsStore, resolveDataDir, } from "./store.js";
import { SelectionStore } from "./selection.js";
import { registerApiRoutes } from "./api.js";
import { rebuildActivatedRequest, MEMORY_CANDIDATES } from "./activate.js";
export const name = '@bananiceee/dsh-zhushou';
/** 实际用到的服务（webServer 路由、llm 调用、settings 读取、skills/workspace 枚举）。 */
export const inject = ['webServer', 'llm', 'settings', 'skills', 'workspaceRegistry'];
export const Config = z.object({
    dataDir: z.string().default(''),
});
/** 插件版本（对齐 package.json）。 */
const PLUGIN_VERSION = '0.0.1';
export function apply(ctx, config) {
    ctx.logger?.info?.('[' + name + '] 启动');
    // 解析数据目录（插件设置优先，其次配置项，其次缺省）
    const settingsStore = new SettingsStore(resolveDataDir(process.env.DSH_HOME));
    const { dataDir: settingsDataDir } = settingsStore.read();
    const effectiveDataDir = config.dataDir && config.dataDir.trim() !== ''
        ? config.dataDir
        : settingsDataDir;
    // store 实例
    const assistants = new AssistantStore(effectiveDataDir);
    const selectionStore = new SelectionStore(effectiveDataDir);
    const memory = new MemoryStore(effectiveDataDir);
    // defaultRoute：agentDefaultModel 服务 → settings 兜底 → 空占位
    const defaultRoute = resolveDefaultRoute(ctx);
    const startedAt = Date.now();
    const runtime = {
        ctx,
        profile: settingsStore.profile(),
        lastRoute: null,
        defaultRoute,
    };
    // 重入防护：本插件短路再派发（ctx.llm.stream(rebuilt)）时直接放行，防无限递归。
    // 注意：标记必须保持到 rebuilt 流「迭代结束」而非同步返回——拦截器返回的是惰性
    // AsyncIterable，同步返回后 finally 立即删除会让「迭代期间的重入（重试/内层再派发）」
    // 再次命中拦截器，造成 rebuilt→重试→再 rebuilt 的无限递归风暴（实测单次消息 7.8 万次
    // llm/stream 调用、事件循环耗尽、全 GUI 卡死）。
    const reentrant = new Set();
    /**
     * rebuilt 失败熔断：rebuilt 流以 error/aborted finish 收尾时，把该 session 熔断
     * `TRIPWIRE_MS` 毫秒——期间该会话的 llm/stream 走原生路径。目的：切断
     * 「rebuilt 失败 → agent-loop 重试原始请求 → 拦截器再次重建 → 再失败」的无限重试风暴。
     * 熔断只影响激活重建，不影响选择状态本身（用户仍可看到助手已选中）。
     */
    const TRIPWIRE_MS = 10_000;
    const tripwire = new Map();
    /**
     * 包装 rebuilt 流：① reentrant 标记保持到迭代结束（finally 删除）；
     * ② 检测 error/aborted finish → 写熔断。
     */
    function guardRebuiltStream(sessionKey, source) {
        return (async function* () {
            try {
                for await (const chunk of source) {
                    if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
                        tripwire.set(sessionKey, Date.now() + TRIPWIRE_MS);
                    }
                    yield chunk;
                }
            }
            finally {
                reentrant.delete(sessionKey);
            }
        })();
    }
    // 捕获主模型路由（waterfall 必须 next() 委托；重入请求不覆盖 lastRoute）
    ctx.on('llm/stream', (options, next) => {
        const sessionKey = String(options.sessionId ?? '');
        if (!reentrant.has(sessionKey)) {
            const r = { provider: options.provider, model: options.model };
            runtime.lastRoute = r;
        }
        return next();
    });
    // 会话事件 → lastChatTs 追踪（user/message；过滤 source.kind==='user' 排除注入上下文）
    ctx.on('session/event', (session, event) => {
        if (event.type !== 'user/message')
            return;
        const data = event.data;
        if (data?.source?.kind !== 'user')
            return;
        selectionStore.touch(String(session.id), event.time);
    });
    // ── 激活拦截（llm/stream waterfall 短路重建；DESIGN-ACTIVATION §2.3 形态）──
    // 过滤：sessionId 精确匹配 + purpose===undefined（排除 compaction/session-title/subagent）
    ctx.on('llm/stream', (options, next) => {
        // a. 内部调用（compaction/session-title）→ 原生
        if (options.purpose !== undefined)
            return next();
        // b. 选择状态：无条目 / assistantId 为 null → 原生
        const sessionKey = String(options.sessionId ?? '');
        const sel = selectionStore.get(sessionKey);
        if (!sel)
            return next();
        // c. 助手存在性：被删 → 清理选择 → 原生
        const assistant = assistants.get(sel.assistantId);
        if (!assistant) {
            selectionStore.clear(sessionKey);
            return next();
        }
        // 重入防护：本插件再派发直接放行
        if (reentrant.has(sessionKey))
            return next();
        // 失败熔断：rebuilt 最近失败过（error/aborted finish）→ 本窗口内走原生。
        // 阻断「rebuilt 失败 → 重试 → 再重建」的无限递归风暴（实测 7.8 万次递归）。
        const tripUntil = tripwire.get(sessionKey);
        if (tripUntil !== undefined && tripUntil > Date.now())
            return next();
        // d-e-f. 重建请求（模型覆盖 + system 追加 + 消息注入/截断）
        const memories = memory.recent(assistant.memory.globalMemory, assistant.memory.globalMemory ? undefined : assistant.id, MEMORY_CANDIDATES);
        const rebuilt = rebuildActivatedRequest({
            options,
            assistant,
            runtime,
            lastChatTs: sel.lastChatTs,
            memories: memories,
        });
        reentrant.add(sessionKey);
        return guardRebuiltStream(sessionKey, ctx.llm.stream(rebuilt));
    }, { global: true });
    // 注册 HTTP API（effect 绑定生命周期）
    const apiDeps = {
        ctx,
        llm: ctx.llm,
        assistants,
        selection: selectionStore,
        memory,
        settings: settingsStore,
        dataDir: effectiveDataDir,
        pluginVersion: PLUGIN_VERSION,
        startedAt,
        runtime,
    };
    ctx.effect(() => registerApiRoutes(ctx, apiDeps), name + ': api routes');
    ctx.logger?.info?.('[' + name + '] API 已注册：/assistant-panel/api（dataDir=' + effectiveDataDir + '）');
}
/** 解析默认模型路由：agentDefaultModel 服务 → settings 兜底 → 空占位。 */
function resolveDefaultRoute(ctx) {
    try {
        const svc = ctx.agentDefaultModel;
        const sel = svc?.currentSelection();
        if (sel?.provider && sel.model)
            return { provider: sel.provider, model: sel.model };
    }
    catch {
        // 忽略
    }
    try {
        const settingsSvc = ctx.settings;
        const raw = settingsSvc?.get(settingsNamespace('agent-default-model'));
        if (raw?.provider && raw.model)
            return { provider: raw.provider, model: raw.model };
    }
    catch {
        // 忽略
    }
    return { provider: '', model: '' };
}
//# sourceMappingURL=index.js.map