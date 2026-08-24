/**
 * dsh-assistant-panel client 样式（单 <style> 注入，类名前缀 dap-）。
 * 配色沿用 DSH status-bar 的 CSS 变量（--dsw-alias-*），主题无关。
 */
export const STYLES = `
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
`