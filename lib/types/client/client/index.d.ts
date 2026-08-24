/** 结构型 slots 面（与运行时 SlotRegistry 对齐；保持类型独立，不依赖 ui-slots 的完整泛型栈）。 */
type SlotsService = {
    inject(key: string, callback: () => () => void): () => void;
    register(options: Record<string, unknown>, component: unknown): () => void;
};
type ClientContext = {
    slots: SlotsService;
    effect(fn: () => void | (() => void), label: string): void;
};
/** 服务注入声明：仅声明 'slots'（未引 locale 服务）。 */
export declare const inject: string[];
/**
 * 注册三处 UI 面。
 * ⚠️ inject 包裹 register：等待槽被宿主声明（declaration-aware）；
 * register 必须带 name（= 槽名）与 id（list 槽条目 id）。
 */
export declare function apply(ctx: ClientContext): void;
export {};
//# sourceMappingURL=index.d.ts.map