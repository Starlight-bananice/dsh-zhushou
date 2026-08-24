/**
 * 设置页（settings.section 入口 + 面板内设置抽屉共用）：
 * 加载助手列表 + 枚举数据（模型/工作区/skill），选中助手后编辑全集配置并 PUT 持久化。
 */
import { useEffect, useMemo, useState } from 'react'
import type { AssistantConfig, AssistantId } from '../shared/types.ts'
import type { ProviderInfo, SkillInfo, WorkspaceInfo } from '../shared/contracts.ts'
import { getAssistant, listAssistants, listModels, listSkills, listWorkspaces, updateAssistant } from './api.ts'
import { apiErrorMessage } from './api.ts'
import { injectAsAssistantId } from './helpers.ts'
import { EmptyNote, ErrorNote, LoadingNote, Select } from './ui.tsx'
import { InjectionsForm, MemoryForm, ModelParamsForm, ProfileForm, PromptForm, SkillsForm, WorldbookForm } from './forms.tsx'

/** 枚举数据一次性加载。 */
async function loadEnums(): Promise<{ models: ProviderInfo[]; workspaces: WorkspaceInfo[]; skills: SkillInfo[] }> {
  const [m, w, s] = await Promise.all([listModels(), listWorkspaces(), listSkills()])
  return { models: m.providers, workspaces: w.workspaces, skills: s.skills }
}

export function SettingsSection() {
  const [assistants, setAssistants] = useState<{ id: AssistantId; name: string }[]>([])
  const [selectedId, setSelectedId] = useState<AssistantId | ''>('')
  const [config, setConfig] = useState<AssistantConfig | null>(null)
  const [enums, setEnums] = useState<{ models: ProviderInfo[]; workspaces: WorkspaceInfo[]; skills: SkillInfo[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [list, enumData] = await Promise.all([listAssistants(), loadEnums()])
        if (cancelled) return
        setAssistants(list.assistants.map((a) => ({ id: a.id, name: a.name })))
        setEnums(enumData)
        const first = list.assistants[0]
        setSelectedId(first ? first.id : '')
        if (first) {
          const { assistant } = await getAssistant(first.id)
          if (!cancelled) setConfig(assistant)
        }
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const selectAssistant = async (id: string) => {
    if (!id) return
    setSelectedId(id as never)
    setLoading(true)
    setError(null)
    try {
      const { assistant } = await getAssistant(id as never)
      setConfig(assistant)
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const update = (updater: (c: AssistantConfig) => AssistantConfig) => {
    setConfig((c) => (c ? updater(c) : c))
    setSavedMsg(null)
  }

  const save = async () => {
    if (!config) return
    setSaving(true)
    setError(null)
    try {
      const { id, ...body } = config
      const { assistant } = await updateAssistant(id, body)
      setConfig(assistant)
      setSavedMsg('已保存（' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '）')
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const host = useMemo(() => {
    if (!config || !enums) return null
    return {
      config,
      update,
      models: enums.models,
      workspaces: enums.workspaces,
      skills: enums.skills,
    }
  }, [config, enums])

  return (
    <div className="dap-set">
      {loading ? (
        <LoadingNote text="加载设置…" />
      ) : error && !config ? (
        <ErrorNote message={error} />
      ) : (
        <>
          <p className="dap-set-intro">配置侧边栏助手：身份、模型参数、系统提示词、注入/世界书/skill 与记忆。</p>
          <div style={{ maxWidth: 320, marginBottom: 8 }}>
            <Select
              value={selectedId}
              onChange={(v) => void selectAssistant(v)}
              options={assistants.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="选择助手"
            />
          </div>
          {assistants.length === 0 && !loading && (
            <EmptyNote>
              还没有助手。请先到「助手面板」新建一个。
            </EmptyNote>
          )}
          {host && (
            <>
              <div className="dap-section">
                <h3 className="dap-section-title">档案</h3>
                <ProfileForm host={host} />
              </div>
              <div className="dap-section">
                <h3 className="dap-section-title">模型参数</h3>
                <ModelParamsForm host={host} />
              </div>
              <div className="dap-section">
                <h3 className="dap-section-title">系统提示词</h3>
                <PromptForm host={host} />
              </div>
              <div className="dap-section">
                <h3 className="dap-section-title">注入模式</h3>
                <InjectionsForm host={host} />
              </div>
              <div className="dap-section">
                <h3 className="dap-section-title">世界书</h3>
                <WorldbookForm host={host} />
              </div>
              <div className="dap-section">
                <h3 className="dap-section-title">Skill</h3>
                <SkillsForm host={host} />
              </div>
              <div className="dap-section">
                <h3 className="dap-section-title">记忆</h3>
                <MemoryForm host={host} />
              </div>
              <div style={{ position: 'sticky', bottom: 0, padding: '10px 0', background: 'var(--dsw-alias-bg-layer-1,#ffffff)' }}>
                <div className="dap-status">
                  {saving ? <span className="busy">保存中…</span> : savedMsg ? <span className="ok">{savedMsg}</span> : null}
                  {error && <span className="err">{error}</span>}
                  <button type="button" className="dap-btn primary" onClick={() => void save()} disabled={saving || !config}>保存设置</button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
