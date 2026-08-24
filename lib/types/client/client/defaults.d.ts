/**
 * 客户端小工具：id 生成 + 默认助手配置工厂（对齐 src/shared/types.ts 契约）。
 */
import type { AssistantConfig, AssistantId } from '../shared/types.ts';
import type { CreateAssistantBody } from './api.ts';
/** 生成唯一 id（浏览器 crypto 优先，fallback 时间戳+随机）。 */
export declare function uid(): string;
/** 以字符串当 AssistantId（仅客户端内部构造输入时用；host 会重发权威 id）。 */
export declare function asAssistantId(s: string): AssistantId;
/** 默认助手配置（POST /assistants 请求体）；name 缺省给一个友好名。 */
export declare function defaultAssistantInput(name?: string): CreateAssistantBody;
/** 深拷贝助手配置（用于「复制助手」）。 */
export declare function cloneAssistantConfig(src: AssistantConfig): AssistantConfig;
/** 系统提示词内置变量（与 docs/ARCHITECTURE.md §6 对齐，用于变量面板展示）。 */
export declare const SYSTEM_VARIABLES: {
    name: string;
    description: string;
}[];
//# sourceMappingURL=defaults.d.ts.map