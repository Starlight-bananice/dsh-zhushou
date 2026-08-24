/**
 * dsh-assistant-panel — host 存储层。
 *
 * 数据布局（docs/ARCHITECTURE.md §3 + ARCHITECTURE-ACTIVATION §5）：
 *   <dataDir>/
 *     settings.json        # 插件级设置（userName/locale/timezone/dataDir）
 *     assistants/<id>.json # 助手档案（原子写：tmp + rename）
 *     selection.json       # 会话级选择状态（SelectionStore；见 src/selection.ts）
 *     global-memory.jsonl  # 全局记忆池
 *     memory/<assistantId>.jsonl  # 助手私有记忆池
 *
 * 聊天历史退役：chats/ 目录不再创建/读取（由 DSH SessionStore 承载，插件不复制）。
 * 原子性：assistants/*.json 写临时文件后 rename；JSONL append-only（崩溃安全）；
 * 删除记忆条目时重写文件（去行）。
 */
import type { AssistantConfig, AssistantId, AssistantMemoryEntry, AssistantSummary, GlobalMemoryEntry, MemoryEntryId } from './shared/types.ts';
import type { CreateAssistantInput, PluginProfile, UpdateAssistantInput } from './shared/contracts.ts';
/** 生成一个带前缀的随机 id。 */
export declare function uid(prefix: string): string;
/**
 * 解析插件数据目录：
 * 配置 dataDir 优先；否则 ${DSH_HOME || ~/.dsh}/dsh-assistant-panel。
 */
export declare function resolveDataDir(envDshHome: string | undefined, configured?: string): string;
/** 确保目录存在（递归创建）。 */
export declare function ensureDir(dir: string): void;
/** 原子写 JSON 文件：写临时文件 + rename。 */
export declare function writeJsonAtomic(file: string, data: unknown): void;
/** 读取 JSON 文件；不存在返回 undefined；解析失败抛出。 */
export declare function readJson<T>(file: string): T | undefined;
/** 向 JSONL 文件追加一行（目录自动创建）。 */
export declare function appendJsonl(file: string, entry: unknown): void;
/** 读取 JSONL 全部行（过滤空行）。 */
export declare function readJsonl<T>(file: string): T[];
/** 重写 JSONL（去行/排序用）：以给定行序列整体写回。 */
export declare function rewriteJsonl(file: string, rows: unknown[]): void;
/** 插件级 profile 的落盘形状。 */
export interface StoredSettings {
    userName?: string;
    locale?: string;
    timezone?: string;
    dataDir?: string;
}
export declare class SettingsStore {
    private readonly dir;
    constructor(dir: string);
    private file;
    /** 读取已持久化的设置与存储目录。 */
    read(): {
        settings: StoredSettings;
        dataDir: string;
    };
    /** 合并更新设置并原子落盘。 */
    update(patch: Partial<StoredSettings>): StoredSettings;
    /** 当前解析出的 PluginProfile（默认值兜底）。 */
    profile(): PluginProfile;
}
export declare class AssistantStore {
    private readonly dir;
    constructor(baseDir: string);
    private file;
    list(): AssistantConfig[];
    summaries(): AssistantSummary[];
    get(id: AssistantId): AssistantConfig | undefined;
    /** 创建助手：id/时间戳由 host 生成，校验输入后落盘。 */
    create(input: CreateAssistantInput, id?: AssistantId): AssistantConfig;
    /** 全量保存（原子写）。 */
    save(config: AssistantConfig): void;
    /** 部分更新（patch 语义：顶级字段浅合并，profile 子对象整体替换）。 */
    update(id: AssistantId, patch: UpdateAssistantInput): AssistantConfig | undefined;
    /** 删除助手档案（连带私有记忆池由调用方处理）。 */
    delete(id: AssistantId): boolean;
}
export declare class MemoryStore {
    private readonly baseDir;
    constructor(baseDir: string);
    /** 池文件：global=true 用 global-memory.jsonl；否则 memory/<assistantId>.jsonl。 */
    private file;
    list(global: boolean, assistantId?: AssistantId): Array<GlobalMemoryEntry | AssistantMemoryEntry>;
    add(entry: GlobalMemoryEntry | AssistantMemoryEntry, global: boolean, assistantId?: AssistantId): void;
    /** 更新一条记忆（重写池文件；找不到返回 undefined）。 */
    update(id: MemoryEntryId, patch: {
        content?: string;
        tags?: string[];
    }, global: boolean, assistantId?: AssistantId): GlobalMemoryEntry | AssistantMemoryEntry | undefined;
    delete(id: MemoryEntryId, global: boolean, assistantId?: AssistantId): boolean;
    /** 取最近 N 条记忆（供提示词注入）。 */
    recent(global: boolean, assistantId: AssistantId | undefined, limit: number): Array<GlobalMemoryEntry | AssistantMemoryEntry>;
}
/** 从环境探测默认用户名（settings.userName 未设置时的兜底）。 */
export declare function detectUserName(): string;
