/**
 * @bananiceee/dsh-zhushou — 侧边栏助手插件（host 侧）。
 *
 * 入口职责：
 *  - 声明插件 name / inject（webServer、llm、settings 等）；
 *  - 插件级配置 schema（dataDir 等）；
 *  - 捕获主模型路由（llm/stream waterfall）→ lastRoute 兜底；
 *  - 会话级选择（selection.json）：session/event 订阅维护 lastChatTs；
 *  - **激活拦截**（llm/stream waterfall 短路）：选中助手 → 重建请求
 *    （系统提示词/消息注入/模型参数/上下文截断/时间感知）；
 *  - ctx.effect 挂载：存储层 + webServer 前缀路由 /assistant-panel/api。
 *
 * 数据目录：插件设置 dataDir → ${DSH_HOME || ~/.dsh}/dsh-assistant-panel。
 * 参考：dsh-status-bar（webServer 注册 + session/event 先例）、DESIGN-ACTIVATION §2（瀑布短路）。
 */
import type { Context } from 'cordis';
import z from 'schemastery';
export declare const name = "@bananiceee/dsh-zhushou";
/** 实际用到的服务（webServer 路由、llm 调用、settings 读取、skills/workspace 枚举）。 */
export declare const inject: readonly ["webServer", "llm", "settings", "skills", "workspaceRegistry"];
/** 插件全局配置。 */
export interface Config {
    /** 自定义数据目录；空 = ${DSH_HOME || ~/.dsh}/dsh-assistant-panel。 */
    dataDir: string;
}
export declare const Config: z<Config>;
export declare function apply(ctx: Context, config: Config): void;
