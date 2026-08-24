/**
 * dsh-assistant-panel — HTTP API 路由（api.ts）。
 *
 * 注册在 ctx.webServer prefix 路由 /assistant-panel/api（见 src/shared/contracts.ts API_BASE）。
 * 统一信封 { ok: true, data } / { ok: false, error: { code, message, details? } }。
 * JSON 响应：content-type application/json + no-store + connection close（status-bar 先例）。
 * 聊天端点（/chat、/chats）已退役（纠偏改造）：聊天由 DSH 主会话承载；
 * host 只提供 /assistant-panel/api 下的 selection/assistants/memory/skills/models/workspaces/profile/health。
 * 错误码：BAD_REQUEST / NOT_FOUND / CONFLICT / UNSUPPORTED / LLM_ERROR / INTERNAL / ABORTED。
 */
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { API_BASE, } from "./shared/contracts.js";
import { uid } from "./store.js";
import { parseSelectionInput } from "./shared/schema.js";
/** 统一 JSON 响应。 */
function json(res, status, body) {
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'connection': 'close',
    });
    res.end(JSON.stringify(body));
}
/** 成功信封。 */
function ok(res, data) {
    json(res, 200, { ok: true, data });
}
/** 失败信封。 */
function fail(res, status, code, message, details) {
    json(res, status, { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } });
}
/** 读取请求体（JSON）。 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}
/** 解析 JSON body；失败抛 BAD_REQUEST。 */
async function parseJsonBody(req) {
    const text = await readBody(req);
    if (!text.trim())
        throw new Error('empty-body');
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error('invalid-json');
    }
}
/**
 * 注册 /assistant-panel/api 前缀路由。
 * 内部按「方法 + 路径段」分派。
 */
export function registerApiRoutes(ctx, deps) {
    return ctx.webServer.register({
        kind: 'prefix',
        path: API_BASE,
        handler: async (req, res) => {
            try {
                await dispatch(req, res, deps);
            }
            catch (e) {
                fail(res, 500, 'INTERNAL', String(e));
            }
        },
    });
}
/** 从 URL 提取路径段（相对 API_BASE）。 */
function segments(url) {
    const rest = url.pathname.slice(API_BASE.length);
    return rest.split('/').filter(Boolean);
}
async function dispatch(req, res, deps) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const seg = segments(url);
    const method = (req.method ?? 'GET').toUpperCase();
    const query = url.searchParams;
    // ── 健康检查 ──
    if (method === 'GET' && seg.length === 1 && seg[0] === 'health') {
        ok(res, {
            status: 'ok',
            pluginVersion: deps.pluginVersion,
            dataDir: deps.dataDir,
            uptimeMs: Date.now() - deps.startedAt,
        });
        return;
    }
    // ── 助手 CRUD ──
    if (seg[0] === 'assistants') {
        await dispatchAssistants(method, seg, query, req, res, deps);
        return;
    }
    // ── 会话级选择（selection）──
    if (seg[0] === 'selection') {
        await dispatchSelection(method, seg, query, req, res, deps);
        return;
    }
    // ── 记忆 ──
    if (seg[0] === 'memory') {
        await dispatchMemory(method, seg, query, req, res, deps);
        return;
    }
    // ── skills / models / workspaces / profile（只读枚举 + profile 读写）──
    if (seg[0] === 'skills' && method === 'GET') {
        await dispatchSkills(query, res, deps);
        return;
    }
    if (seg[0] === 'models' && method === 'GET') {
        await dispatchModels(res, deps);
        return;
    }
    if (seg[0] === 'workspaces' && method === 'GET') {
        await dispatchWorkspaces(res, deps);
        return;
    }
    if (seg[0] === 'profile') {
        await dispatchProfile(method, req, res, deps);
        return;
    }
    fail(res, 404, 'NOT_FOUND', 'unknown route: ' + method + ' ' + url.pathname);
}
// ─────────────────────────────────────────────────────────────────────────────
// 助手
// ─────────────────────────────────────────────────────────────────────────────
async function dispatchAssistants(method, seg, query, req, res, deps) {
    // GET /assistants
    if (method === 'GET' && seg.length === 1) {
        ok(res, { assistants: deps.assistants.summaries() });
        return;
    }
    // POST /assistants
    if (method === 'POST' && seg.length === 1) {
        let input;
        try {
            input = await parseJsonBody(req);
        }
        catch (e) {
            fail(res, 400, 'BAD_REQUEST', String(e));
            return;
        }
        if (!input.profile?.name) {
            fail(res, 400, 'BAD_REQUEST', '缺少 profile.name');
            return;
        }
        try {
            const assistant = deps.assistants.create(input);
            ok(res, { assistant });
        }
        catch (e) {
            fail(res, 400, 'BAD_REQUEST', '创建失败: ' + String(e));
        }
        return;
    }
    // /assistants/:id
    if (seg.length === 2) {
        const id = seg[1];
        if (method === 'GET') {
            const assistant = deps.assistants.get(id);
            if (!assistant) {
                fail(res, 404, 'NOT_FOUND', '助手不存在');
                return;
            }
            ok(res, { assistant });
            return;
        }
        if (method === 'PUT') {
            let patch;
            try {
                patch = await parseJsonBody(req);
            }
            catch (e) {
                fail(res, 400, 'BAD_REQUEST', String(e));
                return;
            }
            const updated = deps.assistants.update(id, patch);
            if (!updated) {
                fail(res, 404, 'NOT_FOUND', '助手不存在');
                return;
            }
            ok(res, { assistant: updated });
            return;
        }
        if (method === 'DELETE') {
            const existed = deps.assistants.get(id);
            if (!existed) {
                fail(res, 404, 'NOT_FOUND', '助手不存在');
                return;
            }
            deps.assistants.delete(id);
            // 连带删除私有记忆池
            deps.memory.list(false, id).forEach((entry) => {
                deps.memory.delete(entry.id, false, id);
            });
            // 连带清理所有会话级选择引用（选中该助手的会话恢复原生路径）
            deps.selection.removeAssistant(id);
            ok(res, { id });
            return;
        }
    }
    fail(res, 404, 'NOT_FOUND', 'assistants 路由不存在');
}
// ─────────────────────────────────────────────────────────────────────────────
// 会话级选择（selection）——主会话内助手激活/取消
// ─────────────────────────────────────────────────────────────────────────────
async function dispatchSelection(method, seg, query, req, res, deps) {
    // GET /selection?sessionId=xxx → 当前会话选择（无条目 → assistantId null / lastChatTs null）
    if (method === 'GET' && seg.length === 1) {
        const sessionId = query.get('sessionId') ?? '';
        if (!sessionId) {
            fail(res, 400, 'BAD_REQUEST', '缺少 sessionId');
            return;
        }
        const entry = deps.selection.get(sessionId);
        ok(res, {
            selection: entry
                ? { sessionId, assistantId: entry.assistantId, lastChatTs: entry.lastChatTs }
                : { sessionId, assistantId: null, lastChatTs: null },
        });
        return;
    }
    // POST /selection { sessionId, assistantId|null } → 激活/取消
    if (method === 'POST' && seg.length === 1) {
        let body;
        try {
            body = await parseJsonBody(req);
        }
        catch (e) {
            fail(res, 400, 'BAD_REQUEST', String(e));
            return;
        }
        let input;
        try {
            input = parseSelectionInput(body);
        }
        catch (e) {
            fail(res, 400, 'BAD_REQUEST', '参数校验失败: ' + String(e));
            return;
        }
        if (input.assistantId !== null && !deps.assistants.get(input.assistantId)) {
            fail(res, 404, 'NOT_FOUND', '助手不存在');
            return;
        }
        const selection = deps.selection.set(input.sessionId, input.assistantId);
        ok(res, { selection });
        return;
    }
    fail(res, 404, 'NOT_FOUND', 'selection 路由不存在');
}
// ─────────────────────────────────────────────────────────────────────────────
// 记忆
// ─────────────────────────────────────────────────────────────────────────────
/** 解析记忆请求的池选择：global=true 全局池；否则 assistantId 私有池。 */
function memoryPool(query) {
    const global = query.get('global') === 'true';
    const assistantId = (query.get('assistantId') ?? undefined);
    return { global, assistantId };
}
async function dispatchMemory(method, seg, query, req, res, deps) {
    const { global, assistantId } = memoryPool(query);
    // GET /memory?global=&assistantId=
    if (method === 'GET' && seg.length === 1) {
        const entries = deps.memory.list(global, assistantId);
        ok(res, { entries });
        return;
    }
    // POST /memory
    if (method === 'POST' && seg.length === 1) {
        let body;
        try {
            body = await parseJsonBody(req);
        }
        catch (e) {
            fail(res, 400, 'BAD_REQUEST', String(e));
            return;
        }
        if (!body.content || !body.content.trim()) {
            fail(res, 400, 'BAD_REQUEST', '缺少 content');
            return;
        }
        if (!global && !(body.assistantId ?? assistantId)) {
            fail(res, 400, 'BAD_REQUEST', '私有池缺少 assistantId');
            return;
        }
        const targetAssistant = global ? undefined : (body.assistantId ?? assistantId);
        const now = Date.now();
        const entry = {
            id: uid('mem'),
            content: body.content,
            ts: now,
            ...(body.tags && body.tags.length > 0 ? { tags: body.tags } : {}),
        };
        deps.memory.add(entry, global, targetAssistant);
        const out = global ? entry : { ...entry, assistantId: targetAssistant };
        ok(res, { entry: out });
        return;
    }
    // PUT /memory/:id
    if (method === 'PUT' && seg.length === 2) {
        const id = seg[1];
        let body;
        try {
            body = await parseJsonBody(req);
        }
        catch (e) {
            fail(res, 400, 'BAD_REQUEST', String(e));
            return;
        }
        const updated = deps.memory.update(id, body, global, assistantId);
        if (!updated) {
            fail(res, 404, 'NOT_FOUND', '记忆条目不存在');
            return;
        }
        ok(res, { entry: updated });
        return;
    }
    // DELETE /memory/:id
    if (method === 'DELETE' && seg.length === 2) {
        const id = seg[1];
        const existed = deps.memory.delete(id, global, assistantId);
        if (!existed) {
            fail(res, 404, 'NOT_FOUND', '记忆条目不存在');
            return;
        }
        ok(res, { id });
        return;
    }
    fail(res, 404, 'NOT_FOUND', 'memory 路由不存在');
}
// ─────────────────────────────────────────────────────────────────────────────
// skills / models / workspaces / profile
// ─────────────────────────────────────────────────────────────────────────────
async function dispatchSkills(query, res, deps) {
    const cwd = query.get('cwd') ?? undefined;
    let skills = [];
    try {
        const ctxSkills = deps.ctx.skills;
        if (ctxSkills) {
            const list = await ctxSkills.list(cwd ? { cwd } : {});
            skills = list.map((s) => ({
                name: s.name,
                description: s.description,
                ...(s.whenToUse ? { whenToUse: s.whenToUse } : {}),
                modelInvocable: s.invocation.modelInvocable,
                userInvocable: s.invocation.userInvocable,
                ...(s.provider ? { source: s.provider } : {}),
            }));
        }
    }
    catch (e) {
        ok(res, { skills: [], note: 'skill 服务不可用: ' + String(e) });
        return;
    }
    ok(res, { skills });
}
async function dispatchModels(res, deps) {
    try {
        const llm = deps.llm;
        const listProviders = llm.listProviders() ?? [];
        const current = deps.runtime.lastRoute ?? deps.runtime.defaultRoute;
        const providers = [];
        for (const p of listProviders) {
            const models = [];
            try {
                const list = await llm.listModels(p.id);
                for (const m of list) {
                    let resolved = null;
                    try {
                        resolved = await llm.resolveModelInfo(p.id, m.id);
                    }
                    catch {
                        resolved = null;
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
                    });
                }
            }
            catch {
                // 单 provider 枚举失败跳过
            }
            providers.push({ id: p.id, name: p.name, models });
        }
        ok(res, { providers });
    }
    catch {
        // llm 服务不可用 → 兜底 settings 目录（DESIGN：冷启动快照）
        const fallback = modelsFallback(deps);
        ok(res, { providers: fallback });
    }
}
/** 兜底：从 settings 服务读模型目录（llm-deepseek / llm-pi-ai 段，等同 settings.yaml 快照）。 */
function modelsFallback(deps) {
    const providers = [];
    try {
        const settingsSvc = deps.ctx.settings;
        // llm-deepseek: { models: [{ id, name, contextWindow, maxTokens }] }
        const ds = settingsSvc?.get(settingsNamespace('llm-deepseek'));
        if (ds?.models?.length) {
            providers.push({
                id: 'llm-deepseek',
                name: 'DeepSeek',
                models: ds.models.map((m) => ({ id: m.id, name: m.name ?? m.id, ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}), ...(m.maxTokens ? { maxTokens: m.maxTokens } : {}) })),
            });
        }
        // llm-pi-ai: { providers: { <name>: { models: [...] } } }
        const pi = settingsSvc?.get(settingsNamespace('llm-pi-ai'));
        if (pi?.providers) {
            for (const [name, entry] of Object.entries(pi.providers)) {
                if (!entry?.models?.length)
                    continue;
                providers.push({
                    id: name,
                    name,
                    models: entry.models.map((m) => ({ id: m.id, name: m.name ?? m.id, ...(m.contextWindow ? { contextWindow: m.contextWindow } : {}), ...(m.maxTokens ? { maxTokens: m.maxTokens } : {}) })),
                });
            }
        }
    }
    catch {
        // 任何失败返回空表
    }
    return providers;
}
async function dispatchWorkspaces(res, deps) {
    let workspaces = [];
    try {
        const registry = deps.ctx.workspaceRegistry;
        if (registry) {
            workspaces = registry.list().map((w) => ({ id: w.id, path: w.path, title: w.title }));
        }
    }
    catch {
        workspaces = [];
    }
    ok(res, { workspaces });
}
async function dispatchProfile(method, req, res, deps) {
    if (method === 'GET') {
        ok(res, { profile: deps.settings.profile() });
        return;
    }
    if (method === 'PUT') {
        let body;
        try {
            body = await parseJsonBody(req);
        }
        catch (e) {
            fail(res, 400, 'BAD_REQUEST', String(e));
            return;
        }
        const patch = {};
        if (body.userName !== undefined)
            patch.userName = body.userName;
        if (body.locale !== undefined)
            patch.locale = body.locale;
        if (body.timezone !== undefined)
            patch.timezone = body.timezone;
        const profile = deps.settings.update(patch);
        ok(res, {
            profile: {
                userName: profile.userName ?? '',
                locale: profile.locale ?? '',
                timezone: profile.timezone ?? '',
                dataDir: deps.dataDir,
            },
        });
        return;
    }
    fail(res, 404, 'NOT_FOUND', 'profile 路由不存在');
}
export const _internal = { json, ok, fail, readBody, parseJsonBody };
//# sourceMappingURL=api.js.map