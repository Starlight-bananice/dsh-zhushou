/**
 * shell.overlay 管理面板：助手列表（选择/取消/编辑/复制/删除）+ 当前会话选择状态。
 *
 * 纠偏形态：不再有独立聊天窗——「选择」= 将该助手激活到当前 DSH 主会话
 * （POST /selection），选中后下一条消息起，主会话以该助手人设/模型/参数对话；
 * 「取消选择」恢复 DSH 原生对话。打开状态经模块级总线（bus.ts）与
 * sidebar.footer.action 按钮共享；关闭时渲染 null（list 槽常驻注册，自身决定可见性）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssistantConfig, AssistantId } from '../shared/types.ts'
import type { AssistantSummary, ProviderInfo, SkillInfo, UpdateAssistantInput, WorkspaceInfo } from '../shared/contracts.ts'
import type { OverlayProps, UseSessions } from './slots.ts'
import {
  createAssistant,
  deleteAssistant,
  getAssistant,
  getSelection,
  listAssistants,
  listModels,
  listSkills,
  listWorkspaces,
  setSelection,
  updateAssistant,
} from './api.ts'
import { apiErrorMessage } from './api.ts'
import { closePanel, isPanelOpen, subscribePanel } from './bus.ts'
import { cloneAssistantConfig, defaultAssistantInput } from './runtime.ts'
import { AssistantEditor } from './AssistantEditor.tsx'
import { EmptyNote, LoadingNote } from './ui.tsx'

/** 枚举数据（模型/工作区/skill）一次性加载。 */
async function loadEnums(): Promise<{ models: ProviderInfo[]; workspaces: WorkspaceInfo[]; skills: SkillInfo[] }> {
  const [m, w, s] = await Promise.all([listModels(), listWorkspaces(), listSkills()])
  return { models: m.providers, workspaces: w.workspaces, skills: s.skills }
}

/** 全量配置 → POST /assistants 请求体（剥离 id 与时间戳）。 */
function toCreateInput(c: AssistantConfig): import('./api.ts').CreateAssistantBody {
  const { id: _cid, profile, ...rest } = c
  const { id: _pid, createdAt: _c, updatedAt: _u, ...pf } = profile
  return { ...rest, profile: pf }
}

function formatUpdated(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/** 管理面板主体（overlay 内渲染）。 */
function ManagementPanel({ sessionId, onClose }: { sessionId: string | undefined; onClose: () => void }) {
  const [assistants, setAssistants] = useState<AssistantSummary[]>([])
  const [selectedId, setSelectedId] = useState<AssistantId | null>(null)
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editing, setEditing] = useState<AssistantConfig | null>(null)
  const [enums, setEnums] = useState<{ models: ProviderInfo[]; workspaces: WorkspaceInfo[]; skills: SkillInfo[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = (msg: string) => {
    setFlash(msg)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 4000)
  }

  const refresh = useCallback(async () => {
    try {
      const { assistants: list } = await listAssistants()
      setAssistants(list)
      let sel: AssistantId | null = null
      if (sessionId) {
        try {
          const { selection } = await getSelection(sessionId)
          sel = selection.assistantId
        } catch { /* 会话不可用时不阻塞列表 */ }
      }
      setSelectedId(sel)
      setError(null)
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // 打开 + 会话切换时刷新
  useEffect(() => { void refresh() }, [refresh])

  // 进入编辑视图前确保枚举已加载
  const ensureEnums = async () => {
    if (enums) return enums
    const data = await loadEnums()
    setEnums(data)
    return data
  }

  const select = async (id: AssistantId, name: string) => {
    if (!sessionId) {
      setError('当前没有活动会话，无法选择助手')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setSelection(sessionId, id)
      setSelectedId(id)
      notify('已选择「' + name + '」——下一条消息起在该会话生效')
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const deselect = async () => {
    if (!sessionId) return
    setBusy(true)
    setError(null)
    try {
      await setSelection(sessionId, null)
      setSelectedId(null)
      notify('已取消选择——恢复 DSH 原生对话')
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const edit = async (id: AssistantId) => {
    setBusy(true)
    setError(null)
    try {
      await ensureEnums()
      const { assistant } = await getAssistant(id)
      setEditing(assistant)
      setView('edit')
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      await ensureEnums()
      const { assistant } = await createAssistant(defaultAssistantInput())
      setEditing(assistant)
      setView('edit')
      setAssistants((list) => {
        // 摘要列表立即补上新条目（无需整表刷新）
        const exists = list.some((a) => a.id === assistant.id)
        if (exists) return list
        return [{ id: assistant.id, name: assistant.profile.name, avatar: assistant.profile.avatar, tags: assistant.profile.tags, workspace: assistant.profile.workspace, updatedAt: assistant.profile.updatedAt }, ...list]
      })
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const updateEditing = (updater: (c: AssistantConfig) => AssistantConfig) => {
    setEditing((c) => (c ? updater(c) : c))
  }

  const save = async () => {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      // PUT /assistants/:id 语义：除顶层 id 外全量（profile 时间戳 host 会忽略/重盖）
      const { id, ...body } = editing
      const { assistant } = await updateAssistant(id, body as UpdateAssistantInput)
      setEditing(null)
      setView('list')
      notify('已保存「' + assistant.profile.name + '」')
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
      const input = toCreateInput({ ...clone, profile: { ...clone.profile, name } })
      await createAssistant(input)
      notify('已复制「' + name + '」')
      await refresh()
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: AssistantId, name: string) => {
    if (!window.confirm('确定删除助手「' + name + '」？（若有会话选中它，将自动取消）')) return
    setBusy(true)
    setError(null)
    try {
      await deleteAssistant(id)
      if (selectedId === id) setSelectedId(null)
      notify('已删除「' + name + '」')
      await refresh()
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const selectedSummary = assistants.find((a) => a.id === selectedId) ?? null

  return (
    <div className="dap-panel dap-manage">
      <div className="dap-panel-head">
        <h2 className="dap-panel-title">助手</h2>
        {view === 'edit' ? (
          <span className="dap-panel-sub">{editing?.profile.name ?? '编辑助手'}</span>
        ) : (
          <button type="button" className="dap-btn small" onClick={() => void create()} disabled={busy} title="新建助手">+ 新建</button>
        )}
        <button type="button" className="dap-iconbtn" title="关闭" aria-label="关闭" onClick={onClose}>×</button>
      </div>

      {view === 'edit' && editing && enums ? (
        <AssistantEditor
          config={editing}
          enums={enums}
          saving={busy}
          onUpdate={updateEditing}
          onSave={save}
          onCancel={() => { setEditing(null); setView('list') }}
        />
      ) : (
        <div className="dap-panel-body dap-manage-body">
          {/* 当前会话选择状态条 */}
          <div className={'dap-sel-banner' + (selectedId ? ' active' : '')}>
            {sessionId === undefined ? (
              <span className="dap-sel-text">当前会话：<b>无活动会话</b>（新建会话后即可选择助手）</span>
            ) : selectedId ? (
              <>
                <span className="dap-avatar small">
                  {selectedSummary?.avatar ? <img src={selectedSummary.avatar} alt="" /> : (selectedSummary?.name ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className="dap-sel-text">
                  当前会话助手：<b>{selectedSummary?.name ?? '（助手已删除）'}</b>
                  <span className="dap-sel-hint">（下一条消息起按该助手人设/模型/参数对话）</span>
                </span>
                <button type="button" className="dap-btn small" onClick={() => void deselect()} disabled={busy}>取消选择</button>
              </>
            ) : (
              <span className="dap-sel-text">当前会话：<b>未选择助手（DSH 原生）</b>——点列表「选择」激活到本会话</span>
            )}
          </div>

          <div className="dap-assist-list">
            <div className="dap-assist-list-head">
              <span className="dap-assist-list-title">助手</span>
            </div>
            <div className="dap-assist-scroll">
              {loading ? (
                <LoadingNote text="加载助手…" />
              ) : assistants.length === 0 ? (
                <EmptyNote>还没有助手
点击「+ 新建」创建第一个</EmptyNote>
              ) : (
                assistants.map((a) => {
                  const isSel = a.id === selectedId
                  return (
                    <div key={a.id} className={'dap-assist-item' + (isSel ? ' active' : '')}>
                      <div className="dap-avatar">
                        {a.avatar ? <img src={a.avatar} alt="" /> : a.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="dap-assist-meta">
                        <div className="dap-assist-name">{a.name}{isSel && <span className="dap-sel-badge">已选</span>}</div>
                        <div className="dap-assist-tags">{a.tags.join(', ') || '无标签'} · {formatUpdated(a.updatedAt)}</div>
                      </div>
                      <span className="dap-assist-ops" onClick={(e) => e.stopPropagation()}>
                        {isSel ? (
                          <button type="button" className="dap-btn tiny" onClick={() => void deselect()} disabled={busy}>取消</button>
                        ) : (
                          <button
                            type="button"
                            className="dap-btn tiny primary"
                            onClick={() => void select(a.id, a.name)}
                            disabled={busy || sessionId === undefined}
                            title={sessionId === undefined ? '无活动会话' : '在本会话启用该助手'}
                          >选择</button>
                        )}
                        <button type="button" className="dap-iconbtn" title="编辑" onClick={() => void edit(a.id)} disabled={busy}>✎</button>
                        <button type="button" className="dap-iconbtn" title="复制" onClick={() => void duplicate(a.id)} disabled={busy}>⧉</button>
                        <button type="button" className="dap-iconbtn danger" title="删除" onClick={() => void remove(a.id, a.name)} disabled={busy}>×</button>
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {(flash || error) && (
        <div className="dap-status">
          {flash && <span className="ok">{flash}</span>}
          {error && <span className="err">{error}</span>}
          {(flash || error) && <button type="button" className="dap-btn small" onClick={() => { setFlash(null); setError(null) }}>关闭</button>}
        </div>
      )}
    </div>
  )
}

/**
 * shell.overlay 浮层条目：容纳管理面板。打开状态经模块级总线（bus.ts）与
 * sidebar.footer.action 按钮共享；关闭时渲染 null（list 槽常驻注册，由自身决定可见性）。
 */
export function AssistantOverlay({ useSessions }: OverlayProps) {
  const sessionId = useSessions((s) => s.current)
  const [open, setOpen] = useState<boolean>(() => isPanelOpen())

  useEffect(() => subscribePanel(setOpen), [])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div
      className="dap-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="助手管理"
      onClick={() => closePanel()}
    >
      <div className="dap-overlay-panel" onClick={(e) => e.stopPropagation()}>
        <ManagementPanel sessionId={sessionId} onClose={() => closePanel()} />
      </div>
    </div>
  )
}

export type { UseSessions }
