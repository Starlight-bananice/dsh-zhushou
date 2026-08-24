/** API 根路径（与 host 注册的 prefix 路由一致；不含尾部斜杠）。 */
export const API_BASE = '/assistant-panel/api';
/** @deprecated 同上（聊天 SSE 退役）。 */
export const CHAT_EVENT_TYPES = [
    'connected', 'text-delta', 'reasoning-delta', 'tool-call-delta', 'memory-saved', 'done', 'error',
];
//# sourceMappingURL=contracts.js.map