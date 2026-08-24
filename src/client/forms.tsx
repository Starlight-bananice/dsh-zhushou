/**
 * 设置表单分节：档案 / 模型参数 / 系统提示词 / 注入模式 / 世界书 / skill / 记忆。
 * 全部为受控组件：props.config 为当前助手全集配置；update(fn) 由父层更新并持久化。
 */
import { useEffect, useState } from 'react'
import type { AssistantConfig, InjectionBlock, WorldbookEntry } from '../shared/types.ts'
import type { ProviderInfo, SkillInfo, WorkspaceInfo } from '../shared/contracts.ts'
import { Field, NumberInput, Select, Slider, TagEditor, TextInput, Toggle } from './ui.tsx'
import { SYSTEM_VARIABLES, uid } from './defaults.ts'
import { createMemory, deleteMemory, listMemory } from './api.ts'
import { apiErrorMessage } from './api.ts'

/** 表单上下文：config + 更新器 + 枚举数据。 */
export interface FormHost {
  config: AssistantConfig
  update: (updater: (c: AssistantConfig) => AssistantConfig) => void
  models: ProviderInfo[]
  workspaces: WorkspaceInfo[]
  skills: SkillInfo[]
}

const EFFORT_OPTIONS = [
  { value: 'auto', label: '自动（跟模型默认）' },
  { value: 'off', label: '关闭' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'max', label: '最大' },
]

// ── 助手档案 ─────────────────────────────────────────────────────────────────

export function ProfileForm({ host }: { host: FormHost }) {
  const { config, update } = host
  const p = config.profile
  const onAvatar = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      update((c) => ({ ...c, profile: { ...c.profile, avatar: String(reader.result ?? '') } }))
    }
    reader.readAsDataURL(file)
  }
  return (
    <div>
      <Field label="助手名称">
        <TextInput value={p.name} onChange={(v) => update((c) => ({ ...c, profile: { ...c.profile, name: v } }))} />
      </Field>
      <Field label="头像" hint="支持上传图片（转为 dataURL 存 host）或粘贴 URL">
        <div className="dap-tag-input-row">
          <input
            className="dap-text"
            placeholder="头像 URL（可选）"
            value={p.avatar.startsWith('data:') ? '' : p.avatar}
            style={{ flex: 1 }}
            onChange={(e) => update((c) => ({ ...c, profile: { ...c.profile, avatar: e.target.value } }))}
          />
          <label className="dap-btn small" style={{ cursor: 'pointer' }}>
            上传图片
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => onAvatar(e.target.files?.[0])}
            />
          </label>
          {p.avatar && (
            <button type="button" className="dap-btn small" onClick={() => update((c) => ({ ...c, profile: { ...c.profile, avatar: '' } }))}>移除</button>
          )}
        </div>
        {p.avatar && (
          <div style={{ marginTop: 8 }}>
            <img src={p.avatar} alt="头像预览" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--dsw-alias-border-l2,rgba(0,0,0,0.12))' }} />
          </div>
        )}
      </Field>
      <Field label="标签" hint="用于过滤/检索助手">
        <TagEditor tags={p.tags} onChange={(tags) => update((c) => ({ ...c, profile: { ...c.profile, tags } }))} />
      </Field>
      <Field label="工作区" hint="绑定工作区（可选）">
        <Select
          value={p.workspace}
          onChange={(v) => update((c) => ({ ...c, profile: { ...c.profile, workspace: v as never } }))}
          options={host.workspaces.map((w) => ({ value: w.id, label: w.title + '（' + w.path + '）' }))}
          placeholder="未绑定"
        />
      </Field>
    </div>
  )
}

// ── 模型参数 ─────────────────────────────────────────────────────────────────

export function ModelParamsForm({ host }: { host: FormHost }) {
  const { config, update } = host
  const m = config.modelParams
  const modelOptions = host.models.flatMap((prov) =>
    prov.models.map((model) => ({
      value: prov.id + '::' + model.id,
      label: model.name + '（' + prov.name + '）',
    })),
  )
  const currentKey = m.provider ? m.provider + '::' + m.model : ''
  return (
    <div>
      <Field label="模型" hint="留空 = 跟随主模型（自动路由）">
        <Select
          value={currentKey}
          onChange={(key) => {
            const [provider, model] = key.split('::')
            update((c) => ({
              ...c,
              modelParams: { ...c.modelParams, provider: provider === '' ? null : provider, model: model ?? '' },
            }))
          }}
          options={modelOptions}
          placeholder="跟随主模型"
        />
      </Field>
      <Field label="温度">
        <Slider value={m.temperature} min={0} max={2} step={0.05} onChange={(v) => update((c) => ({ ...c, modelParams: { ...c.modelParams, temperature: v } }))} format={(v) => v.toFixed(2)} />
      </Field>
      <Field label="Top P" hint="暂未生效（DSH 尚未支持）；设置会正常持久化">
        <Slider value={m.topP} min={0} max={1} step={0.01} onChange={(v) => update((c) => ({ ...c, modelParams: { ...c.modelParams, topP: v } }))} format={(v) => v.toFixed(2)} />
      </Field>
      <div className="dap-field-row">
        <div style={{ flex: 1 }}>
          <Field label="思考强度">
            <Select
              value={m.reasoningEffort}
              onChange={(v) => update((c) => ({ ...c, modelParams: { ...c.modelParams, reasoningEffort: v as never } }))}
              options={EFFORT_OPTIONS}
            />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="最大 Token" hint="留空 = 无限制">
            <NumberInput value={m.maxTokens} min={1} step={1} onChange={(v) => update((c) => ({ ...c, modelParams: { ...c.modelParams, maxTokens: v } }))} placeholder="无限制" />
          </Field>
        </div>
      </div>
      <div className="dap-field-row">
        <div style={{ flex: 1 }}>
          <Field label="上下文消息限制" hint="携带最近 N 条；0 = 全部">
            <NumberInput value={m.contextLimit} min={0} step={1} onChange={(v) => update((c) => ({ ...c, modelParams: { ...c.modelParams, contextLimit: v ?? 0 } }))} />
          </Field>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div>
            <span className="dap-field-label">流式输出</span>
            <div style={{ marginTop: 4 }}>
              <Toggle checked={m.stream} onChange={(v) => update((c) => ({ ...c, modelParams: { ...c.modelParams, stream: v } }))} label={m.stream ? '开' : '关'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 系统提示词 ───────────────────────────────────────────────────────────────

export function PromptForm({ host }: { host: FormHost }) {
  const { config, update } = host
  const sp = config.systemPrompt
  const [varName, setVarName] = useState('')
  const [varValue, setVarValue] = useState('')
  const insertVar = (name: string) => {
    update((c) => ({ ...c, systemPrompt: { ...c.systemPrompt, template: sp.template + '{{' + name + '}}' } }))
  }
  const cvEntries = Object.entries(sp.customVariables)
  return (
    <div>
      <Field label="系统提示词模板" hint="支持 {{变量}} 与 {变量} 双语法">
        <textarea
          className="dap-textarea"
          rows={6}
          value={sp.template}
          onChange={(e) => update((c) => ({ ...c, systemPrompt: { ...c.systemPrompt, template: e.target.value } }))}
        />
      </Field>
      <Field label="内置变量" hint="点击插入到模板末尾（可手动再编辑位置）">
        <div className="dap-var-list">
          {SYSTEM_VARIABLES.map((v) => (
            <button key={v.name} type="button" className="dap-var-chip" title={v.description} onClick={() => insertVar(v.name)}>
              <code>{'{{' + v.name + '}}'}</code>
            </button>
          ))}
        </div>
      </Field>
      <Field label="自定义变量" hint="覆盖同名内置变量">
        {cvEntries.map(([k, v]) => (
          <div key={k} className="dap-tag-input-row" style={{ marginBottom: 6 }}>
            <input
              className="dap-text"
              value={k}
              placeholder="变量名"
              style={{ width: 140 }}
              onChange={(e) => {
                const nk = e.target.value
                update((c) => {
                  const cv = { ...c.systemPrompt.customVariables }
                  delete cv[k]
                  cv[nk] = v
                  return { ...c, systemPrompt: { ...c.systemPrompt, customVariables: cv } }
                })
              }}
            />
            <input
              className="dap-text"
              value={v}
              placeholder="变量值"
              style={{ flex: 1 }}
              onChange={(e) => update((c) => ({ ...c, systemPrompt: { ...c.systemPrompt, customVariables: { ...c.systemPrompt.customVariables, [k]: e.target.value } } }))}
            />
            <button type="button" className="dap-iconbtn danger" title="删除" onClick={() => {
              update((c) => {
                const cv = { ...c.systemPrompt.customVariables }
                delete cv[k]
                return { ...c, systemPrompt: { ...c.systemPrompt, customVariables: cv } }
              })
            }}>×</button>
          </div>
        ))}
        <div className="dap-tag-input-row">
          <input className="dap-text" value={varName} placeholder="新变量名" style={{ width: 140 }} onChange={(e) => setVarName(e.target.value)} />
          <input className="dap-text" value={varValue} placeholder="新变量值" style={{ flex: 1 }} onChange={(e) => setVarValue(e.target.value)} />
          <button
            type="button"
            className="dap-btn small"
            disabled={!varName.trim()}
            onClick={() => {
              update((c) => ({
                ...c,
                systemPrompt: {
                  ...c.systemPrompt,
                  customVariables: { ...c.systemPrompt.customVariables, [varName.trim()]: varValue },
                },
              }))
              setVarName('')
              setVarValue('')
            }}
          >添加</button>
        </div>
      </Field>
    </div>
  )
}

// ── 注入模式 ─────────────────────────────────────────────────────────────────

export function InjectionsForm({ host }: { host: FormHost }) {
  const { config, update } = host
  const set = (i: number, patch: Partial<InjectionBlock>) => {
    update((c) => ({
      ...c,
      injections: c.injections.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    }))
  }
  const add = () => {
    update((c) => ({
      ...c,
      injections: [...c.injections, {
        id: uid(), role: 'system', position: 'after', trigger: 'always', keywords: [], enabled: true, content: '',
      }],
    }))
  }
  return (
    <div>
      <div className="dap-edit-list">
        {config.injections.map((b, i) => (
          <div key={b.id} className="dap-edit-card">
            <div className="dap-edit-card-head">
              <span className="dap-field-label">注入块 #{i + 1}</span>
              <Toggle checked={b.enabled} onChange={(v) => set(i, { enabled: v })} label={b.enabled ? '开' : '关'} />
              <button type="button" className="dap-iconbtn danger" title="删除" onClick={() => update((c) => ({ ...c, injections: c.injections.filter((_, idx) => idx !== i) }))}>×</button>
            </div>
            <div className="dap-edit-grid">
              <Field label="角色">
                <Select value={b.role} onChange={(v) => set(i, { role: v as never })} options={[
                  { value: 'system', label: 'system（并入系统提示词段）' },
                  { value: 'user', label: 'user（独立用户消息）' },
                  { value: 'assistant', label: 'assistant（独立助手消息）' },
                ]} />
              </Field>
              <Field label="位置">
                <Select value={b.position} onChange={(v) => set(i, { position: v as never })} options={[
                  { value: 'before', label: 'before（模板之前）' },
                  { value: 'after', label: 'after（模板之后）' },
                  { value: 'replace', label: 'replace（替换模板）' },
                ]} />
              </Field>
              <Field label="触发">
                <Select value={b.trigger} onChange={(v) => set(i, { trigger: v as never })} options={[
                  { value: 'always', label: 'always（恒注入）' },
                  { value: 'keywords', label: 'keywords（命中关键词）' },
                ]} />
              </Field>
              {b.trigger === 'keywords' && (
                <Field label="关键词（逗号分隔）">
                  <TextInput
                    value={b.keywords.join(', ')}
                    onChange={(v) => set(i, { keywords: v.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })}
                  />
                </Field>
              )}
              <div className="wide">
                <Field label="内容（可含 {{变量}}）">
                  <textarea className="dap-textarea" rows={3} value={b.content} onChange={(e) => set(i, { content: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="dap-add-row">
        <button type="button" className="dap-btn" onClick={add}>+ 添加注入块</button>
      </div>
    </div>
  )
}

// ── 世界书 ───────────────────────────────────────────────────────────────────

export function WorldbookForm({ host }: { host: FormHost }) {
  const { config, update } = host
  const set = (i: number, patch: Partial<WorldbookEntry>) => {
    update((c) => ({
      ...c,
      worldbook: c.worldbook.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    }))
  }
  const add = () => {
    update((c) => ({
      ...c,
      worldbook: [...c.worldbook, {
        id: uid(), keys: [], content: '', priority: 100, position: 'before', enabled: true,
      }],
    }))
  }
  return (
    <div>
      <div className="dap-edit-list">
        {config.worldbook.map((e, i) => (
          <div key={e.id} className="dap-edit-card">
            <div className="dap-edit-card-head">
              <span className="dap-field-label">条目 #{i + 1}</span>
              <Toggle checked={e.enabled} onChange={(v) => set(i, { enabled: v })} label={e.enabled ? '开' : '关'} />
              <button type="button" className="dap-iconbtn danger" title="删除" onClick={() => update((c) => ({ ...c, worldbook: c.worldbook.filter((_, idx) => idx !== i) }))}>×</button>
            </div>
            <div className="dap-edit-grid">
              <Field label="触发关键词（逗号分隔）">
                <TextInput value={e.keys.join(', ')} onChange={(v) => set(i, { keys: v.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} />
              </Field>
              <div className="dap-field-row">
                <div style={{ flex: 1 }}>
                  <Field label="优先级">
                    <NumberInput value={e.priority} min={0} step={10} onChange={(v) => set(i, { priority: v ?? 0 })} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="位置">
                    <Select value={e.position} onChange={(v) => set(i, { position: v as never })} options={[
                      { value: 'before', label: 'before（最近 user 前）' },
                      { value: 'after', label: 'after（最近 user 后）' },
                    ]} />
                  </Field>
                </div>
              </div>
              <div className="wide">
                <Field label="内容（可含 {{变量}}）">
                  <textarea className="dap-textarea" rows={3} value={e.content} onChange={(ev) => set(i, { content: ev.target.value })} />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="dap-add-row">
        <button type="button" className="dap-btn" onClick={add}>+ 添加世界书条目</button>
      </div>
    </div>
  )
}

// ── Skill ────────────────────────────────────────────────────────────────────

export function SkillsForm({ host }: { host: FormHost }) {
  const { config, update } = host
  const enabledNames = new Set(config.skills.filter((s) => s.enabled).map((s) => s.name))
  const toggle = (skill: SkillInfo, on: boolean) => {
    update((c) => ({
      ...c,
      skills: on
        ? [...c.skills.filter((s) => s.name !== skill.name), { id: uid(), name: skill.name, description: skill.description, enabled: true }]
        : c.skills.filter((s) => s.name !== skill.name),
    }))
  }
  return (
    <div className="dap-edit-list">
      {host.skills.length === 0 && <div className="dap-empty">暂无可用 skill（Host /skills 为空）</div>}
      {host.skills.map((s) => (
        <div key={s.name} className="dap-edit-card" style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Toggle checked={enabledNames.has(s.name)} onChange={(v) => toggle(s, v)} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
              <div className="dap-field-hint">{s.description}{s.whenToUse ? '｜' + s.whenToUse : ''}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 记忆 ─────────────────────────────────────────────────────────────────────

export function MemoryForm({ host }: { host: FormHost }) {
  const { config, update } = host
  const mem = config.memory
  const [entries, setEntries] = useState<{ id: string; content: string; tags?: string[]; ts: number }[]>([])
  const [entryDraft, setEntryDraft] = useState('')
  const [memError, setMemError] = useState<string | null>(null)
  const [memLoading, setMemLoading] = useState(false)

  const refresh = async () => {
    try {
      const data = await listMemory(mem.globalMemory ? { global: true } : { assistantId: config.id })
      setEntries(data.entries)
      setMemError(null)
    } catch (e) {
      setMemError(apiErrorMessage(e))
    }
  }
  useEffect(() => { void refresh() }, [mem.globalMemory, config.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const addEntry = async () => {
    const content = entryDraft.trim()
    if (!content) return
    try {
      await createMemory({ content, assistantId: mem.globalMemory ? undefined : config.id })
      setEntryDraft('')
      void refresh()
    } catch (e) {
      setMemError(apiErrorMessage(e))
    }
  }

  const delEntry = async (id: string) => {
    try {
      await deleteMemory(id as never)
      void refresh()
    } catch (e) {
      setMemError(apiErrorMessage(e))
    }
  }

  return (
    <div>
      <Field label="记忆开关">
        <Toggle checked={mem.enabled} onChange={(v) => update((c) => ({ ...c, memory: { ...c.memory, enabled: v } }))} label={mem.enabled ? '开' : '关'} />
      </Field>
      <div className="dap-field-row">
        <div style={{ flex: 1 }}>
          <Field label="使用全局记忆池" hint="关 = 使用助手私有池">
            <Toggle checked={mem.globalMemory} onChange={(v) => update((c) => ({ ...c, memory: { ...c.memory, globalMemory: v } }))} label={mem.globalMemory ? '全局' : '私有'} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="参考聊天记录">
            <Toggle checked={mem.useChatHistory} onChange={(v) => update((c) => ({ ...c, memory: { ...c.memory, useChatHistory: v } }))} label={mem.useChatHistory ? '开' : '关'} />
          </Field>
        </div>
      </div>
      <Field label="时间间隔提醒（分钟）" hint="距上一次交互超过该值在发送前插入提醒；留空 = 关闭">
        <NumberInput value={mem.gapReminderMinutes} min={1} step={1} onChange={(v) => update((c) => ({ ...c, memory: { ...c.memory, gapReminderMinutes: v } }))} placeholder="关闭" />
      </Field>
      {mem.enabled && (
        <div style={{ marginTop: 6 }}>
          <Field label={mem.globalMemory ? '全局记忆条目' : '助手私有记忆条目'} hint="命中时注入系统提示词（最近 50 条检索取 top 5）">
            {memLoading && <div className="dap-loading"><span className="dap-spinner" />加载记忆…</div>}
            {memError && <div className="dap-status"><span className="err">{memError}</span></div>}
            <div className="dap-edit-list">
              {entries.map((e) => (
                <div key={e.id} className="dap-mem-card">
                  <p>{e.content}</p>
                  {e.tags && e.tags.length > 0 && <span className="dap-field-hint">{e.tags.join(', ')}</span>}
                  <button type="button" className="dap-iconbtn danger" title="删除" onClick={() => void delEntry(e.id)}>×</button>
                </div>
              ))}
            </div>
            <div className="dap-tag-input-row" style={{ marginTop: 8 }}>
              <input className="dap-text" value={entryDraft} placeholder="添加一条记忆…" style={{ flex: 1 }} onChange={(e) => setEntryDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addEntry() } }} />
              <button type="button" className="dap-btn small" disabled={!entryDraft.trim()} onClick={() => void addEntry()}>添加</button>
            </div>
          </Field>
        </div>
      )}
    </div>
  )
}
