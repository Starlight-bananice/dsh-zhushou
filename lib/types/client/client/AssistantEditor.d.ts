/**
 * 助手档案编辑器（共享组件）：在管理面板（shell.overlay）与设置页（settings.section）
 * 两处复用同一套表单分节（forms.tsx）。props 提供 config + 更新器 + 枚举数据，
 * 保存/取消由调用方注入（保存 = PUT /assistants/:id）。
 */
import type { AssistantConfig } from '../shared/types.ts';
import type { ProviderInfo, SkillInfo, WorkspaceInfo } from '../shared/contracts.ts';
export interface AssistantEditorProps {
    config: AssistantConfig;
    enums: {
        models: ProviderInfo[];
        workspaces: WorkspaceInfo[];
        skills: SkillInfo[];
    };
    saving: boolean;
    /** 表单变更（受控；父层 setState）。 */
    onUpdate: (updater: (c: AssistantConfig) => AssistantConfig) => void;
    onSave: () => void;
    onCancel: () => void;
}
export declare function AssistantEditor({ config, enums, saving, onUpdate, onSave, onCancel }: AssistantEditorProps): import("react").JSX.Element;
//# sourceMappingURL=AssistantEditor.d.ts.map