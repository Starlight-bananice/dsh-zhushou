/**
 * shell.overlay 浮层条目：容纳助手面板（列表 + 聊天窗 + 设置）。
 * 打开状态经模块级总线（bus.ts）与 sidebar.footer.action 按钮共享：
 * 点击侧边栏图标 → open；面板内关闭按钮 / 遮罩点击 / Esc → close。
 * 关闭时渲染 null（list 槽常驻注册，由自身决定可见性）。
 */
import { useEffect, useState } from 'react'
import { AssistantPanel } from './AssistantPanel.tsx'
import { closePanel, isPanelOpen, subscribePanel } from './bus.ts'

export function AssistantOverlay() {
  const [open, setOpen] = useState<boolean>(() => isPanelOpen())

  useEffect(() => subscribePanel(setOpen), [])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div
      className="dap-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="侧边栏助手"
      onClick={() => closePanel()}
    >
      <div className="dap-overlay-panel" onClick={(e) => e.stopPropagation()}>
        <AssistantPanel onClose={() => closePanel()} />
      </div>
    </div>
  )
}
