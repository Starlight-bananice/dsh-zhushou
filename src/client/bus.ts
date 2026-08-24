/**
 * 跨槽位总线：sidebar.footer.action 按钮 ↔ shell.overlay 浮层之间共享打开状态。
 * 不依赖 store 机制（shell.overlay 是 list/root 且无专属 store 契约），
 * 用模块级 pub/sub 保持零依赖。
 */
type Listener = (open: boolean) => void

let open = false
const listeners = new Set<Listener>()

/** 订阅面板开合状态；返回取消订阅。 */
export function subscribePanel(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 打开助手面板。 */
export function openPanel(): void {
  open = true
  listeners.forEach((fn) => fn(true))
}

/** 关闭助手面板。 */
export function closePanel(): void {
  open = false
  listeners.forEach((fn) => fn(false))
}

/** 切换开合。 */
export function togglePanel(): void {
  if (open) closePanel()
  else openPanel()
}

/** 当前状态。 */
export function isPanelOpen(): boolean {
  return open
}
