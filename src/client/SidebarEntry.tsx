/**
 * 侧边栏 footer action 入口（sidebar.footer.action 注册，owner { wide }）。
 * 点击 → 打开 shell.overlay 浮层中的助手面板（经模块级总线协调）。
 */
import { isPanelOpen, togglePanel } from './bus.ts'

export function SidebarEntry({ wide }: { wide: boolean }) {
  return (
    <button
      type="button"
      className="dap-side-action"
      title="侧边栏助手"
      aria-label="侧边栏助手"
      aria-expanded={isPanelOpen()}
      onClick={() => togglePanel()}
    >
      {/* 机器人/助手图标 */}
      <svg width={wide ? 16 : 18} height={wide ? 16 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="8" width="16" height="12" rx="3" />
        <path d="M12 8V4" />
        <circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none" />
        <path d="M9 14h.01M15 14h.01M9.5 17.5h5" />
      </svg>
    </button>
  )
}
