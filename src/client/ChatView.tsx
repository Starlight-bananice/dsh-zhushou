/**
 * 聊天窗：消息流 + 输入 + SSE 流式 + 停止 + 清空 + 快捷回复 + 时间提醒样式。
 * props: assistant 全集配置、会话（chats 由本组件管理：取该助手的最近会话）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssistantConfig, ChatId, ChatMessage } from '../shared/types.ts'
import { deleteChat, getChatMessages, listChats, streamChat } from './api.ts'
import { apiErrorMessage } from './api.ts'
import { asAssistantId, uid } from './defaults.ts'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  ts: number
  error?: boolean
  /** 时间提醒行（特殊样式） */
  reminder?: boolean
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/** 时间提醒文案（与 host 侧 ARCHITECTURE §5 缺省模板一致）。 */
function reminderText(gapMinutes: number): string {
  const gap =
    gapMinutes >= 60
      ? Math.floor(gapMinutes / 60) + ' 小时' + (gapMinutes % 60 ? ' ' + (gapMinutes % 60) + ' 分钟' : '')
      : gapMinutes + ' 分钟'
  const localtime = (() => {
    try {
      return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  })()
  return '[时间提醒] 距上一次交流已过去 ' + gap + '。现在是 ' + localtime + '。请结合当前时间来作答。'
}

export function ChatView({ assistant }: { assistant: AssistantConfig }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [chatId, setChatId] = useState<ChatId | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const lastUserTsRef = useRef<number>(0)
  const streamIdRef = useRef<string | null>(null)

  // 切换助手：加载该助手最近会话
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setMessages([])
    setChatId(null)
    setStreaming(false)
    abortRef.current?.abort()
    void (async () => {
      try {
        const { chats } = await listChats(assistant.id)
        if (cancelled) return
        const recent = chats.sort((a, b) => b.updatedAt - a.updatedAt)[0]
        if (!recent) {
          if (!cancelled) setLoading(false)
          return
        }
        const { chat } = await getChatMessages(recent.id)
        if (cancelled) return
        setChatId(chat.id)
        setMessages(chat.messages.map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          ts: m.ts,
          reminder: m.content.startsWith('[时间提醒]'),
        })))
        const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user')
        if (lastUser) lastUserTsRef.current = lastUser.ts
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [assistant.id])

  const scrollBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  useEffect(() => scrollBottom(), [messages, streaming, scrollBottom])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || streaming) return
    const now = Date.now()
    const lastUserTs = lastUserTsRef.current
    const gapMin = assistant.memory.gapReminderMinutes
    const reminderDue =
      assistant.memory.enabled &&
      gapMin !== null &&
      lastUserTs > 0 &&
      now - lastUserTs >= gapMin * 60_000
    const user: DisplayMessage = { id: uid(), role: 'user', content: text, ts: now }
    const next: DisplayMessage[] = [
      ...messages,
      ...(reminderDue
        ? [{ id: uid(), role: 'system' as const, content: reminderText(gapMin!), ts: now - 100, reminder: true }]
        : []),
      user,
    ]
    setMessages(next)
    setDraft('')
    lastUserTsRef.current = now
    setStreaming(true)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller
    let acc = ''
    streamIdRef.current = null
    try {
      await streamChat(
        { assistantId: assistant.id, message: text, chatId: chatId ?? undefined },
        {
          onConnected: (cid) => setChatId(cid),
          onDelta: (delta) => {
            acc += delta
            setMessages((ms) => {
              const copy = [...ms]
              const sid = streamIdRef.current
              const idx = sid ? copy.findIndex((m) => m.id === sid) : -1
              if (idx >= 0) {
                copy[idx] = { ...copy[idx], content: acc }
              } else {
                const id = uid()
                streamIdRef.current = id
                copy.push({ id, role: 'assistant', content: acc, ts: Date.now() })
              }
              return copy
            })
          },
          onReasoning: () => { /* 思考增量暂不展示，正文为准 */ },
          onDone: (msg) => {
            const sid = streamIdRef.current
            setMessages((ms) =>
              sid ? ms.map((m) => (m.id === sid ? {
                id: msg.id, role: msg.role, content: msg.content, ts: msg.ts,
              } : m)) : [...ms, {
                id: msg.id, role: msg.role, content: msg.content, ts: msg.ts,
              }],
            )
            streamIdRef.current = null
          },
          onError: (code, message) => {
            setError(code === 'ABORTED' ? '已停止' : message)
            // 出错：保留已收到的流式占位并在其上标记错误态
            const sid = streamIdRef.current
            if (sid) {
              setMessages((ms) => ms.map((m) => (m.id === sid ? { ...m, error: true } : m)))
              streamIdRef.current = null
            }
          },
        },
        controller.signal,
      )
    } catch (e) {
      setError(apiErrorMessage(e))
      const sid = streamIdRef.current
      if (sid) {
        setMessages((ms) => ms.map((m) => (m.id === sid ? { ...m, error: true } : m)))
        streamIdRef.current = null
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  const clearChat = async () => {
    if (streaming) return
    if (chatId) {
      try {
        await deleteChat(chatId)
      } catch (e) {
        setError(apiErrorMessage(e))
        return
      }
    }
    setMessages([])
    setChatId(null)
    lastUserTsRef.current = 0
  }

  // 文件输入（头像上传在设置页处理）
  return (
    <div className="dap-chat">
      {loading ? (
        <div className="dap-loading"><span className="dap-spinner" /><span>加载会话…</span></div>
      ) : (
        <>
          <div className="dap-main-head">
            <span className="dap-main-title">{assistant.profile.name}</span>
            <button type="button" className="dap-btn small" onClick={() => void clearChat()} disabled={streaming || (!chatId && messages.length === 0)}>清空聊天</button>
          </div>
          {assistant.quickReplies.length > 0 && (
            <div className="dap-quickbar">
              {assistant.quickReplies.map((qr) => (
                <button key={qr.id} type="button" className="dap-quick" onClick={() => void send(qr.text)} disabled={streaming}>
                  {qr.label}
                </button>
              ))}
            </div>
          )}
          <div className="dap-chat-scroll" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="dap-empty">开始和 {assistant.profile.name} 对话吧</div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  'dap-msg ' + m.role +
                  (m.error ? ' dap-msg-error' : '') +
                  (m.reminder ? ' dap-msg-remind' : '')
                }
              >
                {m.role !== 'system' && (
                  <div className="dap-avatar">
                    {m.role === 'assistant' && assistant.profile.avatar
                      ? <img src={assistant.profile.avatar} alt="" />
                      : m.role === 'assistant'
                        ? assistant.profile.name.charAt(0)
                        : '我'}
                  </div>
                )}
                <div className="dap-msg-body">
                  <div className={'dap-bubble' + (streaming && m.role === 'assistant' && m.id.startsWith('stream-') ? ' dap-cursor' : '')}>
                    {m.content || (streaming ? '…' : '')}
                  </div>
                  <span className="dap-msg-time">{formatTime(m.ts)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="dap-composer">
            <textarea
              className="dap-input"
              rows={2}
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(draft)
                }
              }}
            />
            {streaming ? (
              <button type="button" className="dap-btn danger" onClick={stop}>停止</button>
            ) : (
              <button type="button" className="dap-btn primary" onClick={() => void send(draft)} disabled={!draft.trim()}>发送</button>
            )}
          </div>
        </>
      )}
      {error && (
        <div className="dap-status">
          <span className="err">{error}</span>
          <button type="button" className="dap-btn small" onClick={() => setError(null)}>关闭</button>
        </div>
      )}
    </div>
  )
}
