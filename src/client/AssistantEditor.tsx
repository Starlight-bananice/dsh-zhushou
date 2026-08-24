/**
 * 助手档案编辑器（共享组件）：在管理面板（shell.overlay）与设置页（settings.section）
 * 两处复用同一套表单分节（forms.tsx）。props 提供 config + 更新器 + 枚举数据，
 * 保存/取消由调用方注入（保存 = PUT /assistants/:id）。
 */
import type { AssistantConfig } from '../shared/types.ts'
import type { ProviderInfo, SkillInfo, WorkspaceInfo } from '../shared/contracts.ts'
import type { FormHost } from './forms.tsx'
import {
  InjectionsForm,
  MemoryForm,
  ModelParamsForm,
  ProfileForm,
  PromptForm,
  SkillsForm,
  WorldbookForm,
} from './forms.tsx'

export interface AssistantEditorProps {
  config: AssistantConfig
  enums: { models: ProviderInfo[]; workspaces: WorkspaceInfo[]; skills: SkillInfo[] }
  saving: boolean
  /** 表单变更（受控；父层 setState）。 */
  onUpdate: (updater: (c: AssistantConfig) => AssistantConfig) => void
  onSave: () => void
  onCancel: () => void
}

export function AssistantEditor({ config, enums, saving, onUpdate, onSave, onCancel }: AssistantEditorProps) {
  const host: FormHost = {
    config,
    update: onUpdate,
    models: enums.models,
    workspaces: enums.workspaces,
    skills: enums.skills,
  }
  return (
    <div className="dap-editor">
      <div className="dap-editor-body">
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
      </div>
      <div className="dap-editor-foot">
        <span className="dap-field-hint">保存后同一会话继续沿用该档案配置（下一条消息起生效）。</span>
        <div className="dap-editor-actions">
          <button type="button" className="dap-btn" onClick={onCancel} disabled={saving}>取消</button>
          <button type="button" className="dap-btn primary" onClick={onSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
