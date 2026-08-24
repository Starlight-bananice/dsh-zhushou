/** 把字符串断言为品牌类型 AssistantId（客户端仅用于已确认的 host id）。 */
import type { AssistantId, ChatId, MemoryEntryId } from '../shared/types.ts'

export function injectAsAssistantId(id: string): AssistantId {
  return id as AssistantId
}
export function injectAsChatId(id: string): ChatId {
  return id as ChatId
}
export function injectAsMemoryId(id: string): MemoryEntryId {
  return id as MemoryEntryId
}
