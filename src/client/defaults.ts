/**
 * 客户端小工具：id 生成 + 默认助手配置工厂（对齐 src/shared/types.ts 契约）。
 */
import type { AssistantConfig, AssistantId, AssistantProfile } from '../shared/types.ts'
import type { CreateAssistantBody } from './api.ts'

/** 生成唯一 id（浏览器 crypto 优先，fallback 时间戳+随机）。 */
export function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch { /* 降级 */ }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

/** 以字符串当 AssistantId（仅客户端内部构造输入时用；host 会重发权威 id）。 */
export function asAssistantId(s: string): AssistantId {
  return s as AssistantId
}

/** 默认助手配置（POST /assistants 请求体）；name 缺省给一个友好名。 */
export function defaultAssistantInput(name?: string): CreateAssistantBody {
  const profile: Omit<AssistantProfile, 'id' | 'createdAt' | 'updatedAt'> = {
    name: name?.trim() || '新助手',
    avatar: '',
    tags: [],
    workspace: '',
  }
  return {
    profile,
    modelParams: {
      provider: null,
      model: '',
      temperature: 0.7,
      topP: 1,
      reasoningEffort: 'auto',
      maxTokens: null,
      stream: true,
      contextLimit: 20,
    },
    systemPrompt: {
      template: '你是 {assistant_name}，一个乐于助人的 AI 助手。',
      customVariables: {},
    },
    quickReplies: [],
    injections: [],
    worldbook: [],
    skills: [],
    memory: {
      enabled: false,
      globalMemory: true,
      useChatHistory: true,
      gapReminderMinutes: null,
    },
  }
}

/** 深拷贝助手配置（用于「复制助手」）。 */
export function cloneAssistantConfig(src: AssistantConfig): AssistantConfig {
  return JSON.parse(JSON.stringify(src)) as AssistantConfig
}

/** 系统提示词内置变量（与 docs/ARCHITECTURE.md §6 对齐，用于变量面板展示）。 */
export const SYSTEM_VARIABLES: { name: string; description: string }[] = [
  { name: 'cur_date', description: '本地日期（如 2026-08-25）' },
  { name: 'cur_time', description: '本地时间（如 14:30）' },
  { name: 'cur_datetime', description: '本地日期时间完整串' },
  { name: 'model_id', description: '本次使用的模型 id' },
  { name: 'model_name', description: '模型显示名' },
  { name: 'timezone', description: '时区（IANA，如 Asia/Shanghai）' },
  { name: 'locale', description: '语言环境（如 zh）' },
  { name: 'user_name', description: '用户昵称' },
  { name: 'assistant_name', description: '助手名称' },
  { name: 'assistant_tags', description: '助手标签（逗号分隔）' },
  { name: 'workspace', description: '绑定工作区标题' },
  { name: 'chat_count', description: '本会话消息条数' },
]
