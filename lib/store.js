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
import { randomUUID } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync, appendFileSync, } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, userInfo } from 'node:os';
import { parseAssistantConfig, parseCreateInput } from "./shared/schema.js";
/** 生成一个带前缀的随机 id。 */
export function uid(prefix) {
    return `${prefix}_${randomUUID()}`;
}
/**
 * 解析插件数据目录：
 * 配置 dataDir 优先；否则 ${DSH_HOME || ~/.dsh}/dsh-assistant-panel。
 */
export function resolveDataDir(envDshHome, configured) {
    if (configured)
        return configured;
    const home = envDshHome && envDshHome.trim() !== ''
        ? envDshHome
        : join(homedir(), '.dsh');
    return join(home, 'dsh-assistant-panel');
}
/** 确保目录存在（递归创建）。 */
export function ensureDir(dir) {
    mkdirSync(dir, { recursive: true });
}
/** 原子写 JSON 文件：写临时文件 + rename。 */
export function writeJsonAtomic(file, data) {
    ensureDir(dirname(file));
    const tmp = `${file}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    renameSync(tmp, file);
}
/** 读取 JSON 文件；不存在返回 undefined；解析失败抛出。 */
export function readJson(file) {
    if (!existsSync(file))
        return undefined;
    const text = readFileSync(file, 'utf8');
    return JSON.parse(text);
}
/** 向 JSONL 文件追加一行（目录自动创建）。 */
export function appendJsonl(file, entry) {
    ensureDir(dirname(file));
    appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
}
/** 读取 JSONL 全部行（过滤空行）。 */
export function readJsonl(file) {
    if (!existsSync(file))
        return [];
    const text = readFileSync(file, 'utf8');
    if (!text)
        return [];
    const rows = [];
    for (const line of text.split('\n')) {
        if (line.trim() === '')
            continue;
        try {
            rows.push(JSON.parse(line));
        }
        catch {
            // 跳过损坏行（append-only 崩溃安全设计容忍坏行）
        }
    }
    return rows;
}
/** 重写 JSONL（去行/排序用）：以给定行序列整体写回。 */
export function rewriteJsonl(file, rows) {
    ensureDir(dirname(file));
    writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length > 0 ? '\n' : ''), 'utf8');
}
const DEFAULT_PLUGIN_SETTINGS = {
    userName: '',
    locale: '',
    timezone: '',
    dataDir: '',
};
export class SettingsStore {
    dir;
    constructor(dir) {
        this.dir = dir;
    }
    file() {
        return join(this.dir, 'settings.json');
    }
    /** 读取已持久化的设置与存储目录。 */
    read() {
        const raw = readJson(this.file()) ?? {};
        const merged = { ...DEFAULT_PLUGIN_SETTINGS, ...raw };
        // 存储目录始终以设置中的 dataDir 为准（若有）；否则用缺省
        const dataDir = merged.dataDir && merged.dataDir.trim() !== ''
            ? merged.dataDir
            : resolveDataDir(process.env.DSH_HOME);
        return { settings: merged, dataDir };
    }
    /** 合并更新设置并原子落盘。 */
    update(patch) {
        const { settings } = this.read();
        const next = { ...settings, ...patch };
        writeJsonAtomic(this.file(), next);
        return next;
    }
    /** 当前解析出的 PluginProfile（默认值兜底）。 */
    profile() {
        const { settings, dataDir } = this.read();
        return {
            userName: settings.userName ?? '',
            locale: settings.locale ?? '',
            timezone: settings.timezone ?? '',
            dataDir,
        };
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// 助手档案 CRUD（assistants/*.json）
// ─────────────────────────────────────────────────────────────────────────────
export class AssistantStore {
    dir;
    constructor(baseDir) {
        this.dir = join(baseDir, 'assistants');
    }
    file(id) {
        return join(this.dir, `${id}.json`);
    }
    list() {
        if (!existsSync(this.dir))
            return [];
        const configs = [];
        for (const name of readdirSync(this.dir)) {
            if (!name.endsWith('.json'))
                continue;
            const id = name.slice(0, -'.json'.length);
            const config = this.get(id);
            if (config)
                configs.push(config);
        }
        return configs;
    }
    summaries() {
        return this.list().map((c) => ({
            id: c.id,
            name: c.profile.name,
            avatar: c.profile.avatar,
            tags: c.profile.tags,
            workspace: c.profile.workspace,
            updatedAt: c.profile.updatedAt,
        }));
    }
    get(id) {
        const file = this.file(id);
        if (!existsSync(file))
            return undefined;
        try {
            const raw = readJson(file);
            return raw === undefined ? undefined : parseAssistantConfig(raw);
        }
        catch {
            return undefined;
        }
    }
    /** 创建助手：id/时间戳由 host 生成，校验输入后落盘。 */
    create(input, id) {
        const parsed = parseCreateInput(input);
        const now = Date.now();
        const config = {
            id: (id ?? uid('asst')),
            profile: {
                ...parsed.profile,
                id: '', // 下方覆盖
                createdAt: now,
                updatedAt: now,
            },
            modelParams: parsed.modelParams,
            systemPrompt: parsed.systemPrompt,
            quickReplies: parsed.quickReplies ?? [],
            injections: parsed.injections ?? [],
            worldbook: parsed.worldbook ?? [],
            skills: parsed.skills ?? [],
            memory: parsed.memory,
        };
        config.profile.id = config.id;
        this.save(config);
        return config;
    }
    /** 全量保存（原子写）。 */
    save(config) {
        config.profile.updatedAt = Date.now();
        writeJsonAtomic(this.file(config.id), config);
    }
    /** 部分更新（patch 语义：顶级字段浅合并，profile 子对象整体替换）。 */
    update(id, patch) {
        const current = this.get(id);
        if (!current)
            return undefined;
        const next = { ...current };
        if (patch.profile) {
            next.profile = {
                ...current.profile,
                ...patch.profile,
                id: current.profile.id,
                createdAt: current.profile.createdAt,
            };
        }
        // 顶级字段
        if (patch.modelParams !== undefined)
            next.modelParams = { ...current.modelParams, ...patch.modelParams };
        if (patch.systemPrompt !== undefined)
            next.systemPrompt = { ...current.systemPrompt, ...patch.systemPrompt };
        if (patch.quickReplies !== undefined)
            next.quickReplies = patch.quickReplies;
        if (patch.injections !== undefined)
            next.injections = patch.injections;
        if (patch.worldbook !== undefined)
            next.worldbook = patch.worldbook;
        if (patch.skills !== undefined)
            next.skills = patch.skills;
        if (patch.memory !== undefined)
            next.memory = { ...current.memory, ...patch.memory };
        next.profile.updatedAt = Date.now();
        this.save(next);
        return next;
    }
    /** 删除助手档案（连带私有记忆池由调用方处理）。 */
    delete(id) {
        const file = this.file(id);
        if (!existsSync(file))
            return false;
        unlinkSync(file);
        return true;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// 记忆池（global-memory.jsonl / memory/<assistantId>.jsonl）
// ─────────────────────────────────────────────────────────────────────────────
export class MemoryStore {
    baseDir;
    constructor(baseDir) {
        this.baseDir = baseDir;
    }
    /** 池文件：global=true 用 global-memory.jsonl；否则 memory/<assistantId>.jsonl。 */
    file(global, assistantId) {
        if (global)
            return join(this.baseDir, 'global-memory.jsonl');
        return join(this.baseDir, 'memory', `${assistantId ?? 'unknown'}.jsonl`);
    }
    list(global, assistantId) {
        const rows = readJsonl(this.file(global, assistantId));
        if (global)
            return rows;
        const assistant = rows.map((r) => ({
            ...r,
            assistantId: assistantId ?? '',
        }));
        return assistant;
    }
    add(entry, global, assistantId) {
        appendJsonl(this.file(global, assistantId), entry);
    }
    /** 更新一条记忆（重写池文件；找不到返回 undefined）。 */
    update(id, patch, global, assistantId) {
        const rows = readJsonl(this.file(global, assistantId));
        const idx = rows.findIndex((r) => r.id === id);
        if (idx < 0)
            return undefined;
        const next = { ...rows[idx], ...patch };
        rows[idx] = next;
        rewriteJsonl(this.file(global, assistantId), rows);
        return global ? next : { ...next, assistantId: assistantId ?? '' };
    }
    delete(id, global, assistantId) {
        const rows = readJsonl(this.file(global, assistantId));
        const idx = rows.findIndex((r) => r.id === id);
        if (idx < 0)
            return false;
        rows.splice(idx, 1);
        rewriteJsonl(this.file(global, assistantId), rows);
        return true;
    }
    /** 取最近 N 条记忆（供提示词注入）。 */
    recent(global, assistantId, limit) {
        const rows = this.list(global, assistantId);
        return rows.slice(-limit);
    }
}
/** 从环境探测默认用户名（settings.userName 未设置时的兜底）。 */
export function detectUserName() {
    const env = process.env.USER ?? process.env.USERNAME;
    if (env && env.trim() !== '')
        return env;
    try {
        const info = userInfo();
        if (info.username)
            return info.username;
    }
    catch {
        // 忽略
    }
    return 'user';
}
//# sourceMappingURL=store.js.map