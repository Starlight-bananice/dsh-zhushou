/**
 * dsh-assistant-panel — 会话级选择状态存储（selection.json）。
 *
 * 会话级激活的依据：一个 DSH 主会话要么选中一个助手（assistantId 非 null），
 * 要么不选中（无条目 / assistantId null = 完全原生路径）。
 *
 * 数据布局（docs/ARCHITECTURE-ACTIVATION.md §4.1）：
 *   <dataDir>/selection.json
 *   {
 *     "sessions": {
 *       "<sessionId>": { "assistantId": "asst_xxx", "lastChatTs": 1720000000000 }
 *     }
 *   }
 *
 * 约定：
 *  - 会话未选中 = 无条目（取消即删除条目，而非写入 assistantId:null——保持文件最小）；
 *  - 读取兜底：容忍 assistantId:null 的历史条目（按未选中处理，下次写入时清理）；
 *  - lastChatTs 由 host 在 session/event（user/message）时 touch 更新
 *    （SessionEvent.time = Unix epoch 毫秒；过滤 source.kind==='user'）；
 *  - 原子写：tmp + rename（复用 store.ts writeJsonAtomic）。
 */

import { join } from 'node:path'
import { readJson, writeJsonAtomic } from './store.ts'
import type { AssistantId, SessionSelection } from './shared/types.ts'

/** selection.json 中一条生效记录（assistantId null = 未选中占位，读取时按未选中处理）。 */
export interface SelectionEntry {
  assistantId: AssistantId | null
  /** 最近一次用户对话时间（epoch 毫秒）；无 = null。 */
  lastChatTs: number | null
}

/** selection.json 顶层形状。 */
export interface SelectionFile {
  sessions: Record<string, SelectionEntry>
}

const EMPTY_FILE: SelectionFile = { sessions: {} }

/**
 * 会话级选择存储（selection.json 原子读写）。
 * 线程模型：host 单进程同步 fs（与 AssistantStore 一致）。
 */
export class SelectionStore {
  private readonly file: string

  constructor(dataDir: string) {
    this.file = join(dataDir, 'selection.json')
  }

  /** 读取当前文件；不存在/损坏返回空表。损坏容忍：解析失败回退空表（不抛，避免阻塞主会话）。 */
  private read(): SelectionFile {
    try {
      const raw = readJson<SelectionFile>(this.file)
      if (!raw || typeof raw !== 'object' || typeof raw.sessions !== 'object' || raw.sessions === null) {
        return EMPTY_FILE
      }
      const sessions: Record<string, SelectionEntry> = {}
      for (const [sid, entry] of Object.entries(raw.sessions)) {
        if (!entry || typeof entry !== 'object') continue
        sessions[sid] = {
          assistantId: typeof entry.assistantId === 'string' ? (entry.assistantId as AssistantId) : null,
          lastChatTs: typeof entry.lastChatTs === 'number' ? entry.lastChatTs : null,
        }
      }
      return { sessions }
    } catch {
      return EMPTY_FILE
    }
  }

  /** 原子写盘（tmp + rename）。 */
  private write(data: SelectionFile): void {
    writeJsonAtomic(this.file, data)
  }

  /**
   * 取某会话的激活条目：仅返回 assistantId 非 null 的条目（= 选中状态）；
   * 无条目 / assistantId 为 null（历史占位）→ undefined（调用方按未选中处理，完全原生路径）。
   */
  get(sessionId: string): (SelectionEntry & { assistantId: AssistantId }) | undefined {
    const entry = this.read().sessions[sessionId]
    if (entry && entry.assistantId) return entry as SelectionEntry & { assistantId: AssistantId }
    return undefined
  }

  /**
   * 记录一次用户对话（user/message 会话事件）：更新该会话条目的 lastChatTs。
   * 未选中（无条目）的会话不创建条目——保持「会话未选中 = 无条目」。
   * @param sessionId DSH 主会话 id
   * @param ts 事件时间（epoch 毫秒；缺省 Date.now()）
   */
  touch(sessionId: string, ts?: number): void {
    const data = this.read()
    const entry = data.sessions[sessionId]
    if (!entry || !entry.assistantId) return // 未选中会话不追踪（文件最小化）
    entry.lastChatTs = ts ?? Date.now()
    this.write(data)
  }

  /**
   * 激活/取消会话级助手。
   * @param sessionId DSH 主会话 id
   * @param assistantId 助手 id；null = 取消（删除条目，恢复原生路径）
   * @returns 落盘后的选择状态
   */
  set(sessionId: string, assistantId: AssistantId | null): SessionSelection {
    const data = this.read()
    if (assistantId === null) {
      delete data.sessions[sessionId]
      this.write(data)
      return { sessionId, assistantId: null, lastChatTs: null }
    }
    const prev = data.sessions[sessionId]
    data.sessions[sessionId] = {
      assistantId,
      // 保留历史 lastChatTs（换助手时时间感知仍可用）
      lastChatTs: prev?.lastChatTs ?? null,
    }
    this.write(data)
    return { sessionId, assistantId, lastChatTs: data.sessions[sessionId].lastChatTs }
  }

  /** 清空某会话的选择条目（取消激活；assistant 不存在/被删时调用）。 */
  clear(sessionId: string): void {
    const data = this.read()
    if (data.sessions[sessionId]) {
      delete data.sessions[sessionId]
      this.write(data)
    }
  }

  /**
   * 助手删除级联清理：删除所有指向该助手的会话条目。
   * 与 DELETE /api/assistants/:id 联动；注入前还有存在性校验（双保险）。
   */
  removeAssistant(assistantId: AssistantId): void {
    const data = this.read()
    let changed = false
    for (const [sid, entry] of Object.entries(data.sessions)) {
      if (entry.assistantId === assistantId) {
        delete data.sessions[sid]
        changed = true
      }
    }
    if (changed) this.write(data)
  }
}
