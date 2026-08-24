import type { OverlayProps, UseSessions } from './slots.ts';
/**
 * shell.overlay 浮层条目：容纳管理面板。打开状态经模块级总线（bus.ts）与
 * sidebar.footer.action 按钮共享；关闭时渲染 null（list 槽常驻注册，由自身决定可见性）。
 */
export declare function AssistantOverlay({ useSessions }: OverlayProps): import("react").JSX.Element | null;
export type { UseSessions };
//# sourceMappingURL=AssistantOverlay.d.ts.map