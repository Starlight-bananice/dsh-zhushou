/**
 * 助手面板主视图（shell.overlay 浮层复用，由侧边栏入口经总线打开）：
 * 左侧助手列表（新建/删除/复制），右侧聊天窗或设置页（分段切换）。
 */
import { useCallback, useEffect, useState } from 'react'
import type { AssistantConfig, AssistantId } from '../shared/types.ts'
import type { AssistantSummary } from '../shared/contracts.ts'
import { createAssistant, deleteAssistant, getAssistant, listAssistants, updateAssistant } from './api.ts'
import { apiErrorMessage } from './api.ts'
import { cloneAssistantConfig, defaultAssistantInput, injectAsAssistantId } from './runtime.ts'
import { ChatView } from './ChatView.tsx'
import { SettingsSection } from './SettingsSection.tsx'
import { EmptyNote, ErrorNote, LoadingNote } from './ui.tsx'

export function AssistantPanel({ onClose }: { onClose?: () => void }) {
  const [assistants, setAssistants] = useState<AssistantSummary[]>([])
  const [selectedId, setSelectedId] = useState<AssistantId | null>(null)
  const [config, setConfig] = useState<AssistantConfig | null>(null)
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async (preferId?: AssistantId) => {
    try {
      const { assistants } = await listAssistants()
      setAssistants(assistants)
      const target = preferId ?? assistants.find((a) => a.id === selectedId)?.id ?? assistants[0]?.id ?? null
      setSelectedId(target)
      if (target) {
        const { assistant } = await getAssistant(target)
        setConfig(assistant)
      } else {
        setConfig(null)
      }
      setError(null)
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => { void refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const select = async (id: AssistantId) => {
    setSelectedId(id)
    setLoading(true)
    try {
      const { assistant } = await getAssistant(id)
      setConfig(assistant)
      setError(null)
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const { assistant } = await createAssistant(defaultAssistantInput())
      await refresh(assistant.id)
      setView('chat')
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: AssistantId) => {
    if (!window.confirm('确定删除该助手？（连带其私有记忆与会话）')) return
    setBusy(true)
    try {
      await deleteAssistant(id)
      await refresh()
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async (id: AssistantId) => {
    setBusy(true)
    setError(null)
    try {
      const { assistant } = await getAssistant(id)
      const clone = cloneAssistantConfig(assistant)
      const name = clone.profile.name + '（副本）'
      // 复制时剥离 id / 时间戳（host 会重发权威 id 并盖时间戳）
      const input = toCreateInput({ ...clone, profile: { ...clone.profile, name } })
      const { assistant: created } = await createAssistant(input)
      await refresh(created.id)
      setView('chat')
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // 全量配置 → POST /assistants 请求体（剥离 id 与时间戳）
  function toCreateInput(c: AssistantConfig): Parameters<typeof createAssistant>[0] {
    const { id: _cid, profile, ...rest } = c
    const { id: _pid, createdAt: _c, updatedAt: _u, ...pf } = profile
    return { ...rest, profile: pf }
  }

  return (
    <div className="dap-panel">
      <div className="dap-panel-head">
        <h2 className="dap-panel-title">侧边栏助手</h2>
        <div className="dap-seg">
          <button type="button" className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>对话</button>
          <button type="button" className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>设置</button>
        </div>
        {onClose && (
          <button type="button" className="dap-iconbtn" title="关闭" aria-label="关闭" onClick={onClose}>×</button>
        )}
      </div>
      <div className="dap-panel-body">
        <div className="dap-assist-list">
          <div className="dap-assist-list-head">
            <span className="dap-assist-list-title">助手</span>
            <button type="button" className="dap-btn small" onClick={() => void create()} disabled={busy} title="新建助手">+ 新建</button>
          </div>
          <div className="dap-assist-scroll">
            {assistants.length === 0 && !loading && (
              <div className="dap-empty">还没有助手
点击「新建」创建第一个</div>
            )}
            {assistants.map((a) => (
              <div
                key={a.id}
                className={'dap-assist-item' + (a.id === selectedId ? ' active' : '')}
                onClick={() => void select(a.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') void select(a.id) }}
              >
                <div className="dap-avatar">
                  {a.avatar ? <img src={a.avatar} alt="" /> : a.name.charAt(0).toUpperCase()}
                </div>
                <div className="dap-assist-meta">
                  <div className="dap-assist-name">{a.name}</div>
                  <div className="dap-assist-tags">{a.tags.join(', ') || '无标签'}</div>
                </div>
                <span className="dap-assist-ops" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="dap-iconbtn" title="复制" onClick={() => void duplicate(a.id)} disabled={busy}>⧉</button>
                  <button type="button" className="dap-iconbtn danger" title="删除" onClick={() => void remove(a.id)} disabled={busy}>×</button>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="dap-main">
          {loading ? (
            <LoadingNote text="加载助手…" />
          ) : !config ? (
            <EmptyNote>
              {assistants.length === 0 ? '点击左上「新建」创建第一个助手' : '选择一个助手开始对话'}
            </EmptyNote>
          ) : view === 'chat' ? (
            <ChatView key={config.id} assistant={config} />
          ) : (
            <SettingsSection />
          )}
        </div>
      </div>
      {error && (
        <div className="dap-status">
          <span className="err">{error}</span>
          <button type="button" className="dap-btn small" onClick={() => setError(null)}>关闭</button>
        </div>
      )}
    </div>
  )
}
