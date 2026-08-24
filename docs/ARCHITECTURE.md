# ARCHITECTURE.md — @bananiceee/dsh-zhushou 架构说明

> 架构师产出（design）。依据：docs/DESIGN.md（研究员调研）+ DSH checkout 源码核实。
> 目标：给出 plugin 的进程划分、持久化布局、提示词组装管线、API 契约总览与关键决策。
> 与本文件配套的代码级契约：`src/shared/types.ts`（纯类型）、`src/shared/contracts.ts`（HTTP API + SSE 契约）、`src/shared/schema.ts`（host 侧 schemastery 校验）。
>
> ⚠️ **纠偏改造（2026-08-25）**：产品形态改为「主会话内激活助手对话」——独立聊天（/chat SSE + chats 存储 + ChatView）**整体退役**。
> §4 提示词组装管线、§5 时间提醒、§7 的 chat/chats 行已被 **docs/ARCHITECTURE-ACTIVATION.md**（激活管线 + 时间感知 + selection 契约）取代；以该文件为准。

---

## 目录

1. [进程划分](#1-进程划分)
2. [源码结构](#2-源码结构)
3. [持久化布局](#3-持久化布局)
4. [提示词组装管线](#4-提示词组装管线)
5. [时间提醒插入规则](#5-时间提醒插入规则)
6. [系统变量表](#6-系统变量表)
7. [HTTP API 总览](#7-http-api-总览)
8. [关键决策与取舍](#8-关键决策与取舍)

---

## 1. 进程划分

| 侧 | 运行环境 | 职责 | 依赖 | 禁止 |
|---|---|---|---|---|
| **host** | Node.js（cordis 插件进程，web profile） | 持久化、LLM 编排、提示词组装管线、HTTP API + SSE、记忆抽取、世界书匹配、变量解析 | `ctx.llm`、`ctx.webServer`、`ctx.skills`、`ctx.workspaceRegistry`、`ctx.settings`、node:fs | 不碰 UI；不 import `@deepseek-ai/dsh-client-*` |
| **client** | 浏览器（tsdown 打包 `lib/client.js`，ModuleLoader.load 注册） | 侧边栏入口、助手设置面板、聊天 UI、快捷回复、记忆/世界书/skill 管理 UI | `ctx.slots`（ui-slots/sidebar/settings/overlay）、`fetch/ReadableStream` | 不 import `@deepseek-ai/dsh-llm`、`schemastery`、`src/shared/schema.ts` |
| **shared** | 双端编译 | 纯类型（types.ts、contracts.ts）；schema.ts 仅 host | `import type` 为主 | types 无运行时值；client 不引 schema.ts |

**通信通道**：client → `fetch(API_BASE + ...)` → host `ctx.webServer` prefix 路由 → JSON / SSE。
侧边栏入口推荐：`sidebar.footer.action`（list/root，图标行）；助手面板放 `shell.overlay` 或 `details`；
设置面板走 `settings.section`（list/root，id+order+label）。详见 DESIGN.md §C3–C4。

---

## 2. 源码结构

```
src/
  index.ts            # host 入口：注册 webServer 路由 + 组装管线 + 记忆引擎（工程师实现）
  shared/
    types.ts          # 纯类型（零运行时，host/client 共用）
    contracts.ts      # API 契约（路由表 + 信封 + SSE 事件；纯类型 + 编译期常量）
    schema.ts         # schemastery 校验（host-only）
  client/
    index.ts          # client 入口：slots 注册 + UI 组件（工程师实现）
docs/
  DESIGN.md           # 研究员调研
  ARCHITECTURE.md     # 本文件
```

**导入规范**：相对导入带 `.ts` 扩展名（host tsconfig 开 `rewriteRelativeImportExtensions` + `allowImportingTsExtensions`；
client tsconfig 同开；tsdown 直接消费 `.ts` 说明符）。跨目录示例：`import type { AssistantConfig } from '../shared/types.ts'`。

---

## 3. 持久化布局

数据根：`${DSH_HOME || os.homedir() + '/.dsh'}/dsh-assistant-panel/`（对齐 status-bar 的 `ledgerDataDir(process.env.DSH_HOME)` 先例；可用插件设置 dataDir 覆盖）。

```
dsh-assistant-panel/
  settings.json            # 插件级设置（userName / locale / timezone / dataDir）
  selection.json           # ★ 会话级选择状态（sessionId → {assistantId, lastChatTs}；见 ARCHITECTURE-ACTIVATION.md §4）
  assistants/
    <assistantId>.json     # 一份 = 一个完整 AssistantConfig（原子写：tmp + rename）
  # chats/ 已退役：聊天历史由 DSH 会话（~/.dsh/sessions）承载
  global-memory.jsonl      # 全局记忆池（逐行 GlobalMemoryEntry）——仅 globalMemory=true 时读写
  memory/
    <assistantId>.jsonl    # 助手私有记忆池（逐行 AssistantMemoryEntry）——globalMemory=false 时读写
```

**规则**：
- **assistants/*.json**：完整 `AssistantConfig`（含 profile/modelParams/systemPrompt/quickReplies/injections/worldbook/skills/memory）。
  写入用「写临时文件 + rename」保证原子性；更新时全量替换（文件小、无需增量）。
- **chats/*.jsonl**：append-only；每行一个 `ChatMessage` JSON (`{id,role,content,ts,tokens?}`)。
  首行约定为该会话的元信息行 `{id, assistantId, title, createdAt, updatedAt}`（ChatSession 头部），
  读取时第一行解析为头部、其余为 messages。轮转：单文件超 10MB 归档为 `<chatId>.jsonl.1`。
- **记忆池**：append-only JSONL；删除条目时为重写文件（去行），不物理删历史（可选 tombstone）。
- 所有时间戳为 epoch 毫秒（`Timestamp`）。

> 为何 chats 用 JSONL：append-only 契合流式聊天落库（每帧消息只追加一行），崩溃安全，无需加载全量。

---

## 4. 提示词组装管线

每次聊天空闲组装（`buildPayload(assistant, chatRequest, runtime)`），**顺序固定**：

```
① 系统提示词模板 ──> ② 变量替换 ──> ③ 注入块 ──> ④ 世界书匹配 ──> ⑤ skill 说明
      ──> ⑥ 记忆注入 ──> ⑦ 时间间隔提醒 ──> ⑧ 历史消息截断(contextLimit)
      ──> 组装最终 messages 数组 ──> ctx.llm.stream
```

### 4.1 各步语义

1. **系统提示词模板**：取 `assistant.systemPrompt.template`；空串 → 无系统段（但 ③⑤⑥⑦ 各自生成段仍会并入）。
2. **变量替换**：单遍替换 `{{name}}` 与 `{name}` 双语法；变量表见 §6。替换对象 = 系统提示词、注入块 content、世界书 content、快捷回复 text、记忆文本——全部走同一 `resolveTemplate` 函数（DESIGN §C5）。
3. **注入块**（`assistant.injections`）：
   - `enabled=false` 跳过；`trigger='always'` 恒注入；`trigger='keywords'` 对最近 `contextLimit` 条历史做子串匹配（命中任一关键词即注入）。
   - 位置语义（`role` + `position`，简化自 RikkaHub 5 档）：
     - `role='system'`：`before` = 模板段之前；`after` = 模板段之后；`replace` = 替换模板段（模板本身内容丢弃）。
     - `role='user'/'assistant'`：注入为一条独立 user/assistant 消息，插到**最近 user 消息之前**（before）或**之后**（after）；position='replace' 对非 system 无效（host 忽略）。
   - 关键约束（DESIGN §A3）：**绝不插到「user 消息与其后紧跟 tool-call 的 assistant 消息」之间**——组装器检查该 pair，若命中则把注入挪到该 assistant 消息之后。
   - 同 role 同位置多条合并为一条消息（内容用换行拼接，RikkaHub 惯例）。
4. **世界书匹配**（`assistant.worldbook`）：
   - 对最近 `contextLimit` 条历史消息文本做大小写不敏感子串匹配（任一 key 命中即触发；skip disabled）。
   - 命中条目按 `priority` **降序**排列；若超 token 预算（host 常量 WB_TOKEN_BUDGET，默认 1024），从低优先级截断丢弃。
   - 插入：`position='before'` → 最近 user 消息前；`after` → 最近 user 消息后（合并成一条 system 消息发出，避免污染对话角色）。
5. **skill 说明**：`assistant.skills.filter(enabled)` → 每项生成一行 `- {name}: {description}（{whenToUse}）`，作为 system 段的一个子节追加。
6. **记忆注入**：
   - 池选择：`memory.globalMemory ? global-memory.jsonl : memory/<assistantId>.jsonl`。
   - 检索：取最近 50 条记忆，按「关键词交集（与最近 user 消息重合）+ 时间衰减」打分取 top 5（内存条目少时可全取）。
   - 注入：作为 system 段子节 `[记忆] ...`；`memory.useChatHistory=true` 时额外把最近会话摘要（首条 user 消息截断 200 字）纳入。
7. **时间间隔提醒**：见 §5。生成一行 system 段（或独立 system 消息）插到新 user 消息之前。
8. **历史消息截断**：取最近 `contextLimit` 条（`contextLimit=0` 表示全部；组装时仍按 §4.1-3 的约束保留 user→assistant pair 完整性）。
9. **最终 messages**：`[system 段] + [截断历史] + [注入 user/assistant 消息] + [新 user 消息]`；
   调 `ctx.llm.stream({ provider, model, system, messages, temperature, maxTokens, reasoningEffort, ... })`。

> 结果文本聚合（host）：`for await (chunk of stream) if (chunk.type === 'text-delta') …`（DESIGN §B1）。流式情况下逐帧转发 SSE。

---

## 5. 时间提醒插入规则

> ⚠️ **已废弃（纠偏改造）**：本节约 2026-08-25 起不再实现——时间提醒改为「时间感知开关」（自然上下文行注入，见 ARCHITECTURE-ACTIVATION.md §3），`gapReminderMinutes` 已从契约中移除，代码中不再生成 `[时间提醒]` 消息。以下原文仅作历史记录保留。

- **开关**：`memory.enabled && memory.gapReminderMinutes !== null`（默认 30）。
- **判定**：`now - lastUserMessageTs >= gapReminderMinutes * 60_000`。
  - `lastUserMessageTs` = 当前会话最后一条 user 消息的 ts（从 chats/<chatId>.jsonl 读取；无历史则用会话 createdAt）。
- **插入内容**（替换后的模板，缺省如下）：
  ```
  [时间提醒] 距上一次交流已过去 {gap}。现在是 {localtime}。请结合当前时间来作答。
  ```
  (`{gap}` = 人类可读间隔如「45 分钟」/「2 小时」；`{localtime}` = 用户时区本地时间)
- **位置**：作为独立 system 消息插在**新的 user 消息之前**（不进历史，不入库；只影响本次请求）。
- **触发后重置**：本次 user 消息入账后 `lastUserMessageTs` 自然更新，下次判定自然失效。

---

## 6. 系统变量表

内置变量（host 解析；来源见表格）。支持 `{{name}}` 与 `{name}` 双语法；`customVariables` 覆盖同名内置变量。

| 变量 | 含义 | 来源 |
|---|---|---|
| `{{cur_date}}` | 本地日期（如 2026-08-25） | `Intl.DateTimeFormat` + 插件 timezone |
| `{{cur_time}}` | 本地时间（如 14:30） | 同上 |
| `{{cur_datetime}}` | 本地日期时间完整串 | 同上 |
| `{{model_id}}` | 本次使用的模型 id | 解析后的 `modelParams.model`（`resolveModelInfo`） |
| `{{model_name}}` | 模型显示名 | `resolveModelInfo` 的 name |
| `{{timezone}}` | 时区（IANA，如 Asia/Shanghai） | 插件设置 `timezone` → `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| `{{locale}}` | 语言环境（如 zh） | 插件设置 `locale` → `ctx.settings.section('locale').get().preference` |
| `{{user_name}}` | 用户昵称 | 插件设置 `userName` → 缺省 `process.env.USER` / OS 用户名 |
| `{{assistant_name}}` | 助手名称 | `assistant.profile.name` |
| `{{assistant_tags}}` | 助手标签（逗号分隔） | `assistant.profile.tags.join(', ')` |
| `{{workspace}}` | 绑定工作区标题 | `ctx.workspaceRegistry.get(profile.workspace)?.title`；未绑定 = 空串 |
| `{{chat_count}}` | 本会话消息条数 | 组装时历史消息长度 |

> 实现（DESIGN §B4）：DSH 内置系统变量仅 provider/model/cwd；以上变量由插件在 host 侧自建 `resolveTemplate` 统一替换
> （可选同时 `ctx.systemPrompt.variable(name, fn)` 向官方提示词段注册，但本插件自建替换器为主，避免依赖官方 system 段）。

---

## 7. HTTP API 总览

完整契约在 `src/shared/contracts.ts`（路由表 + 请求/响应形状 + SSE 事件）。这里只列总览：

| 方法/路径 | 用途 |
|---|---|
| `GET /assistant-panel/api/health` | 健康检查（版本/dataDir/uptime） |
| `GET/POST /assistant-panel/api/assistants` | 列表摘要 / 创建 |
| `GET/PUT/DELETE /assistant-panel/api/assistants/:id` | 读取 / 部分更新 / 删除 |
| ~~`POST /assistant-panel/api/chat`~~ | ~~SSE 聊天~~（已退役，见 ARCHITECTURE-ACTIVATION.md） |
| ~~`GET /assistant-panel/api/chats…`~~ | ~~会话列表 / 历史 / 删除~~（已退役） |
| `GET /assistant-panel/api/selection?sessionId=` / `POST /selection` | 会话级助手激活/取消（新；{sessionId, assistantId\|null}） |
| `GET/POST/PUT/DELETE /assistant-panel/api/memory[… ]` | 记忆条目 CRUD（global / 私有池） |
| `GET /assistant-panel/api/skills?cwd=` | skill 枚举（ctx.skills.list） |
| `GET /assistant-panel/api/models` | 提供商/模型枚举（ctx.llm.listProviders/listModels/resolveModelInfo） |
| `GET /assistant-panel/api/workspaces` | 工作区枚举（ctx.workspaceRegistry.list） |
| `GET/PUT /assistant-panel/api/profile` | 插件 profile 读写（userName/locale/timezone/dataDir） |

- **统一信封**：`{ ok: true, data }` / `{ ok: false, error: { code, message, details? } }`。
- **JSON 响应头**（status-bar 先例）：`content-type: application/json; charset=utf-8` + `cache-control: no-store` + `connection: close`。
- **SSE**（hmr 先例）：`content-type: text/event-stream` + `cache-control: no-cache` + `connection: keep-alive`；
  首帧 `: connected` 心跳注释；事件帧 `event: <type>` + `data: <json>`；空闲 15s 发 `: ping`；
  client 用 `fetch` + `ReadableStream` 逐行读取（EventSource 不支持 POST）。
- **错误码**：`BAD_REQUEST / NOT_FOUND / CONFLICT / UNSUPPORTED / LLM_ERROR / INTERNAL / ABORTED`。

---

## 8. 关键决策与取舍

1. **topP 保留但暂不下发**：DSH `GenerateOptions`/`LlmCallConfig` 无 topP 字段（DESIGN §B1 核实）。
   实现为「UI/校验/持久化保留 `topP`，stream 调用忽略并注释说明」，等官方加字段再接（不构造伪参数）。
2. **reasoningEffort 'medium' 就近映射**：DSH 现仅 off/low/high/max 四档；`'medium'` 由 host 映射到 `'low'`（或该模型最近档），文档注明。`'auto'` → 不传（provider 默认）。
3. **provider=null 自动路由**：捕获主模型路由（`ctx.on('llm/stream')` waterfall 记录 lastRoute，DESIGN §B2 先例）；
   解析变量 `{{model_id}}`/`{{model_name}}` 时用该路由；无捕获时回退 `resolveModelInfo` 默认 / 配置 model。
4. **schema 仅 host 用**：client 打包（browser）不引入 schemastery；校验集中在 host repository 层
   （`parseAssistantConfig` 等，schema.ts 提供）。client 只消费纯类型。
5. **存储原子性**：assistants/*.json 写 tmp+rename；JSONL append-only + 轮转；删除重写。崩溃安全优先于性能。
6. **内存抽取**（后续工程师实现）：已留契约位（SSE `memory-saved` 事件 + memory 管理 API）；抽取用
   `ctx.llm.stream`（reasoningEffort off / temperature 0 / 短 maxTokens）在 `session/event` 的 `assistant/message` 落库后异步跑，不阻塞主聊天流。
7. **头像存储**：dataURL 直接存 `profile.avatar`（简单；体积超 512KB 时建议降采样后存）；URL 原样存。
8. **安全**：所有 API 为同源/localhost 本机服务，不做鉴权；client 只经 API_BASE 访问；不做任意文件读写接口。

