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
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from 'cordis';
import { type ApiErrorCode } from './shared/contracts.ts';
import type { AssistantStore, MemoryStore, SettingsStore } from './store.ts';
import type { SelectionStore } from './selection.ts';
import type { RuntimeContext } from './prompt.ts';
/** 路由处理器依赖集合。 */
export interface ApiDeps {
    ctx: Context;
    llm: import('@deepseek-ai/dsh-llm').default;
    assistants: AssistantStore;
    selection: SelectionStore;
    memory: MemoryStore;
    settings: SettingsStore;
    dataDir: string;
    pluginVersion: string;
    startedAt: number;
    runtime: RuntimeContext;
}
/** 统一 JSON 响应。 */
declare function json(res: ServerResponse, status: number, body: unknown): void;
/** 成功信封。 */
declare function ok<T>(res: ServerResponse, data: T): void;
/** 失败信封。 */
declare function fail(res: ServerResponse, status: number, code: ApiErrorCode, message: string, details?: unknown): void;
/** 读取请求体（JSON）。 */
declare function readBody(req: IncomingMessage): Promise<string>;
/** 解析 JSON body；失败抛 BAD_REQUEST。 */
declare function parseJsonBody<T>(req: IncomingMessage): Promise<T>;
/**
 * 注册 /assistant-panel/api 前缀路由。
 * 内部按「方法 + 路径段」分派。
 */
export declare function registerApiRoutes(ctx: Context, deps: ApiDeps): () => void;
export declare const _internal: {
    json: typeof json;
    ok: typeof ok;
    fail: typeof fail;
    readBody: typeof readBody;
    parseJsonBody: typeof parseJsonBody;
};
export {};
