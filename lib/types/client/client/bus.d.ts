/**
 * 跨槽位总线：sidebar.footer.action 按钮 ↔ shell.overlay 浮层之间共享打开状态。
 * 不依赖 store 机制（shell.overlay 是 list/root 且无专属 store 契约），
 * 用模块级 pub/sub 保持零依赖。
 */
type Listener = (open: boolean) => void;
/** 订阅面板开合状态；返回取消订阅。 */
export declare function subscribePanel(fn: Listener): () => void;
/** 打开助手面板。 */
export declare function openPanel(): void;
/** 关闭助手面板。 */
export declare function closePanel(): void;
/** 切换开合。 */
export declare function togglePanel(): void;
/** 当前状态。 */
export declare function isPanelOpen(): boolean;
export {};
//# sourceMappingURL=bus.d.ts.map