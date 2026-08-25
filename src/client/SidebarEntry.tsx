/**
 * 侧边栏 footer action 入口（sidebar.footer.action 注册，owner { wide }）。
 * 纠偏形态：宽模式渲染「图标 + 助手」文字按钮，窄模式仅图标；
 * 显示当前会话的助手选择状态（已选 → 图标高亮 + 小圆点）。
 * 点击 → 打开 shell.overlay 管理面板（经模块级总线 bus.ts 协调）。
 */
import { useEffect, useState } from 'react'
import type { SidebarEntryProps } from './slots.ts'
import { getSelection } from './api.ts'
import { apiErrorMessage } from './api.ts'
import { isPanelOpen, togglePanel } from './bus.ts'

export function SidebarEntry({ wide, useSessions }: SidebarEntryProps) {
  const sessionId = useSessions((s) => s.current)
  const [selected, setSelected] = useState(false)

  // 当前会话选择状态（会话切换时刷新；仅展示，不阻塞渲染）
  useEffect(() => {
    if (!sessionId) {
      setSelected(false)
      return
    }
    let cancelled = false
    setSelected(false)
    void (async () => {
      try {
        const { selection } = await getSelection(sessionId)
        if (cancelled) return
        setSelected(selection.assistantId !== null)
      } catch (e) {
        if (cancelled) return
        console.warn('[assistant-panel] 选择状态读取失败：', apiErrorMessage(e))
        setSelected(false)
      }
    })()
    return () => { cancelled = true }
  }, [sessionId])

  const open = isPanelOpen()
  return (
    <button
      type="button"
      className={'dap-side-action' + (wide ? '' : ' rail') + (selected ? ' dap-side-action-sel' : '')}
      title={selected ? '助手（当前会话已选助手）' : '助手'}
      aria-label="助手"
      aria-expanded={open}
      onClick={() => togglePanel()}
    >
      {/* 机器人/助手图标（宽模式 16 / 窄模式 18，与官方设置触发器一致） */}
      <svg width={wide ? 16 : 18} height={wide ? 16 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="8" width="16" height="12" rx="3" />
        <path d="M12 8V4" />
        <circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none" />
        <path d="M9 14h.01M15 14h.01M9.5 17.5h5" />
      </svg>
      {wide ? (
        <span className="dap-side-text">
          <span className="dap-side-label">助手</span>
          {selected && <span className="dap-side-dot" aria-hidden="true" />}
        </span>
      ) : (
        selected && <span className="dap-side-dot" aria-hidden="true" />
      )}
    </button>
  )
}
