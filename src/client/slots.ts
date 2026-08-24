/**
 * 客户端 root 槽位 props 的**结构类型**（免引入 dsh-client-runtime 完整泛型栈）。
 *
 * 依据 docs/DESIGN-ACTIVATION.md §5：root 槽（sidebar.footer.action / shell.overlay /
 * settings.section）运行时注入 GlobalStandardProps = { useSessions, useWorkspaces }，
 * 其中 useSessions 为 SnapshotSelectorHook<SessionListState>。这里手写最小交集，
 * 只声明组件实际消费的成员；与 DSH runtime 类型保持结构兼容即可。
 */

/** SessionListState 的最小结构（对齐 runtime/src/client/sessions/service.ts）。 */
export interface SessionSnapshotLike {
  ids: string[]
  byId: Record<string, { id: string; title?: string }>
  /** 当前会话 id（持久化选择 + 舞台投影）。 */
  current: string | undefined
  phase: 'pending' | 'ready'
}

/** useSessions 钩子签名（SnapshotSelectorHook 的结构体）。 */
export type UseSessions = <S>(
  selector: (s: SessionSnapshotLike) => S,
  eq?: (a: S, b: S) => boolean,
) => S

/** sidebar.footer.action 组件 props：owner { wide } + global 标准件。 */
export interface SidebarEntryProps {
  wide: boolean
  useSessions: UseSessions
}

/** shell.overlay 组件 props：owner {} + global 标准件。 */
export interface OverlayProps {
  useSessions: UseSessions
}

/** settings.section 组件 props：owner { close } + global 标准件。 */
export interface SettingsSectionProps {
  close: () => void
  useSessions: UseSessions
}
