# DESIGN-ACTIVATION.md — 激活机制 API 面核实（llm/stream 注入 · 会话级选择 · UI 槽位）

> 研究员产出（research，任务 t1）。目标：为**纠偏改造**（产品形态改为『侧边栏"助手"选项 → 管理/选择助手 → 选中后在 DSH **主会话**内以助手人设/模型/参数对话，不选保持原生』；时间感知改为开关注入时间变量 + 自然上下文行，删除刻意 [时间提醒] 消息）做**最后 API 核实**。
> 方法：对 /Users/a64485/deepseek-harness（DSH checkout，只读）逐文件读源码取证；对照已装插件（~/.dsh/profiles/web/node_modules/@dsh-external、@linxin666）的 client 实现先例；审计本插件现有 src/*（退役点）。
> 日期：2026-08-25。本文件补充并覆盖旧 docs/DESIGN.md §B/C 未及的部分；架构/实现以本文件为准。

---

## 0. 结论速览

| # | 核实项 | 结论 |
|---|---|---|
| 1 | agent-loop 主会话 system/purpose | 主会话 system **恒有值**（renderPrompt(assembly)），purpose **恒 undefined**；subagent 走独立 sessionId（childId=randomUUID），compaction/session-title 同 sessionId 但 purpose='compaction'/'session-title' → **sessionId 精确匹配 + purpose===undefined（或 isAgentLoopRequest）过滤可精确排除子代理与压缩/标题调用** |
| 2 | llm/stream waterfall 顺序 | `ctx.waterfall(this,'llm/stream',options,terminal)`——listener 收 `(options, next)`，**args 永不替换**；改 options 必须**短路返回自己的 AsyncIterable**（llm-replay 先例）；agent-default-model **不是** waterfall 监听者（它是 Agent 出生时的 Service）；我们的监听器用 `{global:true}`（append，不 prepend）注册即可 |
| 3 | UserMessage 形状 | session/event 第一参 **是 session**（`(session, event)`）；`user/message` 的 `data` 就是 `UserMessage`（无 ts）；**时间戳在 `SessionEvent.time`**（"Unix epoch milliseconds"）→ lastChatTs 用 `event.time`，并过滤 `source.kind==='user'` 排除注入上下文 |
| 4 | Message 类型 | **Message 无 ts**（只有 id/role/content/source）；间隔只能靠自建 lastChatTs 追踪——设计成立 |
| 5 | 客户端 root 槽位 props | **root 槽（sidebar.footer.action / shell.overlay / settings.section）都收 GlobalStandardProps**（useSessions/useWorkspaces），renderer 实打实注入（scoped-slots.tsx:349-357）；`useSessions(s => s.current)` 拿当前会话；组件 props 用手写交集类型即可 |
| 6 | shell.overlay 渲染 | AppFrame 的 `.overlayLayer`（absolute、inset:0、z-index:20、**click-through**、子元素 pointer-events:auto）渲染；**无内置关闭按钮/遮罩**；owner props 为空 `{}`；sidebar.footer.action owner 只有 `{wide}`（list 槽多条目 flex 横排；rail 下居中图标） |
| 7 | settings.section owner | `{ close: () => void }`——已实现可用，无需变更 |
| 8 | session/event 注册 | 事件名常量字符串 `'session/event'`，status-bar 先例 `ctx.on('session/event', (_session, event) => …)`（index.ts:76 声明） |
| 9 | 现有代码退役点 | prompt.ts 时间提醒函数/chat.ts 全套（/chat 路由）/api.ts chat+chats 路由/store.ts ChatStore/chats 存储/contracts.ts chat 契约 → 退役清单见 §9 |

---

## 1. agent-loop 主会话调用（system 组装 → GenerateOptions → llm/stream）

**文件**：packages/core/agent-loop/src/agent.ts（515 行）

### 1.1 system prompt 组装（L230）

```ts
// agent.ts:229-233
const claimed = this.inbox.claim(target, position.turn)
const assembly = await this.loopCtx.systemPrompt.assemble(assembleContextFor(this, signal))
const sections = renderContextSections(assembly)
const context = this.runtimeContext.project(joinContextSections(sections), sections)
```

- `systemPrompt.assemble()` 是 agent 级提示词装配（含官方各 system 段）。
- 在 step()（L337）中渲染成字符串：`const system = renderPrompt(assembly)`，**system 对主会话恒有值**（除非装配结果真为空串，此时 buildRequest 的 `...system ? {system} : {}` 省略字段）。

### 1.2 GenerateOptions 构造（L505-513，buildRequest 尾部）

```ts
const request = markAgentLoopRequest(deepFreeze({
  ...header.config,                    // provider/model/reasoningEffort/temperature/maxTokens/stop
  messages: boundaryMessages,          // = session.deriveMessages()
  ...header.system !== undefined ? { system: header.system } : {},
  ...header.tools   !== undefined ? { tools:   header.tools   } : {},
  sessionId: this.session.id,          // ★ 主会话 id
  signal,
}))
```

- 入口字段：provider/model/messages/**system**/tools/temperature/maxTokens/reasoningEffort/stop/**sessionId**。
- **主会话请求恒带 sessionId（主会话 id）**；**无 purpose**（agent-loop 不设 purpose）。
- 请求对象被 **deepFreeze**（call-config.ts:66 deepFreeze 全量冻结；AbortSignal 除外）+ 标记进 WeakSet（isAgentLoopRequest）。
- 调用点：step() L346 `this.loopCtx.llm.stream(request)`（或 preparedCall.stream）。

### 1.3 purpose 何时有值（compaction / session-title）

| 调用方 | 文件:行 | purpose | sessionId |
|---|---|---|---|
| 压缩 | packages/compaction/compaction-basic/src/summarizer.ts:161 | 'compaction' | **主会话同 id** |
| 会话标题 | packages/session/session-title-llm/src/index.ts:259 | 'session-title' | **主会话同 id** |
| 主 agent-loop | agent.ts:505 | **undefined** | 主会话 id |
| subagent 驱动 | packages/subagent/subagent-in-process-driver/src/index.ts:132-133 | **undefined** | **childId = SessionId(randomUUID())（全新独立 id）** |

- GenerateOptions.purpose 类型：`purpose?: 'compaction' | 'session-title'`（packages/llm/llm/src/types.ts:376）。
- subagent 也是完整 Agent 实例（parent.ctx.agents.create({sessionId: childId, ...})），其 llm 请求照样带 system/purpose=undefined/sessionId=childId —— **与主会话 sessionId 不同**。

### 1.4 结论（注入过滤条件）

> **按 sessionId 精确匹配 + purpose undefined 过滤，能精确排除：**
> - subagent（不同 sessionId）✓
> - compaction（purpose='compaction'）✓
> - session-title（purpose='session-title'）✓
>
> 更稳的补充条件：**isAgentLoopRequest(options)**（WeakSet 身份，唯一标记 agent-loop 构造的请求）——compaction/session-title 自建 options 未标记，subagent 的请求虽标记但其 sessionId 不匹配。推荐 **双重过滤**：`options.sessionId === 选中会话Id && options.purpose === undefined`（可选再加 isAgentLoopRequest 防御）。

---

## 2. llm/stream waterfall 顺序与监听器形态

### 2.1 机制（权威）

注释：packages/llm/llm/src/index.ts:65 事件类型 + packages/llm/llm/src/index.ts:993-999 实现 + vendor/cordis/src/events.ts:243-263（waterfall 实现）。

```ts
// llm/src/index.ts:993-999
private streamWithRegistration(options, prepared?) {
  return this.ctx.waterfall(
    this, 'llm/stream', options,
    () => this.adapterStream(options, prepared),   // 终端叶子，闭包捕获**原 options**
  )
}
```

```js
// cordis events.ts waterfall()
waterfall(...args) {
  const cbs = this.dispatch('waterfall', args)
  const inner = args.pop()
  const next = () => { const cb = cbs.shift() ?? inner; return cb(...args) }  // args 不动！
  args.push(next)
  return next()
}
```

**语义**：每个 listener 收 `(options, next)`；`next()` 用**同一份原始 args** 调下一个 listener（listener 的返回值给**上一个** listener/调用方，**不会**替换下一个 listener 的 args）。所以：

- **观察/包装**：`(options, next) => { 观测(options); return next() }`（session-title:332、checkpoint-policy:64）。
- **替换请求**：`(options, _next) => 我自己的AsyncIterable` —— **短路**，跳过终端 adapterStream 及之后所有 listener（llm-replay:784 `ctx.on('llm/stream', (options, _next) => replay(options))`）。
- **绝不原地改 options**：主会话请求 deepFreeze，原地改会 **throw**；要改必须构造新 options 对象并短路自己 dispatch。

### 2.2 agent-default-model 的定位（它不是 llm/stream 监听者）

- packages/core/agent-default-model/src/index.ts：是 Service（AgentDefaultModelConfig），提供 `currentSelection()`/`saveSelection()`，只在 Agent **创建/装配**时喂 `agent/request` 种子（经 installModelSelection，packages/core/agent/src/model-selection.ts:37）与 system-prompt 变量——**不在 llm/stream 上注册**。
- 结论：**不存在 agent-default-model 覆盖我们 llm/stream mutation 的先后问题**（两条路径不同层）。真正同层且先于我们的 listener 只有：
  - agent-loop invariant（agent-loop/src/invariant.ts:21，`{global:true, prepend:true}`，校验原始请求与 request/header 一致）
  - session-title（session-title/src/index.ts:332，`{global:true, prepend:true}`，只观测）
  - checkpoint-policy（session-checkpoint-policy/src/index.ts:64，append，只包装 flush）

### 2.3 我们监听器的推荐形态

```ts
// 推荐：append（不 prepend），global:true —— 在 invariant/title/checkpoint 之后、terminal 之前运行
ctx.on('llm/stream', (options: GenerateOptions, next) => {
  const ass = selectionBySession.get(options.sessionId)
  if (ass === undefined || options.purpose !== undefined) return next()          // 未选中/压缩标题 → 原生
  if (reentrant.has(options.sessionId)) return next()                             // 重入防护：我们自己的再派发直接放行
  const rebuilt = rebuildRequest(options, ass)                                    // 新 system + 注入 + 模型参数 + 截断消息
  reentrant.add(options.sessionId)
  try {
    return ctx.llm.stream(rebuilt)                                                // 重入 → 我们的 listener 走 next() → terminal(modified)
  } finally {
    reentrant.delete(options.sessionId)
  }
}, { global: true })
```

要点：
1. **必须短路再派发**：想让 adapter 收到新 system/messages/model，只能构造新 options 并返回自己的流。`ctx.llm.stream(rebuilt)` 重入 waterfall；重入时靠 `reentrant` Set 放行（否则无限递归）。
2. rebuilt 对象**不标记** isAgentLoopRequest（WeakSet 只含原始对象）→ invariant 对重入请求直接 return next()，无校验冲突；但**保持 deepFreeze** 以防未来校验。
3. 改动 **system/messages/model/params** 都在这一个点完成；模型参数也可另走 `agent/request`（全局 listener，见 §2.4），但**system/messages 只能走 llm/stream**。
4. 原请求的 adapter 仍以原始 provider/model 选择；rebuild 时要显式携带 `options.temperature/maxTokens/reasoningEffort/stop` 再覆盖。

### 2.4 agent/request 全局监听（补充通道）

- 事件：`'agent/request'(this: Scoped<Agent>, payload: {agent, turn, step, signal}, next: () => Promise<LlmCallConfig>): Promise<LlmCallConfig>`（packages/core/agent/src/runtime-types.ts:242-258，@mode waterfall）。
- 用 `{global:true}` 可收**所有** agent 的请求（dispatch 过滤：`hook.global || !filter || …`，events.ts:196-202）；`await next()` 拿默认 config，返回替换对象可改 provider/model/reasoningEffort/temperature/maxTokens。
- **限制**：注释明确 "Model-visible content must use logged channels; this waterfall cannot mutate messages"——改 system/messages 必须 llm/stream。（若只切模型参数，可两条都实现；对当前设计**单点走 llm/stream 即可**，agent/request 列为可选增强。）

---

## 3. UserMessage 形状与 session/event

### 3.1 事件声明

```ts
// packages/core/session/src/index.ts:76
'session/event'(this: Scoped<Session>, session: Session, event: SessionEvent): void   // @mode emit
```

- **第一参是 Session**（有 id/header：types.ts:60-86 SessionHeader {version,id,createdAt,cwd?,parentSession?,seedLength?,origin?:'subagent',delegationDepth?,agentPreset?}）。
- fire-and-forget（emit），post-commit 回调；scope-filtered（agent-scoped listener 只收自己的，全局 listener 收全部）。
- 事件名是字符串字面量 `'session/event'`。

### 3.2 user/message 事件 payload

```ts
// packages/core/session/src/types.ts:236-264 (SessionEventMap)
'user/message': UserMessage
// SessionEvent 信封 (types.ts:408-430)
{ type, seq, time /* Unix epoch milliseconds */, data, surfaceOp?, sourceEventSeqs? }
```

- `data` = UserMessage（message.ts:141：`{ id, role:'user', content, source }`）。
- **没有 ts 字段**；消息时间 = `event.time`（毫秒）。
- `source` 区分来源：`{kind:'user'}`（直接人类输入）/ `{kind:'plugin', plugin}`（agent.inject 注入的上下文：文件变更、AGENTS、skill、cron 等）。见 types.ts:257-263 注释。

### 3.3 维护 lastChatTs 的正确事件与字段

> **事件 = `user/message` 会话事件；字段 = `event.time`；过滤 = `event.data.source?.kind === 'user'`（排除 agent.inject/工具上下文）。**
> 依据：SessionEvent.time 是毫秒时间戳（types.ts:419-420），Message 无 ts（§4）；合成 user/message 携带非 'user' source（types.ts:257-263）。

---

## 4. Message 类型（无 ts）—— 时间间隔设计成立

```ts
// packages/llm/llm/src/message.ts:136-142
export interface Message {
  readonly id: MessageId
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: ContentBlock[]
  readonly source: MessageSource
}
```

- **messages 数组元素不带 ts**（id/role/content/source 四件套）。UserMessage/AssistantMessage/ToolResultMessage 都只是 role/source 特化，无时间戳。
- 因此组装请求时**无法从历史消息本体拿时间**；时间间隔只能来自插件自维护的 lastChatTs 追踪（session/event user/message 的 time，见 §3.3）——**设计成立**。
- 上次对话时间也可从 `session.events`（SessionEvent.time）现算（status-bar 的 ledger 也是从 session/event 折叠），不必额外存文件；本插件的选择状态存 selection.json（会话级），时间追踪存内存 Map<sessionId, lastTs> 即可（可在 session/disposed 清理）。

---

## 5. 客户端根槽位 props（GlobalStandardProps / useSessions / s.current）

### 5.1 类型声明链

- 空座位：packages/client/ui-slots/src/index.ts:198 `export interface GlobalStandardProps {}`；
- 实成员（runtime 合并）：packages/client/runtime/src/client/index.ts:146-150
```ts
interface GlobalStandardProps {
  useSessions: SnapshotSelectorHook<SessionListState>
  useWorkspaces: SnapshotSelectorHook<import('./workspaces/service.ts').WorkspaceListState>
}
```
- renderer 实绑（**root 槽真的有**）：packages/client/ui-renderer/src/client/scoped-slots.tsx:349-357
```ts
cache.root = {
  useSessions: observableHook(host.sessions.list),
  useWorkspaces: observableHook(host.workspaces.list),
}
// standardProps(host, 'root', undefined) 返回 cache.root；root 槽全部用它
```
- PropsRuntime 泛型（ui-slots/src/index.ts:211-221）：root 槽 = `OwnerOf<K> & … & (object) & GlobalStandardProps` —— type 层与运行层一致。

### 5.2 SessionListState.current

```ts
// packages/client/runtime/src/client/sessions/service.ts:80-97
export interface SessionListState {
  ids: SessionId[]
  byId: Record<SessionId, SessionSummary>
  current: SessionId | undefined   // ★ 当前会话（持久化选择 + 舞台投影）
  phase: 'pending' | 'ready'
  …
}
```

- 组件里 `useSessions(s => s.current)` 拿当前会话 id；`useSessions(s => s.byId[id]?.title)` 拿标题等。
- SnapshotSelectorHook 签名：store.ts:8 `<S>(sel: (s: T) => S, eq?) => S`。

### 5.3 组件 props 写法（免引入完整泛型栈）

参考 status-bar 手写类型 / remote-web-ui 的 FooterRemoteEntry（已装 @linxin666/dsh-remote-web-ui/src/client/FooterRemoteEntry.tsx）：

```tsx
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'

type UseSessions = <S>(sel: (s: SessionListState) => S, eq?: (a: S, b: S) => boolean) => S

// sidebar.footer.action：owner {wide} + global 标准件（useSessions）+ locale（可选）
export type SidebarEntryProps = PropsLocale<'assistant-panel'> & { wide: boolean; useSessions: UseSessions }
// shell.overlay：owner {} + global 标准件
export type OverlayProps = { useSessions: UseSessions }
// settings.section：owner {close} + global 标准件
export type SettingsSectionProps = { close: () => void; useSessions: UseSessions }
```

> 提示：实际运行时 root 槽收到的是**标准 props 对象** {useSessions, useWorkspaces}（非函数式 hook 注入），类型用手写交集即可；注册第二参直接传 React 组件（§5.4）。

### 5.4 React 组件如何被渲染（register 第二参）

- `ctx.slots.register({ name, id?, order?, label?, priority?, children?, store?, locale?, registrant? }, Component)`（ui-slots/src/index.ts:787 双 overload；list 槽 id=条目 id、order=排序、label=显示文本）。
- 现有插件先例（remote-web-ui index.ts:168）：`ctx.slots.register({ name: 'sidebar.footer.action', id: 'remote-web-ui', locale: NS }, FooterRemoteEntry)`。
- **第二参是 React 组件**（(props) => ReactNode），直接渲染；props 组装框架完成（见 scoped-slots.tsx standardKit）。

---

## 6. shell.overlay / sidebar.footer.action 渲染行为

### 6.1 shell.overlay（AppFrame.tsx:192-195 + AppFrame.module.css:110-118）

```tsx
// AppFrame.tsx:192-195
<div className={css.overlayLayer} data-shell-overlay>
  {renderSlot('shell.overlay', {})}
</div>
```

```css
.overlayLayer { position: absolute; inset: 0; z-index: 20; pointer-events: none; }
.overlayLayer > * { pointer-events: auto; }
```

- 位置：**绝对定位浮层**铺满 frame（inset:0），z-index:20（拖拽条 z-index:2，杠上），高于三列。
- **无内置关闭按钮/遮罩**——注册条目自管可见性（关闭时 render null）与遮罩（自绘 backdrop，可复用现有 AssistantOverlay/dap-overlay 模式）。
- owner props = **空 {}**（ui-layout/src/client/index.ts:83 'shell.overlay': {kind:'list', scope:'root'}）；list 槽多条目**按 order 依序**渲染在同一层（都叠在 overlayLayer 里，各自自管可见性）。
- 现有助手浮层（AssistantOverlay.tsx）已示范：Esc 关闭 + 遮罩点击关闭 + role=dialog/aria-modal——改造后保留（管理面板），去掉聊天窗。

### 6.2 sidebar.footer.action（SidebarRoot.tsx:201-205 + SidebarRoot.module.css:308-329）

```tsx
<div className={css.footArea}>
  <div className={css.footerActions}>{renderSlot('sidebar.footer.action', { wide })}</div>
  <div className={css.settingsArea}>{renderSlot('sidebar.settings', { wide })}</div>
</div>
```

- owner = `{ wide: boolean }`（ui-sidebar/src/client/contract/slots.ts:85-90）：wide=true 展开列；false = 56px rail。
- `.footerActions { display: flex }`：**多条目横向一行**（flex 行内依序）；rail（.collapsed）下居中、width:auto。
- **条目自己渲染按钮 + 文字 label 可行**（现有 SidebarEntry 即按钮 + 图标；wide 时加文字 label，rail 时只图标，参考 settings trigger 惯例）。已装插件 remote-web-ui 的 FooterRemoteEntry 只渲染触发按钮 + 面板，同为 footer.action 先例。

---

## 7. settings.section owner props（无需变更）

```ts
// packages/client/ui-settings/src/client/contract/slots.ts:79-86
export interface SettingsSectionOwnerProps {
  close: () => void      // 关闭设置面板（shell 拥有 open 状态）
}
```

- 槽声明：'settings.section': { kind:'list'; scope:'root' }；条目 id=导航键、order=位置、label=显示文本。
- 数据经自己的 inject face / host.call / store 到达，shell 只给 close。**现有 SettingsSection.tsx 已按此实现，无需变更**；只补 useSessions 做「当前会话选中助手」展示（可选）。

---

## 8. session/event 注册位置与 status-bar 先例

- 事件名常量就是字符串 `'session/event'`（无独立常量导出；session/src/index.ts:76 声明，插件直接写字符串，status-bar 同样做法）。
- status-bar 先例：/Users/a64485/Documents/dsh/dsh-status-bar/src/index.ts:76
```ts
ctx.on('session/event', (_session, event: SessionEvent) => { ledger.record(event) })
```
- 我们用于：lastChatTs 追踪（§3.3）+ 可选 session/disposed 清理选择状态（session/src/index.ts:64 'session/disposed'）。

---

## 9. 现有插件代码审计（退役 / 改造点清单）

> 依据旧 ARCHITECTURE.md（独立 chat 端点的旁路聊天设计）与新形态的差异。目录 /Users/a64485/Documents/dsh/dsh-assistant-panel。

| 文件:行 | 现状 | 处置建议 |
|---|---|---|
| src/chat.ts 全文（248 行） | 独立聊天 SSE：prepareChat/handleChat/buildStreamOptions/runStream + ChatSsePayload | **整文件退役**（不再有 /chat 端点；流由 DSH 主会话 llm/stream 天然承载）；buildPayload 的**入口签名可复用**为 rebuildRequest 的宿主 |
| src/api.ts:139-155（POST /chat） | 聊天路由，调 handleChat | **删除**；保留 assistants/memory/skills/models/workspaces/profile 路由（selection 用） |
| src/api.ts:159-161、272-305（/chats） | 会话列表/消息/删除（ChatStore） | **删除**（DSH session 自己持久化）；如需「助手维度历史」可改用 session-query（可选） |
| src/store.ts:283-414（ChatStore） | chats/*.jsonl 会话存储（createChat/appendMessage/get/list/delete/lastUserMessageTs/rotate） | **整类退役**；数据文件删除逻辑（chats/ 目录）由 host 工程师在 apply 时清理或忽略 |
| src/shared/contracts.ts:75-78、138-191 | ChatRequest/ChatEvent/ChatSummary/ChatSession/ChatMessage/ListChats… | **删除这批类型与路由表行**；新增 selection 契约（PUT /selection {sessionId, assistantId?}、GET /selection?sessionId=、DELETE） |
| src/prompt.ts:339-369（⑦ 时间间隔提醒） | 生成 [时间提醒] 独立 system 消息 + gapReminderInserted 标志 | **删除刻意提醒消息**；改为**时间感知开关**：注入变量（当前时间 cur_time/cur_datetime + 距上次对话间隔 + 自然上下文行，如「上次对话在 X，已过 Y」），无 [时间提醒] 前缀、不强制「请结合当前时间作答」 |
| src/prompt.ts buildPayload 整体 | 组装 system + messages（模板/变量/注入/世界书/skill/记忆/截断） | **保留并重构为 rebuildRequest(request, assistant, runtime)**：输入从「chat 历史数组」改为「**主会话 llm/stream 的 request.messages**」；截断/注入/世界书/记忆逻辑基本照搬（同 pair 约束） |
| src/chat.ts:118-133 runStream / sseData | 流聚合 + SSE 转发 | 退役（主会话流由 DSH UI 呈现）；产品形态改为主会话对话 |
| src/client/ChatView.tsx（293 行） | 独立聊天窗 UI + SSE fetch | **退役**；主会话聊天 UI 是 DSH 原生的 |
| src/client/AssistantPanel.tsx / AssistantOverlay.tsx | 面板（列表+聊天+设置）+ 浮层 | **改造**：面板改为「助手管理」（列表/选择/取消/编辑）；浮层保留但不再嵌聊天窗 |
| src/client/SidebarEntry.tsx | footer action 按钮（仅图标） | **改造**：加 label（wide 下）+ 显示「当前会话已选助手」状态（useSessions(s=>s.current) + 我们的 selection 状态） |
| src/client/index.ts（73 行） | 手写 SlotsService 类型（inject/register） | **改用官方类型**：peerDeps 已有 @deepseek-ai/dsh-client-ui-slots + dsh.client.inject 已有 client-runtime；register 第二参直接 React 组件（已符合当前 API，只需把本地 SlotsService 换成官方 PropsRuntime 类型） |
| docs/ARCHITECTURE.md / DESIGN.md | 旧架构（独立 chat） | 由架构师更新；本文件作为激活机制权威补充 |

---

## 10. 对 host / client 工程师的实现注意（5 条）

1. **host 监听器单点短路线（llm/stream）**：`{ global: true }` append 注册；过滤 `selectionBySession.has(options.sessionId) && options.purpose === undefined`；重入防护 Set；rebuilt 保持 deepFreeze；短路返回 `ctx.llm.stream(rebuilt)`（不要直接调 adapter——prepareCall.stream 也走 waterfall，会重入）。
2. **注入内容只在请求面，不改会话日志**：request/header（模型/system）与 messages 仍是循环记录的原始值；注入仅存在于我们替换的请求。对用户完全透明；若产品需要「请求检查」看到注入，后续可另走 request-inspection 投影（本次不做）。
3. **时间感知 = 开关 + 变量，不是提醒消息**：替换 ⑦ 时间提醒为「开关 on 时在 system 尾或最近 user 前加一行自然上下文（当前时间 + 距上次间隔）；变量 {{cur_date}}/{{cur_time}}/{{cur_datetime}}/{{gap}} 照旧」。**不要**再生成带 [时间提醒] 前缀、命令式语气的独立 system 消息。
4. **client 三槽位**：footer.action（{wide, useSessions}，按钮+label+选中态）→ 点击开 overlay 管理面板；overlay（{useSessions}，自绘遮罩/Esc/关闭，选择/取消/编辑助手，list 与 CRUD 走 host API）；settings.section（{close, useSessions}，完整档案设置）。注册第二参直接 React 组件；props 手写交集类型（§5.3）。
5. **选择状态**：host 侧 `<dataDir>/selection.json`（Map<sessionId, assistantId> 原子写）+ GET/PUT/DELETE API；client 经 API 读取展示「当前会话已选助手」；会话级隔离天然成立（sessionId 是 key）；session/disposed 时可清理（可选）。**未选中任何助手 = 完全原生路径**（监听器直通 next()，零开销）。

---

## 附录：关键源码索引

- packages/core/agent-loop/src/agent.ts:230,337,340-342,346,477-513（system 组装 + GenerateOptions + stream）
- packages/core/agent/src/model-selection.ts / runtime-types.ts:242-258 / dispatch.ts（agent/request 瀑布）
- packages/llm/llm/src/index.ts:65,985-999（llm/stream 事件与 waterfall 派发）；message.ts:136-142（Message 无 ts）；types.ts:330-377（GenerateOptions/purpose）
- packages/llm/llm/src/call-config.ts:66-92（deepFreeze / markAgentLoopRequest / isAgentLoopRequest）
- packages/llm/llm/src/invariant.ts:88（invariant listener 先例）；packages/core/agent-loop/src/invariant.ts:21（冻结+header 校验）
- packages/test-support/llm-replay/src/index.ts:784（短路替换先例）
- packages/session/session-title-llm/src/index.ts:259（purpose='session-title'）；packages/compaction/compaction-basic/src/summarizer.ts:161（purpose='compaction'）
- packages/subagent/subagent-in-process-driver/src/index.ts:120-133（childId=randomUUID）
- packages/core/session/src/index.ts:64,76（session/disposed、session/event）；types.ts:236-264,408-430（SessionEventMap、UserMessage data、time）
- packages/client/runtime/src/client/index.ts:146-150（GlobalStandardProps）；sessions/service.ts:80-97（SessionListState.current）
- packages/client/ui-slots/src/index.ts:198,211-221,787（GlobalStandardProps 座位、PropsRuntime、register）
- packages/client/ui-renderer/src/client/scoped-slots.tsx:349-357（root 槽标准件实绑）
- packages/client/ui-sidebar/src/client/contract/slots.ts:85-90（footer owner {wide}）；SidebarRoot.tsx:201-205；SidebarRoot.module.css:308-329
- packages/client/ui-layout/src/client/AppFrame.tsx:192-195；AppFrame.module.css:110-118；index.ts:83（shell.overlay）
- packages/client/ui-settings/src/client/contract/slots.ts:79-86（settings.section owner {close}）
- 已装插件先例：@linxin666/dsh-remote-web-ui/src/client/{index.ts:168,FooterRemoteEntry.tsx}（footer.action 注册 + 组件 props）、@linxin666/dsh-client-ui-task-board（settings.section 卡）、本插件现有 src/client/{AssistantOverlay,SidebarEntry}.tsx（overlay 自管模式）
