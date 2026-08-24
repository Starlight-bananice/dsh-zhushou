# DESIGN.md — @dsh-external/dsh-assistant-panel 设计调研

> 研究员产出（research）。目标：为 DSH 插件 **@dsh-external/dsh-assistant-panel**（侧边栏助手，参考 RikkaHub 功能面）提供设计依据。
> 调研方式：RikkaHub 官方文档实测抓取（docs.rikka-ai.com）+ DSH checkout 源码逐包核对（/Users/a64485/deepseek-harness，只读）。
> 日期：2026-08-25。本文件是**调研与设计建议**，不是实现代码；架构师/工程师以此为依据细化。

---

## 0. 结论速览（TL;DR）

| 需求（用户给定） | 结论 | 落地方式 |
|---|---|---|
| 助手档案（名称/头像/标签/工作区） | 自己实现；DSH 无 persona/profile 概念 | 插件自有 settings section（ctx.settings.namespace）+ 自有 JSON 存储 |
| 模型参数（模型/温度/topP/上下文/流式/思考强度/最大token） | 直接复用 | ctx.llm.stream(GenerateOptions)，字段 1:1 映射；模型枚举走 ctx.llm.listProviders()/listModels()/resolveModelInfo() |
| 系统提示词 + 系统变量（如 user_name 等） | 系统提示词复用，变量需自己注册 | ctx.systemPrompt.section() 注册提示词段；ctx.systemPrompt.variable(name, fn) 注册变量 |
| 快捷回复（Quick Replies） | 自己实现（纯数据 + UI） | 插件 settings 存模板列表，client 注入到对话/输入区 |
| 注入模式 / 世界书（worldbook） | 自己实现（DSH 无注入引擎） | 仿 RikkaHub 语义：position/priority/trigger/token budget；组装请求时插入 messages/system |
| skill 列表 | 直接复用 | ctx.skills.list({cwd}) → SkillSummary[]（name/description） |
| 记忆（开关/全局/参考聊天/时间间隔提醒） | 自己实现（无官方 memory 服务） | JSONL 存 DSH_HOME（约 ~/.dsh）下；快速模型抽取由插件调 ctx.llm.stream 实现 |
| 侧边栏 UI 入口 | 推荐 sidebar.footer.action（list, root）或 shell.overlay（list, root） | client 侧 ctx.slots.register（React 组件） |
| 配置面板 | settings.section（list, root） | 注册一个设置页（id/order/label） |
| 数据存放 | DSH_HOME（约 ~/.dsh）下的插件私有目录 | 例 ~/.dsh/dsh-assistant-panel/*.jsonl |

---

## A. RikkaHub 功能面（需求映射依据）

> RikkaHub（rikkahub/rikkahub）：**原生 Android 多 LLM 提供商 AI 聊天应用**，理念上与 SillyTavern 同源（支持导入 SillyTavern 角色卡 PNG/JSON v2/v3）。它不是 DSH 插件，而是我们**功能对标物**。以下按官方文档逐项摘录（来源：docs.rikka-ai.com：assistants/overview、assistants/memory、assistants/prompt-injection、extensions/skills、extensions/workspace）。

### A.1 助手（Assistant）= 可切换的「人设 + 模型 + 参数」档案
- **字段**：名称、头像（可用作聊天内替代模型图标）、标签（tag 过滤）、**模型覆盖**（指定 provider+model，留空用全局默认）、系统提示词、生成参数、预设消息、MCP/localTools、enabledSkills、背景图。
- **生成参数**：temperature（0-2，null=模型默认）、topP（null=默认，避免同时设 temperature+topP）、maxTokens、reasoningLevel（AUTO 等）、streamOutput（默认 true）、contextMessageSize（携带的最近消息条数，0=全部）。
- **切换**：聊天工具栏点助手名/头像 → picker；切换立即对下一条消息生效。
- **import Tavern PNG/JSON + regex transformers**（对发送/显示消息做 find-replace，支持 visual-only）。

### A.2 快捷消息 / Quick Messages
- **快捷回复**：预写消息模板（标题+内容），绑定到某个助手；聊天中点图标一键发送（如 summarize 或 translate）。→ 我们的「快捷回复」需求即此。

### A.3 注入模式（Mode Injection）与世界书（Lorebook）机制惯例（重点核实）
- **Mode Injection**：手动开关的固定片段。开启后只要该助手激活就**始终注入**（不依赖关键词）。
- **Lorebook**：命名条目集合；每条目带**关键词**，近期消息命中关键词才注入。条目字段（官方原文）：
  - **Keywords**（触发词/模式）、**Content**（注入文本）、**Injection position** + **role**（User|Assistant）、**Scan depth**（回溯多少条最近消息做匹配）、**Use regex**、**Case sensitive**、**Constant active**（无条件注入，等同常驻 mode injection）。
- **注入位置（Injection positions）**：Before System Prompt / After System Prompt（最常见） / Top of Chat（首个 user 消息前） / Bottom of Chat（最近 user 消息前） / At Depth（距末尾 n 条消息处）。
- **优先级**：同位置多条注入按**优先级降序**（数字大者先注入）；同 role 同位置的多条注入**合并成一条消息**。
- **关键约束**：不要插到「用户消息与其后紧跟带 tool calls 的助手消息」之间（如 DeepSeek 要求相邻才能正确推理）。
- **助手级开关**：modeInjectionIds（set）、lorebookIds（set）、allowConversationSystemPrompt、allowConversationPromptInjection（每会话覆盖）。
- **messageTemplate**：每条出站用户消息的包装模板，默认 {{message}}，必须包含占位符否则报错。
- **占位变量（placeholder variables）**：{{cur_date}}/{{cur_time}}/{{cur_datetime}}（本地化日期时间）、{{model_id}}/{{model_name}}、{{locale}}、{{timezone}}、{{system_version}}、{{device_info}}、{{nickname}}、{{user}}、{{char}}；支持 {{var}} 与 {var} 两种语法。
- **扫描预算**：世界书命中后按 token 预算决定注入多少条，超出预算的条目被截断/丢弃（SillyTavern lorebook 惯例，字段语义与此一致）。

### A.4 记忆（Memory）
- **机制**：配置的 **fast model** 在会话中抽取事实 → 离散 memory entries；下个新会话开始前注入相关条目。
- **开关**：enableMemory（总开关）、useGlobalMemory（共享全局池 vs 助手私有池，默认私有）、enableRecentChatsReference（可引用最近聊天摘要）、enableTimeReminder（注入时间间隔提醒：距上次交互多久）。
- **管理**：可查看/编辑/删除/手动新增记忆条目；删除永久生效。

### A.5 Skill（能力包）
- 结构：目录 + SKILL.md（YAML frontmatter：name 必填唯一、description 必填、compatibility/allowed-tools 可选），正文为指令。
- 安装方式：GitHub 仓库 / zip / 手动粘贴；**启用**：按助手开关（Enabled Skills），激活时指令并入系统提示词。

### A.6 Workspace（工作区）
- 轻量 Linux 环境（rootfs + 文件管理 + 终端 + 工具审批）；**一个助手可绑定一个工作区**。→ 我们需求里的「工作区」字段对齐 DSH 的 workspace 实体（见 B5）。

---

## B. DSH 官方 API 面（checkout 源码核实，含路径与签名）

> 均核对自 /Users/a64485/deepseek-harness（packages/*）。

### B1. dsh-llm：ctx.llm.stream(options)（包：@deepseek-ai/dsh-llm）

**文件**：packages/llm/llm/src/index.ts（LlmRuntime，stream 在 985 行）、call-config.ts、message.ts、types.ts、brand.ts。

- 服务注入：export const inject = ['llm']；类型 import type LlmService from '@deepseek-ai/dsh-llm'。
- **ctx.llm.stream(options: GenerateOptions): AsyncIterable<StreamChunk>**（index.ts:985）——每条对话请求的入口；经 llm/stream waterfall（可被监听/改写，需 next() 委托，index.ts:48）。
- **GenerateOptions（types.ts:330-377 全文核实）**：

    interface GenerateOptions {
      provider: string            // 注册的 provider 路由，决定 adapter
      model: string
      reasoningEffort?: ReasoningEffortId
      messages: Message[]         // provider 实际看到的顺序消息（system 之后）
      system?: string             // 系统提示词（adapter 映射到 provider 的 system slot）★
      tools?: ToolSchema[]
      temperature?: number
      maxTokens?: number
      stop?: string[]
      signal?: AbortSignal
      sessionId?: Branded<'SessionId'>
      purpose?: 'compaction' | 'session-title'
    }

  > 注：LlmCallConfig（call-config.ts）只有 provider/model/reasoningEffort/temperature/maxTokens/stop——**topP 不在官方字段**；GenerateOptions 同样没有 topP。
  > **结论：需求里的 topP 要么等官方增加，要么经 adapter 私有渠道（暂无公开机制），要么 UI 保留字段但对底层忽略/仅存配置。（架构建议见 C2）**

- **StreamChunk（types.ts:244-262）**：

    type StreamChunk =
      | { type: 'block-start'; index: number; blockType: ContentBlockType }
      | { type: 'text-delta'; index: number; text: string }
      | { type: 'reasoning-delta'; index: number; text: string }
      | { type: 'tool-call-delta'; index: number; id: CallId; name?: string; argumentsDelta: string }
      | { type: 'block-end'; index: number; block: ContentBlock }
      | { type: 'usage'; usage: TokenUsage }
      | { type: 'finish'; reason: FinishReason; replayState?: ReplayEnvelope }

  组装文本：for await (const chunk of stream) { if (chunk.type === 'text-delta') text += chunk.text }（守护循环骨架 src/index.ts 已示范）。
- **ReasoningEffort（brand.ts + llm-deepseek/src/adapter.ts:163-166）**：ReasoningEffortId('off'|'low'|'high'|'max')，DeepSeek adapter 暴露 4 档（Off/Low/High/Max）。
- **消息构造（message.ts）**：

    createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] })
    createAssistantMessage({ content: [...], source: { provider, model } })  // source.kind 自动为 'model'
    createToolResultMessage({ callId, content, isError })
    createMessage({ role, content, source })  // 通用

  全部返回 deep-frozen Message（含 id: MessageId、role、content: ContentBlock[]、source: MessageSource）。图片用 { type:'image', attachment: ImageAttachmentRef }。

### B2. 模型/提供商枚举（正确方式 = host 侧 API）

**文件**：packages/host/apiproxy/src/api/llm.ts（RPC 契约）、api-proxy.ts:273 buildModelCatalog、packages/llm/llm/src/index.ts。

- **host 侧（插件内直接可用）**：
  - ctx.llm.listProviders(): LlmProviderInfo[]（index.ts:446，{id, name}）
  - ctx.llm.listModels(provider): Promise<LlmModelInfo[]>（index.ts:608，{provider,id,name,description?,inputModalities?}）
  - ctx.llm.resolveModelInfo(provider, model): Promise<LlmResolvedModelInfo>（index.ts:646，附 context.contextWindow、reasoning.efforts[]、defaultEffort、defaultMaxTokens）
  - 变更通知：**ctx.on('llm/adapters-updated', ...)**（emit 事件，index.ts:29）。
  - ctx.llm.discoverModels(settingsNs, request)（index.ts:559）：面向配置面板的端点探测，需 provider 或 baseURL。
- **官方 UI 的枚举示例**（client 侧不能直接调 llm 服务，走 RPC）：ui-model-selection 调 connection.api.sessions.models({sessionId}) → {current, routable, groups, failures}；groups 由 host 的 buildModelCatalog（api-proxy.ts:273）= Promise.all(ctx.llm.listProviders().map(p => ctx.llm.listModels(p.id) → resolveModelInfo)) 生成。**我们的插件若有 host 侧逻辑，直接用 ctx.llm 三个方法即可，不必自建 RPC。**
- **兜底数据源**（本机 ~/.dsh/settings.yaml，已核实）：llm-deepseek.models[]（id/name/contextWindow）、llm-pi-ai.providers.<name>.models[]（id/name/contextWindow/maxTokens）、agent-default-model{provider: vision-toolkit-opencode-go, model: deepseek-v4-pro, reasoningEffort: max}。字符串 provider 名 vision-toolkit-opencode-go 来自 agent-default-model 的路由名。
- **llm/stream waterfall 监听**（捕获主模型路由的备选方案，守护循环骨架已有先例）：ctx.on('llm/stream', (options, next) => { route = {provider: options.provider, model: options.model}; return next() })。

### B3. ctx.webServer 路由注册 + SSE（包：@deepseek-ai/dsh-host-webserver）

**文件**：packages/host/webserver/src/index.ts；SSE 权威范例 packages/client/hmr/src/index.ts:140-200（/plugins/events 通道）；status-bar 的 JSON API 范例 /Users/a64485/Documents/dsh/dsh-status-bar/src/index.ts:30-105。

- 服务注入：export const inject = ['webServer']（status-bar:39）。
- **ctx.webServer.register(route): () => void**（index.ts:108）：

    interface WebRoute {
      kind: 'exact' | 'prefix'           // exact 完全匹配；prefix 匹配 p 与 p/<anything>
      path: string                       // 绝对路径，无尾斜杠
      handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
    }

  注释原文：「Owns the full response lifecycle (may hold the response open, e.g. SSE)」。
- **SSE 服务端模式（hmr 原文）**：

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
    })
    res.write(': connected\n\n')                          // 心跳注释行
    res.write('data: ' + JSON.stringify(frame) + '\n\n')   // SSE data 帧
    connections.add(res)
    res.on('close', () => connections.delete(res))

  广播：for (const res of connections) res.write(line)；dispose 时 res.destroy()。
- **JSON 范例（status-bar）**：res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','connection':'close'}); res.end(JSON.stringify(body))（该部署发现 keep-alive 池会挂起，短请求强制 close——我们流式接口不能用 close，按 hmr 的 keep-alive 来）。

### B4. 用户身份/昵称/时区/语言环境（persona 定位结论）

**文件**：packages/preset/persona/src/index.ts、packages/core/system-prompt/src/index.ts、packages/core/session/src/types.ts。

- **persona 包 = 提示词段，不是用户档案**：persona 插件把 {text, complete?, includeRuntimeContext?} 注册成 ctx.systemPrompt.section({name: PERSONA_SECTION, order: PERSONA_ORDER, text})——是 agent 的身份描述文本，非系统变量来源。scope-only（全局装载会冲突报错）。
- **系统变量注册 API**：ctx.systemPrompt.variable(name, (context) => string | undefined): () => void（system-prompt/src/index.ts:446）。内置变量只有 provider/model/cwd（agent-loop/src/index.ts:351-353）。**没有 user_name/locale/timezone 内置** → 需求里的系统变量**由插件自己注册**（数据来源：插件设置 + Node Intl）。
- **locale**：host 侧可读 ctx.settings.section('locale').get()（settings 服务，packages/settings/settings/src/index.ts；本机 ~/.dsh/settings.yaml 有 locale.preference: zh）。client 侧走 ctx.locale（ui-locale）。
- **timezone**：DSH 不存；host 用 Intl.DateTimeFormat().resolvedOptions().timeZone。
- **昵称**：DSH 全局无用户档案（identity 包只有 anonymous-user-id）。→ 插件自建：配置项 userName（写到插件的 own settings section）。

### B5. 工作区枚举（包：@deepseek-ai/dsh-workspace）

**文件**：packages/workspace/workspace/src/index.ts、types.ts。

- 服务：ctx.workspaceRegistry。
- **ctx.workspaceRegistry.list(): Workspace[]**（index.ts:181）；create(path, title?)、get(id)、delete(id)、resolveByPath(path)、insertBefore(id, beforeId?)。
- **Workspace 接口**（types.ts）：{ id: WorkspaceId, path: string(canonical realpath), title: string, createdAt/updatedAt: ISO, sessionIds: SessionId[], setTitle(title), ... }。
- 需求「助手绑定工作区」→ 存 workspaceId，展示用 list() 枚举（path/title）。
- 持久化实况（~/.dsh-user/storages/workspace.json）证明 DSH 的用户可写存储分两处：workspace 在 ~/.dsh-user，session 在 ~/.dsh/sessions——插件数据建议放 DSH_HOME（~/.dsh）下自有目录，见 C9。

### B6. skill 注册表（包：@deepseek-ai/dsh-skill）

**文件**：packages/skill/skill/src/index.ts（SkillRegistry 服务）＋ provider 实现 skill-filesystem / tool-skill / skill-badge。

- 服务注入：inject = ['skills']。
- **ctx.skills.list(options?): Promise<SkillSummary[]>**（index.ts:252）：options = {cwd?, signal?}；返回

    interface SkillSummary {
      name: string; description: string; whenToUse?: string
      invocation: { modelInvocable: boolean; userInvocable: boolean }
      source: SkillSource; provider: string; resourceBase?: SkillResourceBase
    }

- **ctx.skills.get(candidate, options): Promise<SkillDefinition | undefined>**（正文 content + path + metadata）。
- **ctx.skills.register(skill: SkillRegistration)**：运行时贡献技能（SKILL.md 等价物，含 content）。
- 需求「skill 列表（名称+描述）」→ ctx.skills.list() 直接满足；whenToUse 可做富描述。

### B7. 记忆/聊天记录（无官方 memory 服务 → 自建 JSONL）

**文件**：packages/core/session/src/types.ts（SessionEventMap）、packages/session/session-persistence-jsonl（格式）、status-bar：ctx.on('session/event', ...)。

- **结论：checkout 无 memory/记忆服务**（grep memory 仅注释/内部用词）。RikkaHub 的记忆（fast model 抽取事实）需要**插件自己实现**，可复用：
  - **ctx.on('session/event', (session, event: SessionEvent) => {})**（status-bar 已用）：订阅持久化事件流。SessionEvent 种类：turn/start、turn/end、step/start、step/end、**user/message**、assistant/chunk、**assistant/message**（含 usage）、tool/call、tool/result、todo/write、request/header、request/context、session/end-seed（types.ts:236）。
  - 聊天记录 = session log（JSONL，~/.dsh/sessions/，由 session-persistence-jsonl 写）。**插件自己的记忆/世界书/快捷回复 JSONL 建议放 ${DSH_HOME}/dsh-assistant-panel/**（DSH_HOME 环境变量，status-bar 用 ledgerDataDir(process.env.DSH_HOME) 先例）。
- 时间间隔提醒：插件记录每次交互时间戳（session/event user/message），下次组装时计算间隔注入提示。

### B8. 客户端 slots（包：@deepseek-ai/dsh-client-ui-slots + ui-layout/ui-sidebar/ui-conversation/ui-settings）

**文件**：packages/client/ui-slots/src/index.ts（SlotMap/register/PropsRuntime）、renderer.ts、store.ts；packages/client/ui-layout/src/client/index.ts（layout 槽）、ui-sidebar/src/client/index.ts + contract/slots.ts、ui-conversation/src/client/contract/slots.ts、ui-settings/src/client/contract/slots.ts。

- **注册 API**（index.ts:741-787 双 overload）：

    ctx.slots.register({
      name: '<slot key>',              // ★ 必填；未声明槽会抛错
      id?: string,                     // list 槽：条目 id（settings.section 用 section key）
      order?: number,                  // list 槽：排序
      label?: string | (() => string), // list 槽：显示文本（thunk 循 locale）
      priority?: number,               // 遮蔽 rank（低者渲染，同键同 priority 抛错）
      children?: {...},                // 子槽声明（声明即认领）
      store?: StoreHandle | StoreFactory,
      locale?: string,                 // 声明后组件 props 获得 t 座
      registrant?: string,             // 诊断标签
    }, Component)

- **组件 props（四份交集）**：PropsRuntime<K>（owner 份额 + session 标准件 + 全局座）& PropsRenderSlots<childKeys>（renderSlot）& PropsStore<H>（useStore/actions）& PropsLocale<N>（t）——配套 defineStore/StoreHandle（store.ts:132）。
- **layout 槽（ui-layout/src/client/index.ts:34-96 原文核实）**：

  | 槽 | kind/scope | 说明 |
  |---|---|---|
  | sidebar | single/root | 整根左列。被 ui-sidebar 占据；要加东西到侧边栏必须注册它的**内部座位** |
  | conversation | single/session-maybe | 整根中列。被 ui-conversation 占据 |
  | details | single/session | 右侧详情列 |
  | shell.overlay | list/root | **框架级浮动层**，「the additive seat for a frame-wide surface of your own: a fresh id is added beside the shipped entries」 |

- **侧边栏内座位（ui-sidebar contract/slots.ts）**：
  - sidebar.brand.mark（single/root, owner {size}）、sidebar.brand.name（single/root）
  - sidebar.workspaces（single/root, owner {wide, expandSidebar}）——被 ui-workspace 占据
  - sidebar.settings（single/root, owner {wide}）——被 ui-settings 占据
  - **sidebar.footer.action（list/root, owner {wide}）**——Settings 旁边可加动作图标；每个 action 只收列宽。
- **conversation 槽（ui-conversation/contract/slots.ts:107-118）**：conversation.view = **list/session**（会话视图环：每项一个 tab，Chat 占用；可加第二个 tab）；conversation.session.header.actions/.utilities（list/session）。
- **settings 槽（ui-settings/contract/slots.ts:47-56）**：settings.section = **list/root**，owner 只有 {close: () => void}；条目带 id（导航键）/order（导航位置）/label（显示文本）；面板内容列渲染。
- **已装插件实测**（~/.dsh/profiles/web/node_modules/@linxin666/*）：本机 profile 无 dsh-better-sidebar（任务提及路径不存在），但同族插件（skin-center/web-ui-settings/task-board/aionui-panel 等）均按 dsh.client.inject 声明 @deepseek-ai/dsh-client-* 依赖、client 走 tsdown 打 lib/client.js（ModuleLoader.load 包装）。**侧边栏注册方式以官方 ui-sidebar/contract 为准。**

### B9. client 构建惯例

- 参考 /Users/a64485/Documents/dsh/dsh-status-bar/tsdown.config.ts：entry {client: 'src/client/index.ts'}，format cjs、platform browser、banner window.__ModuleLoader__.load({ id: '<插件名>', factory: (require) => {、footer return module.exports; } });、intro var module = { exports: {} }; ...、codeSplitting false、CLIENT_EXTERNALS（react/cordis/dsh-client-*）。
- **本插件已配好双 tsconfig**（tsconfig.json→host、tsconfig.client.json→client）+ tsdown.config.ts（同款 banner）+ build.sh（link 依赖 + host 编译 + client typecheck）。**无需改动构建骨架**；需要补的是：src/client/ 真实现（现有 stub 用了过时 API：slots.inject(...register({component: () => ({render})}))——现行 API 是 React 组件 + register 双参）、按需补充 dsh.client.inject 的依赖名（ui-settings 等，peerDeps 已列 dsh-client-ui-slots）。

---

## C. 架构建议（9 条）

1. **模型枚举：host 侧权威 API 优先**。插件 host 逻辑一律 ctx.llm.listProviders() + listModels(p.id) + resolveModelInfo(p, m)（reasoning efforts 顺带拿到），订阅 llm/adapters-updated 刷新；**不要**解析 ~/.dsh/settings.yaml 当主源（那是兜底/冷启动快照——ctx.settings.section('llm-deepseek'/'llm-pi-ai') 可从设置服务读，仅作 UI 加速或无 adapter 时的展示）。
2. **topP：UI 保留字段，底层暂不生效（标注清楚）**。GenerateOptions/LlmCallConfig 现无 topP；实现为「设置项存在 + stream 时忽略 + 文档说明」，等官方加字段再接线（避免 fake 参数）。temperature/maxTokens/reasoningEffort/stop 直接透传。
3. **侧边栏入口：sidebar.footer.action 图标行（推荐）+ 助手面板放 shell.overlay 或 details**。列表槽可多插件共存、owner 只给 {wide}，风险最低；点击后打开浮层面板（shell.overlay list/root，新增自己的 id）。若做「对话内助手 tab」再注册 conversation.view（list/session）作为第二视图——注意它占 tab 环，需提供会话快照读取。
4. **配置面板：settings.section（list/root, id+order+label）** 注册一个「侧边栏助手」设置页；助手档案 CRUD、模型参数、系统提示词、快捷回复、世界书/skill 开关、记忆开关都收在这里；数据经 host RPC/API（插件自建 ctx.webServer.register JSON 路由，如 /assistant-panel/api，参考 status-bar）落到 DSH_HOME。
5. **系统变量：自注册 + 通用替换器**。用 ctx.systemPrompt.variable 注册 user_name/nickname/locale/timezone/cur_date 等（数据：插件设置 + Intl + locale.preference）；模型侧系统提示词、世界书、快捷回复统一走一个 {{var}} 替换函数（对齐 RikkaHub 双语法）。
6. **世界书/注入：自己实现，但语义照搬 RikkaHub**。host 组装层：每条助手配置 = system 段 + 注入列表（position 5 档 / priority / role / trigger 关键词 / scan depth / regex / constant-active / token 预算）；在 ctx.llm.stream 前把注入按 position 插入 messages（createUserMessage/createAssistantMessage 构造），遵守「不插在 user 与其紧跟 tool-call assistant 之间」。世界书实体存 JSONL（~/.dsh/dsh-assistant-panel/worldbooks/…）。
7. **记忆：自建小引擎**。ctx.on('session/event') 收 user/message + assistant/message → 低配模型（reasoningEffort off、短 maxTokens、temperature 0）抽取事实 → JSONL entries；下次组装前按关键词/最近命中注入；global/private 池、recent-chats 摘要、time-reminder 皆可在同架构内加字段。开关与条目管理走 settings UI + 插件 API。
8. **SSE 与 API 边界**：聊天请求走 host 侧 ctx.llm.stream + 插件 API 路由转发（SSE 用 hmr 的 keep-alive 写法，JSON 用 status-bar 的 no-store 写法）；client **不直接** import @deepseek-ai/dsh-llm（browser bundle 不链 host），统一经插件 webServer 路由（fetch + EventSource）。身份：昵称在插件设置（DSH 无全局用户档案），不存在就 fallback process.env.USER/OS 用户名。
9. **数据布局**（供架构师定稿）：${DSH_HOME || '~/.dsh'}/dsh-assistant-panel/ 下 assistants.json（档案+模型参数+提示词）、quick-replies.json、worldbooks/*.json、memory/*.jsonl、settings.json（userName 等）；遵循 status-bar 的 ledgerDataDir(process.env.DSH_HOME) 先例。

---

## 附录：关键引用文件索引

- RikkaHub 官方文档：https://docs.rikka-ai.com/assistants/overview.md · prompt-injection.md · memory.md · extensions/skills.md · extensions/workspace.md（llms.txt 全表）
- DSH checkout：/Users/a64485/deepseek-harness/packages/{llm/llm,llm/llm-deepseek,host/webserver,host/apiproxy,api/remotes,core/system-prompt,core/session,preset/persona,preset/agent-presets,skill/skill,workspace/workspace,settings/settings,client/ui-slots,client/ui-layout,client/ui-sidebar,client/ui-conversation,client/ui-settings,client/hmr,client/ui-model-selection}
- 本机运行数据：~/.dsh/settings.yaml（providers/models）、~/.dsh/profiles/web、~/.dsh-user/profiles/web/cordis.yml、~/.dsh/sessions
- 参照插件：/Users/a64485/Documents/dsh/dsh-status-bar（JSON API + session/event + JSONL 先例）；已装 @linxin666/*（client inject 惯例）

