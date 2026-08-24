window.__ModuleLoader__.load({
	id: "@bananiceee/dsh-zhushou",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/style.ts
		/**
		* dsh-assistant-panel client 样式（单 <style> 注入，类名前缀 dap-）。
		* 配色沿用 DSH status-bar 的 CSS 变量（--dsw-alias-*），主题无关。
		*/
		const STYLES = `
/* ── 侧边栏入口 ─────────────────────────────── */
.dap-side-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #c8ccd4);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.dap-side-action:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-secondary, #c8ccd4) 14%, transparent);
  color: var(--dsw-alias-label-primary, #e8eaee);
}
.dap-side-action[aria-expanded="true"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4176e6) 18%, transparent);
  color: var(--dsw-alias-brand-primary, #4176e6);
}
.dap-side-action-sel {
  color: var(--dsw-alias-brand-primary, #4176e6);
}

/* ── overlay 面板容器（侧边栏入口点开） ───────── */
.dap-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  /* shell.overlay 渲染在 AppFrame 的 click-through 层（pointer-events:none）里，
     必须显式恢复，否则面板所有点击都会穿透到下层应用 */
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #000000 38%, transparent);
  backdrop-filter: blur(2px);
}
.dap-overlay-panel {
  width: min(1080px, calc(100vw - 48px));
  height: min(720px, calc(100vh - 48px));
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 18px 60px color-mix(in srgb, #000000 42%, transparent);
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  background: var(--dsw-alias-bg-layer-1, #ffffff);
}

/* ── 助手面板总布局 ─────────────────────────── */
.dap-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: var(--dsw-alias-label-primary, #1a1d24);
  font-size: 13px;
  line-height: 1.5;
}
.dap-panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  flex: none;
}
.dap-panel-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dap-panel-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* ── 左侧助手列表 ───────────────────────────── */
.dap-assist-list {
  width: 232px;
  flex: none;
  border-right: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.dap-assist-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
}
.dap-assist-list-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-tertiary, #9aa0aa);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dap-assist-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dap-assist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 9px;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-primary, #1a1d24);
  text-align: left;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.dap-assist-item:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-secondary, #c8ccd4) 8%, transparent);
}
.dap-assist-item.active {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4176e6) 12%, transparent);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #4176e6) 30%, transparent);
}
.dap-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4176e6) 16%, transparent);
  color: var(--dsw-alias-brand-primary, #4176e6);
  font-size: 14px;
  font-weight: 600;
}
.dap-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.dap-assist-meta {
  min-width: 0;
  flex: 1;
}
.dap-assist-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dap-assist-tags {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #9aa0aa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dap-assist-ops {
  display: inline-flex;
  gap: 2px;
  flex: none;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.dap-assist-item:hover .dap-assist-ops {
  opacity: 1;
}
.dap-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6472);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.dap-iconbtn:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-secondary, #5b6472) 12%, transparent);
  color: var(--dsw-alias-label-primary, #1a1d24);
}
.dap-iconbtn.danger:hover {
  background: color-mix(in srgb, #e5484d 12%, transparent);
  color: #e5484d;
}

/* ── 右侧主区 ───────────────────────────────── */
.dap-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.dap-main-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
  flex: none;
}
.dap-main-title {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dap-seg {
  display: inline-flex;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  border-radius: 8px;
  overflow: hidden;
}
.dap-seg button {
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6472);
  font-size: 12px;
  padding: 4px 12px;
  cursor: pointer;
}
.dap-seg button.active {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4176e6) 14%, transparent);
  color: var(--dsw-alias-brand-primary, #4176e6);
  font-weight: 600;
}

/* ── 管理面板：选择状态条 ─────────────────────── */
.dap-sel-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
  background: var(--dsw-alias-bg-layer-2, #f4f5f7);
  flex: none;
}
.dap-sel-banner.active {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4176e6) 7%, var(--dsw-alias-bg-layer-2, #f4f5f7));
}
.dap-sel-text {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #5b6472);
  min-width: 0;
  flex: 1;
}
.dap-sel-text b {
  color: var(--dsw-alias-label-primary, #1a1d24);
  font-weight: 600;
}
.dap-sel-hint {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #9aa0aa);
  margin-left: 6px;
}
.dap-sel-badge {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 600;
  color: var(--dsw-alias-brand-primary, #4176e6);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4176e6) 13%, transparent);
  border-radius: 8px;
  padding: 0 6px;
  margin-left: 6px;
  vertical-align: 1px;
}
.dap-avatar.small {
  width: 26px;
  height: 26px;
  font-size: 12px;
  flex: none;
}
.dap-btn.tiny {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 6px;
}
.dap-panel-sub {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #9aa0aa);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dap-manage-body {
  min-height: 0;
}
.dap-manage-body .dap-assist-list {
  width: 100%;
  border-right: none;
}

/* ── 编辑器（管理面板内联编辑） ─────────────── */
.dap-editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.dap-editor-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
}
.dap-editor-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  flex: none;
}
.dap-editor-actions {
  display: flex;
  gap: 8px;
  flex: none;
}

/* ── 侧边栏入口（文字选项） ─────────────────── */
.dap-side-label {
  font-size: 12px;
  color: inherit;
  margin-left: 2px;
}
.dap-side-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary, #4176e6);
  margin-left: 1px;
  flex: none;
}

.dap-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: var(--dsw-alias-label-secondary, #5b6472);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
}
.dap-btn:hover:not(:disabled) {
  border-color: var(--dsw-alias-label-secondary, #5b6472);
  color: var(--dsw-alias-label-primary, #1a1d24);
}
.dap-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.dap-btn.primary {
  background: var(--dsw-alias-brand-primary, #4176e6);
  border-color: var(--dsw-alias-brand-primary, #4176e6);
  color: #ffffff;
}
.dap-btn.primary:hover:not(:disabled) {
  filter: brightness(1.06);
}
.dap-btn.danger {
  color: #e5484d;
  border-color: color-mix(in srgb, #e5484d 40%, transparent);
}
.dap-btn.danger:hover:not(:disabled) {
  background: color-mix(in srgb, #e5484d 9%, transparent);
  color: #e5484d;
}
.dap-btn.small {
  padding: 4px 10px;
  font-size: 11px;
}

/* ── 设置页 ─────────────────────────────────── */
.dap-set {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
}
.dap-set-intro {
  margin: 0 0 14px;
  color: var(--dsw-alias-label-secondary, #c8ccd4);
}
.dap-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.dap-field-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.dap-field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary, #5b6472);
}
.dap-field-hint {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #9aa0aa);
}
.dap-text,
.dap-select,
.dap-number {
  background: var(--dsw-alias-bg-layer-2, #f4f5f7);
  color: var(--dsw-alias-label-primary, #1a1d24);
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  box-sizing: border-box;
  font-family: inherit;
}
.dap-text:focus,
.dap-select:focus,
.dap-number:focus {
  outline: none;
  border-color: var(--dsw-alias-brand-primary, #4176e6);
}
.dap-select {
  cursor: pointer;
}
.dap-textarea {
  background: var(--dsw-alias-bg-layer-2, #f4f5f7);
  color: var(--dsw-alias-label-primary, #1a1d24);
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}
.dap-textarea:focus {
  outline: none;
  border-color: var(--dsw-alias-brand-primary, #4176e6);
}
.dap-check {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  font-size: 13px;
  color: var(--dsw-alias-label-primary, #1a1d24);
}
.dap-check input {
  accent-color: var(--dsw-alias-brand-primary, #4176e6);
}
.dap-range {
  width: 100%;
  accent-color: var(--dsw-alias-brand-primary, #4176e6);
}
.dap-range-val {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #5b6472);
  font-variant-numeric: tabular-nums;
  min-width: 44px;
  text-align: right;
}
.dap-section {
  margin: 16px 0 12px;
  padding-top: 14px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
}
.dap-section:first-of-type {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}
.dap-section-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 4px;
}
.dap-section-hint {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #9aa0aa);
  margin: 0 0 10px;
}

/* 标签编辑 */
.dap-tag-input-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.dap-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}
.dap-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4176e6) 12%, transparent);
  color: var(--dsw-alias-brand-primary, #4176e6);
}
.dap-chip button {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 12px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  opacity: 0.7;
}
.dap-chip button:hover {
  opacity: 1;
}

/* 列表编辑（注入/世界书/记忆/skill） */
.dap-edit-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dap-edit-card {
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
}
.dap-edit-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.dap-edit-card-head .dap-field-label {
  margin-right: auto;
}
.dap-edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.dap-edit-grid .wide {
  grid-column: 1 / -1;
}
.dap-add-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

/* 变量面板 */
.dap-var-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}
.dap-var-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6472);
  cursor: pointer;
}
.dap-var-chip:hover {
  border-color: var(--dsw-alias-brand-primary, #4176e6);
  color: var(--dsw-alias-brand-primary, #4176e6);
}
.dap-var-chip code {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 10px;
}

/* 记忆条目 */
.dap-mem-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  border-radius: 9px;
  padding: 8px 10px;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
}
.dap-mem-card p {
  flex: 1;
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 状态条 */
.dap-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 12px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
  flex: none;
}
.dap-status .ok { color: #1e8e3e; }
.dap-status .err { color: #e5484d; }
.dap-status .busy { color: var(--dsw-alias-label-tertiary, #9aa0aa); }
.dap-status button { margin-left: auto; }

/* 空/加载态 */
.dap-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px 20px;
  color: var(--dsw-alias-label-tertiary, #9aa0aa);
  font-size: 13px;
  flex: 1;
  text-align: center;
}
.dap-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--dsw-alias-label-tertiary, #9aa0aa);
  font-size: 13px;
}
.dap-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.18));
  border-top-color: var(--dsw-alias-brand-primary, #4176e6);
  border-radius: 50%;
  animation: dap-spin 0.7s linear infinite;
}
@keyframes dap-spin {
  to { transform: rotate(360deg); }
}
`;
		//#endregion
		//#region src/shared/contracts.ts
		/** API 根路径（与 host 注册的 prefix 路由一致；不含尾部斜杠）。 */
		const API_BASE = "/assistant-panel/api";
		//#endregion
		//#region src/client/api.ts
		/**
		* @bananiceee/dsh-zhushou — client API 层（host REST 唯一通道）。
		* 全部经 fetch(API_BASE + ...) 同源调用；信封解包 + 错误归一。
		* 聊天已退役（/chat、/chats 端点移除）：对话由 DSH 主会话承载，本层仅保留
		* 助手档案 / 会话级选择 / 记忆 / 枚举 / profile 的调用。
		* 零外部依赖（只 import 共享契约的纯类型 + API_BASE 常量）。
		*/
		/** 业务错误（信封 error 归一）。 */
		var ApiError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
				this.name = "ApiError";
			}
		};
		/** 从任意异常取展示文案。 */
		function apiErrorMessage(e) {
			if (e instanceof ApiError) return e.message;
			if (e instanceof Error) return e.message;
			return String(e);
		}
		/** 统一请求：解包信封；失败抛 ApiError。 */
		async function request(path, init) {
			const headers = new Headers(init?.headers);
			if (init?.body !== void 0) headers.set("content-type", "application/json");
			let res;
			try {
				res = await fetch(API_BASE + path, {
					...init,
					headers
				});
			} catch (e) {
				throw new ApiError("INTERNAL", "网络请求失败：" + (e instanceof Error ? e.message : String(e)));
			}
			let body;
			try {
				body = await res.json();
			} catch {
				throw new ApiError("INTERNAL", "响应解析失败（HTTP " + res.status + "）");
			}
			if (!body.ok) throw new ApiError(body.error.code, body.error.message);
			return body.data;
		}
		function listAssistants() {
			return request("/assistants");
		}
		function createAssistant(input) {
			return request("/assistants", {
				method: "POST",
				body: JSON.stringify(input)
			});
		}
		function getAssistant(id) {
			return request("/assistants/" + encodeURIComponent(id));
		}
		function updateAssistant(id, patch) {
			return request("/assistants/" + encodeURIComponent(id), {
				method: "PUT",
				body: JSON.stringify(patch)
			});
		}
		function deleteAssistant(id) {
			return request("/assistants/" + encodeURIComponent(id), { method: "DELETE" });
		}
		/** GET /selection?sessionId=xxx → 当前会话选择状态（无条目 → assistantId null）。 */
		function getSelection(sessionId) {
			return request("/selection?sessionId=" + encodeURIComponent(sessionId));
		}
		/** POST /selection → 激活（assistantId 非 null）/ 取消（null）。返回落盘后的状态。 */
		function setSelection(sessionId, assistantId) {
			return request("/selection", {
				method: "POST",
				body: JSON.stringify({
					sessionId,
					assistantId
				})
			});
		}
		function listMemory(query) {
			const q = new URLSearchParams();
			if (query.assistantId) q.set("assistantId", query.assistantId);
			if (query.global) q.set("global", "true");
			return request("/memory?" + q.toString());
		}
		function createMemory(req) {
			return request("/memory", {
				method: "POST",
				body: JSON.stringify(req)
			});
		}
		function deleteMemory(id) {
			return request("/memory/" + encodeURIComponent(id), { method: "DELETE" });
		}
		function listSkills() {
			return request("/skills");
		}
		function listModels() {
			return request("/models");
		}
		function listWorkspaces() {
			return request("/workspaces");
		}
		//#endregion
		//#region src/client/bus.ts
		let open = false;
		const listeners = /* @__PURE__ */ new Set();
		/** 订阅面板开合状态；返回取消订阅。 */
		function subscribePanel(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		}
		/** 打开助手面板。 */
		function openPanel() {
			open = true;
			listeners.forEach((fn) => fn(true));
		}
		/** 关闭助手面板。 */
		function closePanel() {
			open = false;
			listeners.forEach((fn) => fn(false));
		}
		/** 切换开合。 */
		function togglePanel() {
			if (open) closePanel();
			else openPanel();
		}
		/** 当前状态。 */
		function isPanelOpen() {
			return open;
		}
		//#endregion
		//#region src/client/SidebarEntry.tsx
		/**
		* 侧边栏 footer action 入口（sidebar.footer.action 注册，owner { wide }）。
		* 纠偏形态：宽模式渲染「图标 + 助手」文字按钮，窄模式仅图标；
		* 显示当前会话的助手选择状态（已选 → 图标高亮 + 小圆点）。
		* 点击 → 打开 shell.overlay 管理面板（经模块级总线 bus.ts 协调）。
		*/
		function SidebarEntry({ wide, useSessions }) {
			const sessionId = useSessions((s) => s.current);
			const [selected, setSelected] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!sessionId) {
					setSelected(false);
					return;
				}
				let cancelled = false;
				setSelected(false);
				(async () => {
					try {
						const { selection } = await getSelection(sessionId);
						if (cancelled) return;
						setSelected(selection.assistantId !== null);
					} catch (e) {
						if (cancelled) return;
						console.warn("[assistant-panel] 选择状态读取失败：", apiErrorMessage(e));
						setSelected(false);
					}
				})();
				return () => {
					cancelled = true;
				};
			}, [sessionId]);
			const open = isPanelOpen();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "dap-side-action" + (selected ? " dap-side-action-sel" : ""),
				title: selected ? "助手（当前会话已选助手）" : "助手",
				"aria-label": "助手",
				"aria-expanded": open,
				onClick: () => togglePanel(),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
						width: wide ? 16 : 18,
						height: wide ? 16 : 18,
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: 1.8,
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
								x: "4",
								y: "8",
								width: "16",
								height: "12",
								rx: "3"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 8V4" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								cx: "12",
								cy: "3",
								r: "1.2",
								fill: "currentColor",
								stroke: "none"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 14h.01M15 14h.01M9.5 17.5h5" })
						]
					}),
					wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dap-side-label",
						children: "助手"
					}),
					selected && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dap-side-dot",
						"aria-hidden": "true"
					})
				]
			});
		}
		//#endregion
		//#region src/client/defaults.ts
		/** 生成唯一 id（浏览器 crypto 优先，fallback 时间戳+随机）。 */
		function uid() {
			try {
				if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
			} catch {}
			return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
		}
		/** 默认助手配置（POST /assistants 请求体）；name 缺省给一个友好名。 */
		function defaultAssistantInput(name) {
			return {
				profile: {
					name: name?.trim() || "新助手",
					avatar: "",
					tags: [],
					workspace: ""
				},
				modelParams: {
					provider: null,
					model: "",
					temperature: .7,
					topP: 1,
					reasoningEffort: "auto",
					maxTokens: null,
					stream: true,
					contextLimit: 20
				},
				systemPrompt: {
					template: "你是 {assistant_name}，一个乐于助人的 AI 助手。",
					customVariables: {}
				},
				quickReplies: [],
				injections: [],
				worldbook: [],
				skills: [],
				memory: {
					enabled: false,
					globalMemory: true,
					useChatHistory: true,
					timeAwareness: true
				}
			};
		}
		/** 深拷贝助手配置（用于「复制助手」）。 */
		function cloneAssistantConfig(src) {
			return JSON.parse(JSON.stringify(src));
		}
		/** 系统提示词内置变量（与 docs/ARCHITECTURE.md §6 对齐，用于变量面板展示）。 */
		const SYSTEM_VARIABLES = [
			{
				name: "cur_date",
				description: "本地日期（如 2026-08-25）"
			},
			{
				name: "cur_time",
				description: "本地时间（如 14:30）"
			},
			{
				name: "cur_datetime",
				description: "本地日期时间完整串"
			},
			{
				name: "model_id",
				description: "本次使用的模型 id"
			},
			{
				name: "model_name",
				description: "模型显示名"
			},
			{
				name: "timezone",
				description: "时区（IANA，如 Asia/Shanghai）"
			},
			{
				name: "locale",
				description: "语言环境（如 zh）"
			},
			{
				name: "user_name",
				description: "用户昵称"
			},
			{
				name: "assistant_name",
				description: "助手名称"
			},
			{
				name: "assistant_tags",
				description: "助手标签（逗号分隔）"
			},
			{
				name: "workspace",
				description: "绑定工作区标题"
			},
			{
				name: "chat_count",
				description: "本会话消息条数"
			},
			{
				name: "last_chat_time",
				description: "上次用户对话的本地时间（无则空）"
			},
			{
				name: "elapsed_since_last",
				description: "距上次对话的人类可读间隔（无则空）"
			}
		];
		//#endregion
		//#region src/client/ui.tsx
		/**
		* 共享 UI 原子组件（dap-* 样式）。
		*/
		/** 行内 label + 控件场。 */
		function Field({ label, hint, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dap-field",
				children: [
					label !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dap-field-label",
						children: label
					}),
					children,
					hint !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dap-field-hint",
						children: hint
					})
				]
			});
		}
		/** 开关。 */
		function Toggle({ checked, onChange, label }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dap-check",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked,
					onChange: (e) => onChange(e.target.checked)
				}), label !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
			});
		}
		/** 文本输入。 */
		function TextInput({ value, onChange, placeholder, style }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				className: "dap-text",
				value,
				placeholder,
				style: {
					width: "100%",
					...style
				},
				onChange: (e) => onChange(e.target.value)
			});
		}
		/** 数字输入（值可空）。 */
		function NumberInput({ value, onChange, placeholder, min, step }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				className: "dap-number",
				type: "number",
				value: value === null ? "" : value,
				placeholder,
				min,
				step,
				style: { width: "100%" },
				onChange: (e) => {
					const raw = e.target.value;
					if (raw === "") return onChange(null);
					const n = Number(raw);
					if (Number.isFinite(n)) onChange(n);
				}
			});
		}
		/** 下拉选择（值含 '' 空选项）。 */
		function Select({ value, onChange, options, placeholder }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
				className: "dap-select",
				value,
				style: { width: "100%" },
				onChange: (e) => onChange(e.target.value),
				children: [placeholder !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: "",
					children: placeholder
				}), options.map((o) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: o.value,
					children: o.label
				}, o.value))]
			});
		}
		/** 滑块（显示当前值）。 */
		function Slider({ value, onChange, min, max, step, format }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					className: "dap-range",
					type: "range",
					min,
					max,
					step,
					value,
					onChange: (e) => onChange(Number(e.target.value))
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dap-range-val",
					children: format ? format(value) : value
				})]
			});
		}
		/** 标签编辑器：输入 + 回车添加 + 删除。 */
		function TagEditor({ tags, onChange }) {
			const [draft, setDraft] = (0, react.useState)("");
			const add = () => {
				const t = draft.trim();
				if (!t) return;
				if (tags.includes(t)) {
					setDraft("");
					return;
				}
				onChange([...tags, t]);
				setDraft("");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dap-tag-input-row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					className: "dap-text",
					value: draft,
					placeholder: "输入标签，回车添加",
					style: { flex: 1 },
					onChange: (e) => setDraft(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							add();
						}
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dap-btn small",
					onClick: add,
					children: "添加"
				})]
			}), tags.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dap-chips",
				children: tags.map((t) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dap-chip",
					children: [t, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "删除",
						onClick: () => onChange(tags.filter((x) => x !== t)),
						children: "×"
					})]
				}, t))
			})] });
		}
		/** 通用错误条。 */
		function ErrorNote({ message }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dap-empty",
				style: { color: "#e5484d" },
				children: message
			});
		}
		/** 加载条。 */
		function LoadingNote({ text }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dap-loading",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dap-spinner" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: text ?? "加载中…" })]
			});
		}
		/** 空态。 */
		function EmptyNote({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dap-empty",
				children
			});
		}
		//#endregion
		//#region src/client/forms.tsx
		/**
		* 设置表单分节：档案 / 模型参数 / 系统提示词 / 注入模式 / 世界书 / skill / 记忆。
		* 全部为受控组件：props.config 为当前助手全集配置；update(fn) 由父层更新并持久化。
		*/
		const EFFORT_OPTIONS = [
			{
				value: "auto",
				label: "自动（跟模型默认）"
			},
			{
				value: "off",
				label: "关闭"
			},
			{
				value: "low",
				label: "低"
			},
			{
				value: "medium",
				label: "中"
			},
			{
				value: "high",
				label: "高"
			},
			{
				value: "max",
				label: "最大"
			}
		];
		function ProfileForm({ host }) {
			const { config, update } = host;
			const p = config.profile;
			const onAvatar = (file) => {
				if (!file) return;
				const reader = new FileReader();
				reader.onload = () => {
					update((c) => ({
						...c,
						profile: {
							...c.profile,
							avatar: String(reader.result ?? "")
						}
					}));
				};
				reader.readAsDataURL(file);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: "助手名称",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextInput, {
						value: p.name,
						onChange: (v) => update((c) => ({
							...c,
							profile: {
								...c.profile,
								name: v
							}
						}))
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Field, {
					label: "头像",
					hint: "支持上传图片（转为 dataURL 存 host）或粘贴 URL",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-tag-input-row",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dap-text",
								placeholder: "头像 URL（可选）",
								value: p.avatar.startsWith("data:") ? "" : p.avatar,
								style: { flex: 1 },
								onChange: (e) => update((c) => ({
									...c,
									profile: {
										...c.profile,
										avatar: e.target.value
									}
								}))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dap-btn small",
								style: { cursor: "pointer" },
								children: ["上传图片", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "file",
									accept: "image/*",
									style: { display: "none" },
									onChange: (e) => onAvatar(e.target.files?.[0])
								})]
							}),
							p.avatar && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dap-btn small",
								onClick: () => update((c) => ({
									...c,
									profile: {
										...c.profile,
										avatar: ""
									}
								})),
								children: "移除"
							})
						]
					}), p.avatar && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { marginTop: 8 },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							src: p.avatar,
							alt: "头像预览",
							style: {
								width: 56,
								height: 56,
								borderRadius: "50%",
								objectFit: "cover",
								border: "1px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.12))"
							}
						})
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: "标签",
					hint: "用于过滤/检索助手",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TagEditor, {
						tags: p.tags,
						onChange: (tags) => update((c) => ({
							...c,
							profile: {
								...c.profile,
								tags
							}
						}))
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: "工作区",
					hint: "绑定工作区（可选）",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
						value: p.workspace,
						onChange: (v) => update((c) => ({
							...c,
							profile: {
								...c.profile,
								workspace: v
							}
						})),
						options: host.workspaces.map((w) => ({
							value: w.id,
							label: w.title + "（" + w.path + "）"
						})),
						placeholder: "未绑定"
					})
				})
			] });
		}
		function ModelParamsForm({ host }) {
			const { config, update } = host;
			const m = config.modelParams;
			const modelOptions = host.models.flatMap((prov) => prov.models.map((model) => ({
				value: prov.id + "::" + model.id,
				label: model.name + "（" + prov.name + "）"
			})));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: "模型",
					hint: "留空 = 跟随主模型（自动路由）",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
						value: m.provider ? m.provider + "::" + m.model : "",
						onChange: (key) => {
							const [provider, model] = key.split("::");
							update((c) => ({
								...c,
								modelParams: {
									...c.modelParams,
									provider: provider === "" ? null : provider,
									model: model ?? ""
								}
							}));
						},
						options: modelOptions,
						placeholder: "跟随主模型"
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: "温度",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
						value: m.temperature,
						min: 0,
						max: 2,
						step: .05,
						onChange: (v) => update((c) => ({
							...c,
							modelParams: {
								...c.modelParams,
								temperature: v
							}
						})),
						format: (v) => v.toFixed(2)
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: "Top P",
					hint: "暂未生效（DSH 尚未支持）；设置会正常持久化",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
						value: m.topP,
						min: 0,
						max: 1,
						step: .01,
						onChange: (v) => update((c) => ({
							...c,
							modelParams: {
								...c.modelParams,
								topP: v
							}
						})),
						format: (v) => v.toFixed(2)
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dap-field-row",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { flex: 1 },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: "思考强度",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
								value: m.reasoningEffort,
								onChange: (v) => update((c) => ({
									...c,
									modelParams: {
										...c.modelParams,
										reasoningEffort: v
									}
								})),
								options: EFFORT_OPTIONS
							})
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { flex: 1 },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: "最大 Token",
							hint: "留空 = 无限制",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NumberInput, {
								value: m.maxTokens,
								min: 1,
								step: 1,
								onChange: (v) => update((c) => ({
									...c,
									modelParams: {
										...c.modelParams,
										maxTokens: v
									}
								})),
								placeholder: "无限制"
							})
						})
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dap-field-row",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { flex: 1 },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: "上下文消息限制",
							hint: "携带最近 N 条；0 = 全部",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NumberInput, {
								value: m.contextLimit,
								min: 0,
								step: 1,
								onChange: (v) => update((c) => ({
									...c,
									modelParams: {
										...c.modelParams,
										contextLimit: v ?? 0
									}
								}))
							})
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							flex: 1,
							display: "flex",
							alignItems: "center"
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dap-field-label",
							children: "流式输出"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: { marginTop: 4 },
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
								checked: m.stream,
								onChange: (v) => update((c) => ({
									...c,
									modelParams: {
										...c.modelParams,
										stream: v
									}
								})),
								label: m.stream ? "开" : "关"
							})
						})] })
					})]
				})
			] });
		}
		function PromptForm({ host }) {
			const { config, update } = host;
			const sp = config.systemPrompt;
			const [varName, setVarName] = (0, react.useState)("");
			const [varValue, setVarValue] = (0, react.useState)("");
			const insertVar = (name) => {
				update((c) => ({
					...c,
					systemPrompt: {
						...c.systemPrompt,
						template: sp.template + "{{" + name + "}}"
					}
				}));
			};
			const cvEntries = Object.entries(sp.customVariables);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: "系统提示词模板",
					hint: "支持 {{变量}} 与 {变量} 双语法",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: "dap-textarea",
						rows: 6,
						value: sp.template,
						onChange: (e) => update((c) => ({
							...c,
							systemPrompt: {
								...c.systemPrompt,
								template: e.target.value
							}
						}))
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: "内置变量",
					hint: "点击插入到模板末尾（可手动再编辑位置）",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dap-var-list",
						children: SYSTEM_VARIABLES.map((v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dap-var-chip",
							title: v.description,
							onClick: () => insertVar(v.name),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "{{" + v.name + "}}" })
						}, v.name))
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Field, {
					label: "自定义变量",
					hint: "覆盖同名内置变量",
					children: [cvEntries.map(([k, v]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-tag-input-row",
						style: { marginBottom: 6 },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dap-text",
								value: k,
								placeholder: "变量名",
								style: { width: 140 },
								onChange: (e) => {
									const nk = e.target.value;
									update((c) => {
										const cv = { ...c.systemPrompt.customVariables };
										delete cv[k];
										cv[nk] = v;
										return {
											...c,
											systemPrompt: {
												...c.systemPrompt,
												customVariables: cv
											}
										};
									});
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dap-text",
								value: v,
								placeholder: "变量值",
								style: { flex: 1 },
								onChange: (e) => update((c) => ({
									...c,
									systemPrompt: {
										...c.systemPrompt,
										customVariables: {
											...c.systemPrompt.customVariables,
											[k]: e.target.value
										}
									}
								}))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dap-iconbtn danger",
								title: "删除",
								onClick: () => {
									update((c) => {
										const cv = { ...c.systemPrompt.customVariables };
										delete cv[k];
										return {
											...c,
											systemPrompt: {
												...c.systemPrompt,
												customVariables: cv
											}
										};
									});
								},
								children: "×"
							})
						]
					}, k)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-tag-input-row",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dap-text",
								value: varName,
								placeholder: "新变量名",
								style: { width: 140 },
								onChange: (e) => setVarName(e.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dap-text",
								value: varValue,
								placeholder: "新变量值",
								style: { flex: 1 },
								onChange: (e) => setVarValue(e.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dap-btn small",
								disabled: !varName.trim(),
								onClick: () => {
									update((c) => ({
										...c,
										systemPrompt: {
											...c.systemPrompt,
											customVariables: {
												...c.systemPrompt.customVariables,
												[varName.trim()]: varValue
											}
										}
									}));
									setVarName("");
									setVarValue("");
								},
								children: "添加"
							})
						]
					})]
				})
			] });
		}
		function InjectionsForm({ host }) {
			const { config, update } = host;
			const set = (i, patch) => {
				update((c) => ({
					...c,
					injections: c.injections.map((b, idx) => idx === i ? {
						...b,
						...patch
					} : b)
				}));
			};
			const add = () => {
				update((c) => ({
					...c,
					injections: [...c.injections, {
						id: uid(),
						role: "system",
						position: "after",
						trigger: "always",
						keywords: [],
						enabled: true,
						content: ""
					}]
				}));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dap-edit-list",
				children: config.injections.map((b, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dap-edit-card",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-edit-card-head",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dap-field-label",
								children: ["注入块 #", i + 1]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
								checked: b.enabled,
								onChange: (v) => set(i, { enabled: v }),
								label: b.enabled ? "开" : "关"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dap-iconbtn danger",
								title: "删除",
								onClick: () => update((c) => ({
									...c,
									injections: c.injections.filter((_, idx) => idx !== i)
								})),
								children: "×"
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-edit-grid",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "角色",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
									value: b.role,
									onChange: (v) => set(i, { role: v }),
									options: [
										{
											value: "system",
											label: "system（并入系统提示词段）"
										},
										{
											value: "user",
											label: "user（独立用户消息）"
										},
										{
											value: "assistant",
											label: "assistant（独立助手消息）"
										}
									]
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "位置",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
									value: b.position,
									onChange: (v) => set(i, { position: v }),
									options: [
										{
											value: "before",
											label: "before（模板之前）"
										},
										{
											value: "after",
											label: "after（模板之后）"
										},
										{
											value: "replace",
											label: "replace（替换模板）"
										}
									]
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "触发",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
									value: b.trigger,
									onChange: (v) => set(i, { trigger: v }),
									options: [{
										value: "always",
										label: "always（恒注入）"
									}, {
										value: "keywords",
										label: "keywords（命中关键词）"
									}]
								})
							}),
							b.trigger === "keywords" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "关键词（逗号分隔）",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextInput, {
									value: b.keywords.join(", "),
									onChange: (v) => set(i, { keywords: v.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wide",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
									label: "内容（可含 {{变量}}）",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: "dap-textarea",
										rows: 3,
										value: b.content,
										onChange: (e) => set(i, { content: e.target.value })
									})
								})
							})
						]
					})]
				}, b.id))
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dap-add-row",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dap-btn",
					onClick: add,
					children: "+ 添加注入块"
				})
			})] });
		}
		function WorldbookForm({ host }) {
			const { config, update } = host;
			const set = (i, patch) => {
				update((c) => ({
					...c,
					worldbook: c.worldbook.map((b, idx) => idx === i ? {
						...b,
						...patch
					} : b)
				}));
			};
			const add = () => {
				update((c) => ({
					...c,
					worldbook: [...c.worldbook, {
						id: uid(),
						keys: [],
						content: "",
						priority: 100,
						position: "before",
						enabled: true
					}]
				}));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dap-edit-list",
				children: config.worldbook.map((e, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dap-edit-card",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-edit-card-head",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dap-field-label",
								children: ["条目 #", i + 1]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
								checked: e.enabled,
								onChange: (v) => set(i, { enabled: v }),
								label: e.enabled ? "开" : "关"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dap-iconbtn danger",
								title: "删除",
								onClick: () => update((c) => ({
									...c,
									worldbook: c.worldbook.filter((_, idx) => idx !== i)
								})),
								children: "×"
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-edit-grid",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "触发关键词（逗号分隔）",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextInput, {
									value: e.keys.join(", "),
									onChange: (v) => set(i, { keys: v.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dap-field-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: { flex: 1 },
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: "优先级",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NumberInput, {
											value: e.priority,
											min: 0,
											step: 10,
											onChange: (v) => set(i, { priority: v ?? 0 })
										})
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: { flex: 1 },
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: "位置",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
											value: e.position,
											onChange: (v) => set(i, { position: v }),
											options: [{
												value: "before",
												label: "before（最近 user 前）"
											}, {
												value: "after",
												label: "after（最近 user 后）"
											}]
										})
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wide",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
									label: "内容（可含 {{变量}}）",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: "dap-textarea",
										rows: 3,
										value: e.content,
										onChange: (ev) => set(i, { content: ev.target.value })
									})
								})
							})
						]
					})]
				}, e.id))
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dap-add-row",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dap-btn",
					onClick: add,
					children: "+ 添加世界书条目"
				})
			})] });
		}
		function SkillsForm({ host }) {
			const { config, update } = host;
			const enabledNames = new Set(config.skills.filter((s) => s.enabled).map((s) => s.name));
			const toggle = (skill, on) => {
				update((c) => ({
					...c,
					skills: on ? [...c.skills.filter((s) => s.name !== skill.name), {
						id: uid(),
						name: skill.name,
						description: skill.description,
						enabled: true
					}] : c.skills.filter((s) => s.name !== skill.name)
				}));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dap-edit-list",
				children: [host.skills.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dap-empty",
					children: "暂无可用 skill（Host /skills 为空）"
				}), host.skills.map((s) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dap-edit-card",
					style: { padding: "8px 12px" },
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
							checked: enabledNames.has(s.name),
							onChange: (v) => toggle(s, v)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								minWidth: 0,
								flex: 1
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontSize: 13,
									fontWeight: 500
								},
								children: s.name
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dap-field-hint",
								children: [s.description, s.whenToUse ? "｜" + s.whenToUse : ""]
							})]
						})]
					})
				}, s.name))]
			});
		}
		function MemoryForm({ host }) {
			const { config, update } = host;
			const mem = config.memory;
			const [entries, setEntries] = (0, react.useState)([]);
			const [entryDraft, setEntryDraft] = (0, react.useState)("");
			const [memError, setMemError] = (0, react.useState)(null);
			const [memLoading, setMemLoading] = (0, react.useState)(false);
			const refresh = async () => {
				try {
					setEntries((await listMemory(mem.globalMemory ? { global: true } : { assistantId: config.id })).entries);
					setMemError(null);
				} catch (e) {
					setMemError(apiErrorMessage(e));
				}
			};
			(0, react.useEffect)(() => {
				refresh();
			}, [mem.globalMemory, config.id]);
			const addEntry = async () => {
				const content = entryDraft.trim();
				if (!content) return;
				try {
					await createMemory({
						content,
						assistantId: mem.globalMemory ? void 0 : config.id
					});
					setEntryDraft("");
					refresh();
				} catch (e) {
					setMemError(apiErrorMessage(e));
				}
			};
			const delEntry = async (id) => {
				try {
					await deleteMemory(id);
					refresh();
				} catch (e) {
					setMemError(apiErrorMessage(e));
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: "记忆开关",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
						checked: mem.enabled,
						onChange: (v) => update((c) => ({
							...c,
							memory: {
								...c.memory,
								enabled: v
							}
						})),
						label: mem.enabled ? "开" : "关"
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dap-field-row",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { flex: 1 },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: "使用全局记忆池",
							hint: "关 = 使用助手私有池",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
								checked: mem.globalMemory,
								onChange: (v) => update((c) => ({
									...c,
									memory: {
										...c.memory,
										globalMemory: v
									}
								})),
								label: mem.globalMemory ? "全局" : "私有"
							})
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { flex: 1 },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: "参考聊天记录",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
								checked: mem.useChatHistory,
								onChange: (v) => update((c) => ({
									...c,
									memory: {
										...c.memory,
										useChatHistory: v
									}
								})),
								label: mem.useChatHistory ? "开" : "关"
							})
						})
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: "时间感知",
					hint: "开 → 助手知道当前时间与距上次对话多久（自然上下文行，无提醒消息）；关 → 不注入",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
						checked: mem.timeAwareness,
						onChange: (v) => update((c) => ({
							...c,
							memory: {
								...c.memory,
								timeAwareness: v
							}
						})),
						label: mem.timeAwareness ? "开" : "关"
					})
				}),
				mem.enabled && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: { marginTop: 6 },
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Field, {
						label: mem.globalMemory ? "全局记忆条目" : "助手私有记忆条目",
						hint: "命中时注入系统提示词（最近 50 条检索取 top 5）",
						children: [
							memLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dap-loading",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dap-spinner" }), "加载记忆…"]
							}),
							memError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dap-status",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "err",
									children: memError
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dap-edit-list",
								children: entries.map((e) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dap-mem-card",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: e.content }),
										e.tags && e.tags.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dap-field-hint",
											children: e.tags.join(", ")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dap-iconbtn danger",
											title: "删除",
											onClick: () => void delEntry(e.id),
											children: "×"
										})
									]
								}, e.id))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dap-tag-input-row",
								style: { marginTop: 8 },
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dap-text",
									value: entryDraft,
									placeholder: "添加一条记忆…",
									style: { flex: 1 },
									onChange: (e) => setEntryDraft(e.target.value),
									onKeyDown: (e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											addEntry();
										}
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dap-btn small",
									disabled: !entryDraft.trim(),
									onClick: () => void addEntry(),
									children: "添加"
								})]
							})
						]
					})
				})
			] });
		}
		//#endregion
		//#region src/client/AssistantEditor.tsx
		function AssistantEditor({ config, enums, saving, onUpdate, onSave, onCancel }) {
			const host = {
				config,
				update: onUpdate,
				models: enums.models,
				workspaces: enums.workspaces,
				skills: enums.skills
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dap-editor",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dap-editor-body",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "档案"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProfileForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "模型参数"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelParamsForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "系统提示词"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "注入模式"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InjectionsForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "世界书"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorldbookForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "Skill"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillsForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "记忆"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemoryForm, { host })]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dap-editor-foot",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dap-field-hint",
						children: "保存后同一会话继续沿用该档案配置（下一条消息起生效）。"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-editor-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dap-btn",
							onClick: onCancel,
							disabled: saving,
							children: "取消"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dap-btn primary",
							onClick: onSave,
							disabled: saving,
							children: saving ? "保存中…" : "保存"
						})]
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/AssistantOverlay.tsx
		/**
		* shell.overlay 管理面板：助手列表（选择/取消/编辑/复制/删除）+ 当前会话选择状态。
		*
		* 纠偏形态：不再有独立聊天窗——「选择」= 将该助手激活到当前 DSH 主会话
		* （POST /selection），选中后下一条消息起，主会话以该助手人设/模型/参数对话；
		* 「取消选择」恢复 DSH 原生对话。打开状态经模块级总线（bus.ts）与
		* sidebar.footer.action 按钮共享；关闭时渲染 null（list 槽常驻注册，自身决定可见性）。
		*/
		/** 枚举数据（模型/工作区/skill）一次性加载。 */
		async function loadEnums$1() {
			const [m, w, s] = await Promise.all([
				listModels(),
				listWorkspaces(),
				listSkills()
			]);
			return {
				models: m.providers,
				workspaces: w.workspaces,
				skills: s.skills
			};
		}
		/** 全量配置 → POST /assistants 请求体（剥离 id 与时间戳）。 */
		function toCreateInput(c) {
			const { id: _cid, profile, ...rest } = c;
			const { id: _pid, createdAt: _c, updatedAt: _u, ...pf } = profile;
			return {
				...rest,
				profile: pf
			};
		}
		function formatUpdated(ts) {
			try {
				return new Date(ts).toLocaleString("zh-CN", {
					month: "2-digit",
					day: "2-digit",
					hour: "2-digit",
					minute: "2-digit"
				});
			} catch {
				return "";
			}
		}
		/** 管理面板主体（overlay 内渲染）。 */
		function ManagementPanel({ sessionId, onClose }) {
			const [assistants, setAssistants] = (0, react.useState)([]);
			const [selectedId, setSelectedId] = (0, react.useState)(null);
			const [view, setView] = (0, react.useState)("list");
			const [editing, setEditing] = (0, react.useState)(null);
			const [enums, setEnums] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [flash, setFlash] = (0, react.useState)(null);
			const flashTimer = (0, react.useRef)(null);
			const notify = (msg) => {
				setFlash(msg);
				if (flashTimer.current) clearTimeout(flashTimer.current);
				flashTimer.current = setTimeout(() => setFlash(null), 4e3);
			};
			const refresh = (0, react.useCallback)(async () => {
				try {
					const { assistants: list } = await listAssistants();
					setAssistants(list);
					let sel = null;
					if (sessionId) try {
						const { selection } = await getSelection(sessionId);
						sel = selection.assistantId;
					} catch {}
					setSelectedId(sel);
					setError(null);
				} catch (e) {
					setError(apiErrorMessage(e));
				} finally {
					setLoading(false);
				}
			}, [sessionId]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const ensureEnums = async () => {
				if (enums) return enums;
				const data = await loadEnums$1();
				setEnums(data);
				return data;
			};
			const select = async (id, name) => {
				if (!sessionId) {
					setError("当前没有活动会话，无法选择助手");
					return;
				}
				setBusy(true);
				setError(null);
				try {
					await setSelection(sessionId, id);
					setSelectedId(id);
					notify("已选择「" + name + "」——下一条消息起在该会话生效");
				} catch (e) {
					setError(apiErrorMessage(e));
				} finally {
					setBusy(false);
				}
			};
			const deselect = async () => {
				if (!sessionId) return;
				setBusy(true);
				setError(null);
				try {
					await setSelection(sessionId, null);
					setSelectedId(null);
					notify("已取消选择——恢复 DSH 原生对话");
				} catch (e) {
					setError(apiErrorMessage(e));
				} finally {
					setBusy(false);
				}
			};
			const edit = async (id) => {
				setBusy(true);
				setError(null);
				try {
					await ensureEnums();
					const { assistant } = await getAssistant(id);
					setEditing(assistant);
					setView("edit");
				} catch (e) {
					setError(apiErrorMessage(e));
				} finally {
					setBusy(false);
				}
			};
			const create = async () => {
				setBusy(true);
				setError(null);
				try {
					await ensureEnums();
					const { assistant } = await createAssistant(defaultAssistantInput());
					setEditing(assistant);
					setView("edit");
					setAssistants((list) => {
						if (list.some((a) => a.id === assistant.id)) return list;
						return [{
							id: assistant.id,
							name: assistant.profile.name,
							avatar: assistant.profile.avatar,
							tags: assistant.profile.tags,
							workspace: assistant.profile.workspace,
							updatedAt: assistant.profile.updatedAt
						}, ...list];
					});
				} catch (e) {
					setError(apiErrorMessage(e));
				} finally {
					setBusy(false);
				}
			};
			const updateEditing = (updater) => {
				setEditing((c) => c ? updater(c) : c);
			};
			const save = async () => {
				if (!editing) return;
				setBusy(true);
				setError(null);
				try {
					const { id, ...body } = editing;
					const { assistant } = await updateAssistant(id, body);
					setEditing(null);
					setView("list");
					notify("已保存「" + assistant.profile.name + "」");
					await refresh();
				} catch (e) {
					setError(apiErrorMessage(e));
				} finally {
					setBusy(false);
				}
			};
			const duplicate = async (id) => {
				setBusy(true);
				setError(null);
				try {
					const { assistant } = await getAssistant(id);
					const clone = cloneAssistantConfig(assistant);
					const name = clone.profile.name + "（副本）";
					await createAssistant(toCreateInput({
						...clone,
						profile: {
							...clone.profile,
							name
						}
					}));
					notify("已复制「" + name + "」");
					await refresh();
				} catch (e) {
					setError(apiErrorMessage(e));
				} finally {
					setBusy(false);
				}
			};
			const remove = async (id, name) => {
				if (!window.confirm("确定删除助手「" + name + "」？（若有会话选中它，将自动取消）")) return;
				setBusy(true);
				setError(null);
				try {
					await deleteAssistant(id);
					if (selectedId === id) setSelectedId(null);
					notify("已删除「" + name + "」");
					await refresh();
				} catch (e) {
					setError(apiErrorMessage(e));
				} finally {
					setBusy(false);
				}
			};
			const selectedSummary = assistants.find((a) => a.id === selectedId) ?? null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dap-panel dap-manage",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-panel-head",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								className: "dap-panel-title",
								children: "助手"
							}),
							view === "edit" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dap-panel-sub",
								children: editing?.profile.name ?? "编辑助手"
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dap-btn small",
								onClick: () => void create(),
								disabled: busy,
								title: "新建助手",
								children: "+ 新建"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dap-iconbtn",
								title: "关闭",
								"aria-label": "关闭",
								onClick: onClose,
								children: "×"
							})
						]
					}),
					view === "edit" && editing && enums ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantEditor, {
						config: editing,
						enums,
						saving: busy,
						onUpdate: updateEditing,
						onSave: save,
						onCancel: () => {
							setEditing(null);
							setView("list");
						}
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-panel-body dap-manage-body",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dap-sel-banner" + (selectedId ? " active" : ""),
							children: sessionId === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dap-sel-text",
								children: [
									"当前会话：",
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: "无活动会话" }),
									"（新建会话后即可选择助手）"
								]
							}) : selectedId ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dap-avatar small",
									children: selectedSummary?.avatar ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
										src: selectedSummary.avatar,
										alt: ""
									}) : (selectedSummary?.name ?? "?").charAt(0).toUpperCase()
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dap-sel-text",
									children: [
										"当前会话助手：",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: selectedSummary?.name ?? "（助手已删除）" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dap-sel-hint",
											children: "（下一条消息起按该助手人设/模型/参数对话）"
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dap-btn small",
									onClick: () => void deselect(),
									disabled: busy,
									children: "取消选择"
								})
							] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dap-sel-text",
								children: [
									"当前会话：",
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: "未选择助手（DSH 原生）" }),
									"——点列表「选择」激活到本会话"
								]
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-assist-list",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dap-assist-list-head",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dap-assist-list-title",
									children: "助手"
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dap-assist-scroll",
								children: loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LoadingNote, { text: "加载助手…" }) : assistants.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyNote, { children: "还没有助手 点击「+ 新建」创建第一个" }) : assistants.map((a) => {
									const isSel = a.id === selectedId;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dap-assist-item" + (isSel ? " active" : ""),
										role: "button",
										tabIndex: 0,
										title: isSel ? "已在当前会话选中" : "点击选择到当前会话",
										onClick: () => {
											if (!isSel && !busy && sessionId !== void 0) select(a.id, a.name);
										},
										onKeyDown: (e) => {
											if ((e.key === "Enter" || e.key === " ") && !isSel && !busy && sessionId !== void 0) {
												e.preventDefault();
												select(a.id, a.name);
											}
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dap-avatar",
												children: a.avatar ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
													src: a.avatar,
													alt: ""
												}) : a.name.charAt(0).toUpperCase()
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dap-assist-meta",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dap-assist-name",
													children: [a.name, isSel && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dap-sel-badge",
														children: "已选"
													})]
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dap-assist-tags",
													children: [
														a.tags.join(", ") || "无标签",
														" · ",
														formatUpdated(a.updatedAt)
													]
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dap-assist-ops",
												onClick: (e) => e.stopPropagation(),
												children: [
													isSel ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dap-btn tiny",
														onClick: () => void deselect(),
														disabled: busy,
														children: "取消"
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dap-btn tiny primary",
														onClick: () => void select(a.id, a.name),
														disabled: busy || sessionId === void 0,
														title: sessionId === void 0 ? "无活动会话" : "在本会话启用该助手",
														children: "选择"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dap-iconbtn",
														title: "编辑",
														onClick: () => void edit(a.id),
														disabled: busy,
														children: "✎"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dap-iconbtn",
														title: "复制",
														onClick: () => void duplicate(a.id),
														disabled: busy,
														children: "⧉"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dap-iconbtn danger",
														title: "删除",
														onClick: () => void remove(a.id, a.name),
														disabled: busy,
														children: "×"
													})
												]
											})
										]
									}, a.id);
								})
							})]
						})]
					}),
					(flash || error) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dap-status",
						children: [
							flash && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ok",
								children: flash
							}),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "err",
								children: error
							}),
							(flash || error) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dap-btn small",
								onClick: () => {
									setFlash(null);
									setError(null);
								},
								children: "关闭"
							})
						]
					})
				]
			});
		}
		/**
		* shell.overlay 浮层条目：容纳管理面板。打开状态经模块级总线（bus.ts）与
		* sidebar.footer.action 按钮共享；关闭时渲染 null（list 槽常驻注册，由自身决定可见性）。
		*/
		function AssistantOverlay({ useSessions }) {
			const sessionId = useSessions((s) => s.current);
			const [open, setOpen] = (0, react.useState)(() => isPanelOpen());
			(0, react.useEffect)(() => subscribePanel(setOpen), []);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKey = (e) => {
					if (e.key === "Escape") closePanel();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [open]);
			if (!open) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dap-overlay",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": "助手管理",
				onClick: () => closePanel(),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dap-overlay-panel",
					onClick: (e) => e.stopPropagation(),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagementPanel, {
						sessionId,
						onClose: () => closePanel()
					})
				})
			});
		}
		//#endregion
		//#region src/client/SettingsSection.tsx
		/**
		* 设置页（settings.section 入口 + 面板内设置抽屉共用）：
		* 加载助手列表 + 枚举数据（模型/工作区/skill），选中助手后编辑全集配置并 PUT 持久化。
		*/
		/** 枚举数据一次性加载。 */
		async function loadEnums() {
			const [m, w, s] = await Promise.all([
				listModels(),
				listWorkspaces(),
				listSkills()
			]);
			return {
				models: m.providers,
				workspaces: w.workspaces,
				skills: s.skills
			};
		}
		function SettingsSection(_props) {
			const [assistants, setAssistants] = (0, react.useState)([]);
			const [selectedId, setSelectedId] = (0, react.useState)("");
			const [config, setConfig] = (0, react.useState)(null);
			const [enums, setEnums] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [saving, setSaving] = (0, react.useState)(false);
			const [savedMsg, setSavedMsg] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let cancelled = false;
				(async () => {
					try {
						const [list, enumData] = await Promise.all([listAssistants(), loadEnums()]);
						if (cancelled) return;
						setAssistants(list.assistants.map((a) => ({
							id: a.id,
							name: a.name
						})));
						setEnums(enumData);
						const first = list.assistants[0];
						setSelectedId(first ? first.id : "");
						if (first) {
							const { assistant } = await getAssistant(first.id);
							if (!cancelled) setConfig(assistant);
						}
					} catch (e) {
						if (!cancelled) setError(apiErrorMessage(e));
					} finally {
						if (!cancelled) setLoading(false);
					}
				})();
				return () => {
					cancelled = true;
				};
			}, []);
			const selectAssistant = async (id) => {
				if (!id) return;
				setSelectedId(id);
				setLoading(true);
				setError(null);
				try {
					const { assistant } = await getAssistant(id);
					setConfig(assistant);
				} catch (e) {
					setError(apiErrorMessage(e));
				} finally {
					setLoading(false);
				}
			};
			const update = (updater) => {
				setConfig((c) => c ? updater(c) : c);
				setSavedMsg(null);
			};
			const save = async () => {
				if (!config) return;
				setSaving(true);
				setError(null);
				try {
					const { id, ...body } = config;
					const { assistant } = await updateAssistant(id, body);
					setConfig(assistant);
					setSavedMsg("已保存（" + (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", {
						hour: "2-digit",
						minute: "2-digit"
					}) + "）");
				} catch (e) {
					setError(apiErrorMessage(e));
				} finally {
					setSaving(false);
				}
			};
			const host = (0, react.useMemo)(() => {
				if (!config || !enums) return null;
				return {
					config,
					update,
					models: enums.models,
					workspaces: enums.workspaces,
					skills: enums.skills
				};
			}, [config, enums]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dap-set",
				children: loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LoadingNote, { text: "加载设置…" }) : error && !config ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorNote, { message: error }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dap-set-intro",
						children: "配置助手档案：身份、模型参数、系统提示词、注入/世界书/skill、记忆（含时间感知开关——开启后助手知道当前时间与距上次对话多久，无提醒消息）。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							maxWidth: 320,
							marginBottom: 8
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
							value: selectedId,
							onChange: (v) => void selectAssistant(v),
							options: assistants.map((a) => ({
								value: a.id,
								label: a.name
							})),
							placeholder: "选择助手"
						})
					}),
					assistants.length === 0 && !loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyNote, { children: "还没有助手。请先到「助手面板」新建一个。" }),
					host && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "档案"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProfileForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "模型参数"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelParamsForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "系统提示词"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "注入模式"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InjectionsForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "世界书"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorldbookForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "Skill"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillsForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dap-section",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dap-section-title",
								children: "记忆"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemoryForm, { host })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								position: "sticky",
								bottom: 0,
								padding: "10px 0",
								background: "var(--dsw-alias-bg-layer-1,#ffffff)"
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dap-status",
								children: [
									saving ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "busy",
										children: "保存中…"
									}) : savedMsg ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ok",
										children: savedMsg
									}) : null,
									error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "err",
										children: error
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dap-btn primary",
										onClick: () => void save(),
										disabled: saving || !config,
										children: "保存设置"
									})
								]
							})
						})
					] })
				] })
			});
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* @bananiceee/dsh-zhushou — client 入口。
		* 注册三处 UI 面（纠偏形态，DESIGN-ACTIVATION §10.4 定案）：
		*   1. sidebar.footer.action — 侧边栏底栏「助手」文字选项（宽模式图标+文字）；显示当前会话选中态；点击打开管理面板；
		*   2. shell.overlay — 管理面板浮层（列表/选择/取消/编辑/复制/删除 + 当前会话选择状态条）；无独立聊天窗；
		*   3. settings.section — 完整设置页（全部设置表单 + 持久化，含时间感知开关）。
		* 自注入 <style>（类名前缀 dap-）。root 槽组件接收框架注入的 props
		* （{wide, useSessions} / {useSessions} / {close, useSessions}），见 ./slots.ts。
		*/
		/** 安装样式表（dispose 时移除）。 */
		function installStyles() {
			const style = document.createElement("style");
			style.setAttribute("data-dsh-plugin", "@bananiceee/dsh-zhushou");
			style.textContent = STYLES;
			document.head.appendChild(style);
			return () => {
				style.remove();
			};
		}
		/** 服务注入声明：仅声明 'slots'（未引 locale 服务）。 */
		const inject = ["slots"];
		/**
		* 注册三处 UI 面。
		* ⚠️ inject 包裹 register：等待槽被宿主声明（declaration-aware）；
		* register 必须带 name（= 槽名）与 id（list 槽条目 id）。
		*/
		function apply(ctx) {
			ctx.effect(installStyles, "@bananiceee/dsh-zhushou: styles");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "@bananiceee/dsh-zhushou-sidebar",
				order: 950,
				label: "助手"
			}, SidebarEntry));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "@bananiceee/dsh-zhushou-overlay",
				order: 50
			}, AssistantOverlay));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "@bananiceee/dsh-zhushou-settings",
				order: 50,
				label: "助手面板"
			}, SettingsSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map