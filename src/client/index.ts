/**
 * @dsh-external/dsh-assistant-panel — client 入口。
 * 注册三处 UI 面（DESIGN §C3 定案）：
 *   1. sidebar.footer.action — 侧边栏底栏助手图标；点击打开 shell.overlay 浮层；
 *   2. shell.overlay — 助手面板浮层（列表 + 聊天窗 + 设置）；
 *   3. settings.section — 完整设置页（全部设置表单 + 持久化）。
 * 自注入 <style>（类名前缀 dap-）。
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

  // 1. 侧边栏底栏入口（sidebar.footer.action，list/root，owner { wide }）
  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register({
      name: 'sidebar.footer.action',
      id: '@dsh-external/dsh-assistant-panel-sidebar',
      order: 950,
      label: '助手',
    }, SidebarEntry),
  )

  // 2. 助手面板浮层（shell.overlay，list/root；点击侧边栏图标经总线打开）
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
