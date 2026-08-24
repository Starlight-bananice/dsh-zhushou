/**
 * @bananiceee/dsh-zhushou — 共享纯类型（host + client 共用）。
 *
 * ⚠️ 本文件必须保持 **零运行时依赖**：
 *  - 全部内容为 type / interface / 字面量联合 / type-only 别名；
 *  - 不允许 import 任何运行时模块（schemastery、dsh-* 等）；
 *  - host 编译（NodeNext + rewriteRelativeImportExtensions）与 client 打包（tsdown）
 *    都能直接使用；工程代码请用 `import type { ... } from '../shared/types.ts'`。
 *
 * 时间戳约定：全部为 epoch 毫秒（`Date.now()` 语义）。见 docs/ARCHITECTURE.md「持久化布局」。
 */
export {};
//# sourceMappingURL=types.js.map