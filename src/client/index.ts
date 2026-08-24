/**
 * @dsh-external/dsh-assistant-panel — client 入口。
 * 注册三处 UI 面（纠偏形态，DESIGN-ACTIVATION §10.4 定案）：
 *   1. sidebar.footer.action — 侧边栏底栏「助手」文字选项（宽模式图标+文字）；显示当前会话选中态；点击打开管理面板；
 *   2. shell.overlay — 管理面板浮层（列表/选择/取消/编辑/复制/删除 + 当前会话选择状态条）；无独立聊天窗；
 *   3. settings.section — 完整设置页（全部设置表单 + 持久化，含时间感知开关）。
 * 自注入 <style>（类名前缀 dap-）。root 槽组件接收框架注入的 props
 * （{wide, useSessions} / {useSessions} / {close, useSessions}），见 ./slots.ts。
 */
import { STYLES } from './style.ts'
import { SidebarEntry } from './SidebarEntry.tsx'
import { AssistantOverlay } from './AssistantOverlay.tsx'
import { SettingsSection } from './SettingsSection.tsx'

/** 结构型 slots 面（与运行时 SlotRegistry 对齐；保持类型独立，不依赖 ui-slots 的完整泛型栈）。 */
type SlotsService = {
  inject(key: string, callback: () => () => void): () => void
  register(options: Record<string, unknown>, component: unknown): () => void
}

type ClientContext = {
  slots: SlotsService
  effect(fn: () => void | (() => void), label: string): void
}

/** 安装样式表（dispose 时移除）。 */
function installStyles(): () => void {
  const style = document.createElement('style')
  style.setAttribute('data-dsh-plugin', '@dsh-external/dsh-assistant-panel')
  style.textContent = STYLES
  document.head.appendChild(style)
  return () => { style.remove() }
}

/** 服务注入声明：仅声明 'slots'（未引 locale 服务）。 */
export const inject = ['slots']

/**
 * 注册三处 UI 面。
 * ⚠️ inject 包裹 register：等待槽被宿主声明（declaration-aware）；
 * register 必须带 name（= 槽名）与 id（list 槽条目 id）。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(installStyles, '@dsh-external/dsh-assistant-panel: styles')

  // 1. 侧边栏底栏入口（sidebar.footer.action，list/root，owner { wide }）——「助手」文字选项
  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register({
      name: 'sidebar.footer.action',
      id: '@dsh-external/dsh-assistant-panel-sidebar',
      order: 950,
      label: '助手',
    }, SidebarEntry),
  )

  // 2. 管理面板浮层（shell.overlay，list/root；点击侧边栏入口经总线打开）
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({
      name: 'shell.overlay',
      id: '@dsh-external/dsh-assistant-panel-overlay',
      order: 50,
    }, AssistantOverlay),
  )

  // 3. 设置页（settings.section，list/root，带 id/order/label）
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register({
      name: 'settings.section',
      id: '@dsh-external/dsh-assistant-panel-settings',
      order: 50,
      label: '助手面板',
    }, SettingsSection),
  )
}
