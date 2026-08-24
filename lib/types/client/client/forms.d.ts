import type { AssistantConfig } from '../shared/types.ts';
import type { ProviderInfo, SkillInfo, WorkspaceInfo } from '../shared/contracts.ts';
/** 表单上下文：config + 更新器 + 枚举数据。 */
export interface FormHost {
    config: AssistantConfig;
    update: (updater: (c: AssistantConfig) => AssistantConfig) => void;
    models: ProviderInfo[];
    workspaces: WorkspaceInfo[];
    skills: SkillInfo[];
}
export declare function ProfileForm({ host }: {
    host: FormHost;
}): import("react").JSX.Element;
export declare function ModelParamsForm({ host }: {
    host: FormHost;
}): import("react").JSX.Element;
export declare function PromptForm({ host }: {
    host: FormHost;
}): import("react").JSX.Element;
export declare function InjectionsForm({ host }: {
    host: FormHost;
}): import("react").JSX.Element;
export declare function WorldbookForm({ host }: {
    host: FormHost;
}): import("react").JSX.Element;
export declare function SkillsForm({ host }: {
    host: FormHost;
}): import("react").JSX.Element;
export declare function MemoryForm({ host }: {
    host: FormHost;
}): import("react").JSX.Element;
//# sourceMappingURL=forms.d.ts.map