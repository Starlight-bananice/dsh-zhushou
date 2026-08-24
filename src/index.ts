/**
 * @dsh-external/dsh-assistant-panel — 侧边栏助手插件（host 侧）。
 *
 * 入口职责：
 *  - 声明插件 name / inject（webServer、llm、settings 等）；
 *  - 插件级配置 schema（dataDir / gapReminderMinutes 全局默认）；
 *  - 捕获主模型路由（llm/stream waterfall）→ lastRoute 兜底；
 *  - 组装 RuntimeContext（profile/lastRoute/defaultRoute）；
 *  - ctx.effect 挂载：存储层 + webServer 前缀路由 /assistant-panel/api。
 *
 * 数据目录：插件设置 dataDir → ${DSH_HOME || ~/.dsh}/dsh-assistant-panel。
 * 参考：dsh-status-bar（webServer 注册 + json 范式）、旧骨架（llm/stream 捕获）。
 */

import type { Context } from 'cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-workspace'
import type LlmRuntime from '@deepseek-ai/dsh-llm'
import z from 'schemastery'
import {
  AssistantStore,
  ChatStore,
  MemoryStore,
  SettingsStore,
  resolveDataDir,
} from './store.ts'
import { registerApiRoutes, type ApiDeps } from './api.ts'
import type { RuntimeContext } from './prompt.ts'

export const name = '@dsh-external/dsh-assistant-panel'

/** 实际用到的服务（webServer 路由、llm 调用、settings 读取、skills/workspace 枚举）。 */
export const inject = ['webServer', 'llm', 'settings', 'skills', 'workspaceRegistry'] as const

/** 插件全局配置。 */
export interface Config {
  /** 自定义数据目录；空 = ${DSH_HOME || ~/.dsh}/dsh-assistant-panel。 */
  dataDir: string
  /** 全局时间提醒阈值（分钟）；助手级 memory.gapReminderMinutes 优先，此值作缺省。 */
  gapReminderMinutes: number | null
}

export const Config: z<Config> = z.object({
  dataDir: z.string().default(''),
  gapReminderMinutes: z.union([z.natural().min(1), z.const(null)]).default(30),
})

/** 插件版本（对齐 package.json）。 */
const PLUGIN_VERSION = '0.0.1'

/** 主模型路由类型。 */
interface ModelRoute {
  provider: string
  model: string
}

export function apply(ctx: Context, config: Config): void {
  ctx.logger?.info?.('[' + name + '] 启动')

  // 解析数据目录（插件设置优先，其次配置项，其次缺省）
  const settingsStore = new SettingsStore(resolveDataDir(process.env.DSH_HOME))
  const { dataDir: settingsDataDir } = settingsStore.read()
  const effectiveDataDir = config.dataDir && config.dataDir.trim() !== ''
    ? config.dataDir
    : settingsDataDir

  // store 实例
  const assistants = new AssistantStore(effectiveDataDir)
  const chats = new ChatStore(effectiveDataDir)
  const memory = new MemoryStore(effectiveDataDir)

  // defaultRoute：agentDefaultModel 服务 → settings 兜底 → 空占位
  const defaultRoute = resolveDefaultRoute(ctx)

  const startedAt = Date.now()
  const runtime: RuntimeContext = {
    ctx,
    profile: settingsStore.profile(),
    lastRoute: null,
    defaultRoute,
  }

  // 捕获主模型路由（waterfall 必须 next() 委托）
  ctx.on('llm/stream', (options, next) => {
    const r: ModelRoute = { provider: options.provider, model: options.model }
    runtime.lastRoute = r
    return next()
  })

  // 注册 HTTP API（effect 绑定生命周期）
  const apiDeps: ApiDeps = {
    ctx,
    llm: ctx.llm,
    assistants,
    chats,
    memory,
    settings: settingsStore,
    dataDir: effectiveDataDir,
    pluginVersion: PLUGIN_VERSION,
    startedAt,
    runtime,
  }

  ctx.effect(() => registerApiRoutes(ctx, apiDeps), name + ': api routes')
  ctx.logger?.info?.('[' + name + '] API 已注册：/assistant-panel/api（dataDir=' + effectiveDataDir + '）')
}

/** 解析默认模型路由：agentDefaultModel 服务 → settings 兜底 → 空占位。 */
function resolveDefaultRoute(ctx: Context): ModelRoute {
  try {
    const svc = (ctx as unknown as { agentDefaultModel?: { currentSelection(): { provider: string; model: string } } }).agentDefaultModel
    const sel = svc?.currentSelection()
    if (sel?.provider && sel.model) return { provider: sel.provider, model: sel.model }
  } catch {
    // 忽略
  }
  try {
    const settingsSvc = ctx.settings
    const raw = settingsSvc?.get(settingsNamespace('agent-default-model')) as { provider?: string; model?: string } | undefined
    if (raw?.provider && raw.model) return { provider: raw.provider, model: raw.model }
  } catch {
    // 忽略
  }
  return { provider: '', model: '' }
}
