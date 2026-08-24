import type { AssistantSummary, CreateMemoryRequest, HealthInfo, ProviderInfo, SkillInfo, UpdateAssistantInput, UpdateMemoryRequest, WorkspaceInfo } from '../shared/contracts.ts';
import type { AssistantConfig, AssistantId, AssistantMemoryEntry, AssistantProfile, GlobalMemoryEntry, MemoryEntryId, SessionSelection } from '../shared/types.ts';
/** 业务错误（信封 error 归一）。 */
export declare class ApiError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** 从任意异常取展示文案。 */
export declare function apiErrorMessage(e: unknown): string;
export declare function getHealth(): Promise<HealthInfo>;
export type CreateAssistantBody = Omit<AssistantConfig, 'id' | 'profile'> & {
    profile: Omit<AssistantProfile, 'id' | 'createdAt' | 'updatedAt'>;
};
export declare function listAssistants(): Promise<{
    assistants: AssistantSummary[];
}>;
export declare function createAssistant(input: CreateAssistantBody): Promise<{
    assistant: AssistantConfig;
}>;
export declare function getAssistant(id: AssistantId): Promise<{
    assistant: AssistantConfig;
}>;
export declare function updateAssistant(id: AssistantId, patch: UpdateAssistantInput): Promise<{
    assistant: AssistantConfig;
}>;
export declare function deleteAssistant(id: AssistantId): Promise<{
    id: AssistantId;
}>;
/** GET /selection?sessionId=xxx → 当前会话选择状态（无条目 → assistantId null）。 */
export declare function getSelection(sessionId: string): Promise<{
    selection: SessionSelection;
}>;
/** POST /selection → 激活（assistantId 非 null）/ 取消（null）。返回落盘后的状态。 */
export declare function setSelection(sessionId: string, assistantId: AssistantId | null): Promise<{
    selection: SessionSelection;
}>;
export declare function listMemory(query: {
    assistantId?: AssistantId;
    global?: boolean;
}): Promise<{
    entries: GlobalMemoryEntry[] | AssistantMemoryEntry[];
}>;
export declare function createMemory(req: CreateMemoryRequest): Promise<{
    entry: GlobalMemoryEntry | AssistantMemoryEntry;
}>;
export declare function updateMemory(id: MemoryEntryId, req: UpdateMemoryRequest): Promise<{
    entry: GlobalMemoryEntry | AssistantMemoryEntry;
}>;
export declare function deleteMemory(id: MemoryEntryId): Promise<{
    id: MemoryEntryId;
}>;
export declare function listSkills(): Promise<{
    skills: SkillInfo[];
}>;
export declare function listModels(): Promise<{
    providers: ProviderInfo[];
}>;
export declare function listWorkspaces(): Promise<{
    workspaces: WorkspaceInfo[];
}>;
//# sourceMappingURL=api.d.ts.map