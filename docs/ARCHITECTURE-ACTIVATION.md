# ARCHITECTURE-ACTIVATION.md — 激活架构（会话级助手激活 · 时间感知 · selection 契约）

> 架构师产出（architecture，任务 t2）。依据：docs/DESIGN-ACTIVATION.md（研究员 API 核实）+ DSH checkout 源码取证。
> 本文件是 **docs/ARCHITECTURE.md 的纠偏增补**：取代旧 §4 提示词组装管线（chat 代理）、§5 时间提醒、§7 的 chat/chats API 行。
> 代码级契约：`src/shared/types.ts`（含 SessionSelection / MemoryConfig.timeAwareness）、`src/shared/contracts.ts`（selection API + 退役标注）、`src/shared/schema.ts`（timeAwareness + SelectionInputSchema）。
> 目标：产品形态 = 「侧边栏『助手』选项 → 管理/选择助手 → 选中后在 DSH **主会话**内以助手人设/模型/参数对话，不选保持原生」。

---

## 目录

1. [总览：形态变化](#1-总览形态变化)
2. [激活管线（llm/stream waterfall）](#2-激活管线llmstream-waterfall)
3. [时间感知开关（替代时间提醒）](#3-时间感知开关替代时间提醒)
4. [选择状态（selection.json + API）](#4-选择状态selectionjson--api)
5. [持久化布局更新](#5-持久化布局更新)
6. [契约变更清单](#6-契约变更清单)
7. [已知限制](#7-已知限制)
8. [关键决策与取舍](#8-关键决策与取舍)

---

## 1. 总览：形态变化

| 维度 | 旧形态（已退役） | 新形态（本文件） |
|---|---|---|
| 对话位置 | 插件独立聊天窗（client ChatView） | **DSH 主会话**（用户在主会话正常对话） |
| 聊天通道 | POST /api/chat SSE + 插件自建 chats/*.jsonl | **无**——主会话 llm/stream 天然承载；注入只作用于请求面 |
| 人设注入 | /chat 内组装 payload 后调 ctx.llm.stream | **llm/stream waterfall** 短路重建请求（system/消息/模型参数） |
| 激活机制 | 面板内点开聊天窗即"用该助手" | **会话级选择**（selection.json：sessionId → assistantId），选中即注入，取消即原生 |
| 时间感知 | 时间间隔提醒 [时间提醒] 独立消息（gapReminderMinutes） | **开关 + 变量**（timeAwareness）：system 追加一行自然时间上下文，无提醒消息 |
| 历史/存储 | chats/ 会话日志自管 | DSH SessionStore（~/.dsh/sessions）承载；插件只存 selection.json |

**职责边界**（进程划分沿用 ARCHITECTURE.md §1，host/client/shared 三方不变）：

| 侧 | 新职责 |
|---|---|
| host | selection 存储与 API；session/event 订阅维护 lastChatTs；**llm/stream waterfall 激活注入**（rebuildRequest）；记忆/世界书/skill/变量解析（沿用 prompt 引擎改输入源）；**退役** /chat、/chats、ChatStore |
| client | sidebar.footer.action **文字选项**（按钮 + label + 当前会话选中态）；shell.overlay **管理面板**（选择/取消/新建/编辑/删除）；settings.section 设置页（沿用）；**移除** ChatView 聊天窗与 SSE 消费 |
| shared | types.ts（SessionSelection/timeAwareness/新变量 + chat 类型 @deprecated）；contracts.ts（selection API + 退役标注）；schema.ts（timeAwareness + SelectionInputSchema） |

---

## 2. 激活管线（llm/stream waterfall）

> 权威依据：DESIGN-ACTIVATION.md §1–§2（agent-loop 构造、waterfall 顺序与短路形态）；本节约定**单点短路重建**。

### 2.1 全流程

```
主会话用户发送消息
  → agent-loop buildRequest（agent.ts:505）：deepFreeze(GenerateOptions{ provider, model, messages, system,
      tools, temperature, maxTokens, reasoningEffort, sessionId: 主会话id /* purpose 恒 undefined */, signal })
  → ctx.llm.stream(options) 进入 llm/stream waterfall
     ① 过滤：options.sessionId 在 selectionBySession 中 且 options.purpose === undefined
        （subagent=不同 sessionId；compaction='compaction'；session-title='session-title' → 全部排除）
     ② 重入防护：reentrant Set——本插件再派发（ctx.llm.stream(rebuilt)）直接放行，防无限递归
     ③ rebuildRequest(options, assistant, selection) 构造新请求：
        a. 模型参数覆盖（§2.2）
        b. system 重建（§2.3）：模板+变量 → system 注入块 → skill → 记忆 → 世界书 system 段 → 时间感知行
        c. 消息注入（§2.4）：user/assistant 注入块 + 世界书 before/after 最新 user 消息（遵守 tool-call pair 约束）
        d. contextLimit 截断（§2.5，pair 完整性）
        e. deepFreeze(rebuilt)
     ④ 短路：return ctx.llm.stream(rebuilt)   // 重入 → 本监听器放行 → terminal adapterStream(rebuilt)
  → DSH UI 呈现 rebuilt 请求的流（与原生一致）
```

监听器注册形态（host index.ts）：

```ts
ctx.on('llm/stream', (options: GenerateOptions, next) => {
  const sel = selectionBySession.get(options.sessionId)
  if (!sel || options.purpose !== undefined) return next()       // 未选中 / 压缩 / 标题 → 原生直通
  if (reentrant.has(options.sessionId)) return next()             // 本插件重入 → 放行
  const rebuilt = rebuildRequest(options, sel)
  reentrant.add(options.sessionId)
  try { return ctx.llm.stream(rebuilt) } finally { reentrant.delete(options.sessionId) }
}, { global: true })
```

要点（DESIGN-ACTIVATION §2.3）：
1. **绝不原地改 options**：主会话请求 deepFreeze，改即 throw；只能构造新对象并短路返回自己的 AsyncIterable。
2. `ctx.llm.stream(rebuilt)` 重入 waterfall，靠 `reentrant` Set 放行；rebuilt 不再标记 isAgentLoopRequest（WeakSet 只含原对象），invariant 对重入请求直接放行。
3. 模型参数可用 `agent/request` 全局瀑布替代（DESIGN-ACTIVATION §2.4），但 **system/messages 只能走 llm/stream**——本设计单点全部完成。

### 2.2 模型参数覆盖（rebuildRequest a 步）

| 参数 | 规则 | 依据 |
|---|---|---|
| provider/model | **仅 `provider && model` 同时非空才覆盖** `options.provider/model`；否则保留原请求（跟随主会话路由） | 空值 = 跟随主模型（types.ts ModelParams 语义） |
| temperature | `=== 1.0`（默认值/模型默认语义）**视为不覆盖**，保留原请求；否则设置 | 1.0 = 不约束默认；避免无意义覆盖 |
| reasoningEffort | `'auto'` → 省略不传；`'medium'` → 映射 `'low'`；off/low/high/max → 直接传 | ARCHITECTURE 决策 2 沿用 |
| maxTokens | `null` → 省略不传；否则设置 | null = 无限制 |
| topP | **不传**（GenerateOptions/LlmCallConfig 无 topP 字段） | ARCHITECTURE 决策 1 沿用 |
| stream | 忽略（主会话流由 DSH UI 决定） | 无独立聊天窗 |
| stop/tools/signal | 原样保留 | 工具调用链完整性 |

### 2.3 system 重建（b 步）

**顺序固定**（由旧 buildPayload 的 system 部分改造，输入从「chat 历史」换成「主会话 request」）：

```
① 系统提示词模板（assistant.systemPrompt.template；resolveTemplate 双语法 {{var}}/{var}，customVariables 覆盖）
② system 注入块（role='system'，before/after/replace 语义照旧；trigger=keywords 对最近 contextLimit 条消息匹配）
③ skill 说明（assistant.skills.filter(enabled) → "- {name}: {description}" 行）
④ 记忆注入（global/private 池；最近 50 条候选 → 关键词交集+时间衰减打分 → top 5；useChatHistory=true 附首条 user 摘要 ≤200 字）
⑤ 世界书（system-role 段：命中条目按 priority 降序 → WB_TOKEN_BUDGET=1024 截断 → 合并进 system 或作独立 system 消息）
⑥ 时间感知行（assistant.memory.timeAwareness 开才追加；见 §3）
```

最终 `rebuilt.system` = 各段非空部分 `join('\n\n')`。

> **人设接管决策**：选中助手时 `rebuilt.system` 以**助手组装段**为主体（官方 agent system 被替换，人设优先）。
> 若助手模板/各段全部为空 → 保留 `options.system`（官方 system）不覆盖。权衡见 §8 决策 4。

### 2.4 消息注入（c 步）

- 输入：`options.messages`（= session.deriveMessages()，含本轮新 user 消息）。
- **目标锚点 = 最新一条 role==='user' 的消息**（本轮用户输入）。
- user/assistant 注入块：
  - `role='user'` 注入为 user 消息（before = 插到锚点前；after = 插到锚点后）。
  - `role='assistant'` 注入为 assistant 消息（before/after 同理）。
  - 同 role 同位置多条**合并为一条**（内容换行拼接）。
- 世界书：命中 → before/after 注入为 **system 消息**（合并，避免污染对话角色）。
- **tool-call pair 约束（沿旧约束）**：绝不插到「user 消息与其后紧跟 tool-call 的 assistant 消息」之间——
  注入器检查该 pair（消息流中 user 之后是否紧跟含 tool-call 的 assistant 消息），命中则把注入挪到该 assistant 消息之后。
- 注入**只作用于请求面**（rebuilt.messages），不改会话日志（session/event 记录的仍是原始消息）。

### 2.5 contextLimit 截断（d 步）

- `assistant.modelParams.contextLimit`（0 = 全部）：对 `rebuilt.messages` 取最近 N 条。
- **pair 完整性**：截断后若首条为 assistant（其 user 被裁掉），继续前移直到首条 role !== 'assistant'；
  同时保证不切断「user → 其后 tool-call assistant」链。
- 最新 user 消息（本轮输入）恒保留。

---

## 3. 时间感知开关（替代时间提醒）

### 3.1 开关与语义

- 配置：`assistant.memory.timeAwareness: boolean`（**默认 true**；原 `gapReminderMinutes` 已删除）。
- 开 → rebuildRequest §2.3-⑥ 在 system 末尾追加**一行自然上下文**（无 `[时间提醒]` 前缀、无命令式口吻）：

  ```
  （当前时间：{{cur_datetime}}；用户上次对话：{{last_chat_time}}（约 {{elapsed_since_last}} 前））
  ```

  ({{var}} 由变量表替换；`last_chat_time`/`elapsed_since_last` 无值时省略对应小节；全无值则整行省略)
- 关 → 不追加该行；与快捷回复/世界书互不影响。

### 3.2 新增变量

| 变量 | 含义 | 来源 |
|---|---|---|
| `{{cur_date}}` / `{{cur_time}}` / `{{cur_datetime}}` | 当前本地日期/时间（沿用） | Intl + timezone |
| `{{last_chat_time}}` | 上次用户对话的本地时间（如 14:30；无则空） | `selection.lastChatTs` 格式化 |
| `{{elapsed_since_last}}` | 距上次对话的人类可读间隔（如「45 分钟」「2 小时 3 分」；无则空） | `lastChatTs` → now 差 |

`last_chat_time` / `elapsed_since_last` 由 host 侧 resolveTemplate 变量表新增两项（在现有 buildVariableTable 扩展），
数据源 = 会话级 `lastChatTs`（§3.3）。

### 3.3 lastChatTs 维护（host）

```ts
const lastChatTs = new Map<string, number>()   // sessionId → epoch ms
ctx.on('session/event', (session, event) => {
  if (event.type !== 'user/message') return
  if (event.data.source?.kind !== 'user') return   // 排除 agent.inject / 工具上下文 / subagent 合成消息
  lastChatTs.set(session.id, event.time)              // SessionEvent.time = Unix epoch 毫秒
  // 可选：同步写回 selection.json（sessionId 条目 lastChatTs 字段），重启后可读回
})
```

- 依据：DESIGN-ACTIVATION §3.3——`user/message` 的 data 是 UserMessage（无 ts），时间戳在 **SessionEvent.time**；
  过滤 `source.kind === 'user'` 且主会话（session.id 命中选中或任意记住最近的根会话）。
- 冷启动兜底：`ctx.sessions.get(sessionId)?.events` 现算最近 `user/message` 事件的 time（DESIGN-ACTIVATION §4）。
- 会话销毁：可选监听 `session/disposed` 清理 lastChatTs 与 selection 条目（DESIGN-ACTIVATION §8）。

---

## 4. 选择状态（selection.json + API）

### 4.1 存储

文件：`<dataDir>/selection.json`（原子写 tmp + rename，复用 store.ts writeJsonAtomic）。

```json
{
  "sessions": {
    "<sessionId>": { "assistantId": "asst_xxx", "lastChatTs": 1720000000000 }
  }
}
```

- **会话未选中 = 无条目**（取消即删除条目，而非写入 assistantId:null——保持文件最小）。
- 读取兜底：容忍 `assistantId: null` 的历史条目（按未选中处理，下次写入时清理）。
- 形状对齐 `src/shared/types.ts` 的 `SessionSelection`（sessionId / assistantId | null / lastChatTs | null）。

### 4.2 API（src/shared/contracts.ts）

| 方法/路径 | 请求 | 响应 data | 语义 |
|---|---|---|---|
| `GET /assistant-panel/api/selection?sessionId=` | — | `{ selection: { sessionId, assistantId|null, lastChatTs|null } }` | 无条目 → assistantId null、lastChatTs null |
| `POST /assistant-panel/api/selection` | `{ sessionId, assistantId|null }` | `{ selection: SessionSelection }` | assistantId 非 null = 激活（校验助手存在，不存在 → NOT_FOUND）；null = 取消（删条目） |

（GET /api/selection/active 多会话聚合保留给未来，本期不做。）

**副作用**：删除助手（DELETE /api/assistants/:id）时，级联清理所有 sessions 条目中 `assistantId` 指向该助手的引用（§2 注入前会再次校验助手存在性，双保险）。

### 4.3 client 消费

- 当前会话解析：root 槽（footer.action / shell.overlay / settings.section）都收 `GlobalStandardProps.useSessions` → `useSessions(s => s.current)` 得当前 sessionId（DESIGN-ACTIVATION §5）。
- sidebar.footer.action：按钮 + label「助手」（wide 显示 text，rail 只图标），若有选中态追加「：{name}」或勾选标记；点击打开 overlay。
- shell.overlay：管理面板（列表/选中/取消/新建/编辑/删除）；关闭条目标签沿用现有 dap-overlay 自绘模式。
- 检出后经 `GET /selection` 轮询/进入时拉取，展示「当前会话已选助手」。

---

## 5. 持久化布局更新

数据根：`${DSH_HOME || ~/.dsh}/dsh-assistant-panel/`（沿用）。

```
dsh-assistant-panel/
  settings.json              # 插件级设置（userName / locale / timezone / dataDir）
  selection.json             # ★ 新增：会话级选择状态（§4.1）
  assistants/<assistantId>.json   # 助手档案（原子写）
  global-memory.jsonl        # 全局记忆池
  memory/<assistantId>.jsonl # 助手私有记忆池
  # chats/ 目录退役：不再创建/读取；遗留文件由 host 在 apply 时清理或忽略
```

- **chats/ 退役**：ChatStore（store.ts）整体删除；聊天历史由 DSH SessionStore 承载（~/.dsh/sessions），插件不复制。
- **/chat、/chats API 退役**：路由与 handler 删除；client 不再走 SSE 聊天。
- 其余（settings/assistants/记忆池）不变。

---

## 6. 契约变更清单

### 6.1 src/shared/types.ts

| 变更 | 内容 |
|---|---|
| MemoryConfig | 删 `gapReminderMinutes`；增 `timeAwareness: boolean`（默认 true，schema 层） |
| SystemVariableName | + `last_chat_time`、`elapsed_since_last` |
| 新增 | `SessionSelection { sessionId; assistantId: AssistantId|null; lastChatTs: number|null }` |
| ChatId / ChatMessage / ChatSession | 标记 `@deprecated`（chats 退役；保留作历史参考，工程师删除后下架） |

### 6.2 src/shared/contracts.ts

| 变更 | 内容 |
|---|---|
| 路由表 | 删 `POST /api/chat`、`GET /api/chats...`、`GET /api/chats/:id/messages`、`DELETE /api/chats/:id`；增 `GET /api/selection?sessionId=`、`POST /api/selection` |
| 新增类型 | `GetSelectionResp`、`SetSelectionRequest`、`SetSelectionResp` |
| 标记 @deprecated | `ChatRequest`、`ChatEvent`、`CHAT_EVENT_TYPES`、`ChatEventName`、`ChatSummary`、`ListChatsResp`、`GetChatMessagesResp`、`DeleteChatResp` |
| 保留 | assistants / memory / skills / models / workspaces / profile / health |

### 6.3 src/shared/schema.ts

| 变更 | 内容 |
|---|---|
| MemoryConfigSchema | `timeAwareness: z.boolean().default(true)`；删 gapReminderMinutes |
| 新增 | `SelectionInputSchema` + `parseSelectionInput()`（sessionId required；assistantId string|null → null 默认） |

**原则**：shared 保持零运行时依赖；相对导入带 `.ts` 扩展名；client 不 import schema.ts。

---

## 7. 已知限制

1. **Top-P 暂不生效**：DSH GenerateOptions / LlmCallConfig 无 topP 字段；本插件保留设置/校验/持久化，不传给 stream（官方支持后接线）。
2. **会话模型 UI 显示不随激活变化**：模型/参数覆盖仅作用于 llm/stream **请求层**（rebuildRequest），会话 header 与 DSH UI 显示的 provider/model 仍是原值——**README 已注明**。后续如需展示可走 request-inspection 投影（本期不做）。
3. **官方 system 可被替换**：人设优先（§2.3）；助手 system 为空时保留官方 system。
4. **注入不进会话日志**：rebuild 的 system/messages 不写回 session/event（一致性优先；用户对请求检查之外不可见）。
5. **selection 无鉴权**：同源本机 localhost 服务，与其余 API 一致。

---

## 8. 关键决策与取舍

1. **单点短路（llm/stream）而非 agent/request**：system/messages 只能走 llm/stream（DESIGN-ACTIVATION §2.4）；模型参数顺带同点完成，避免双通道不一致。
2. **短路 + 重入防护 Set**：deepFrozen 主请求不可原地改；构造 rebuilt 并 `ctx.llm.stream(rebuilt)` 重入，reentrant 放行（DESIGN-ACTIVATION §2.3）。
3. **过滤 = sessionId 精确匹配 + purpose === undefined**（可选 isAgentLoopRequest 双防），精确排除 subagent/compaction/session-title（DESIGN-ACTIVATION §1.4）。
4. **人设 system 替换官方**：选中助手 = 以助手人设对话，助手 system 完整接管；空模板回退官方。（备选：追加到官方之后会稀释人设且双 system 冲突；不采用。）
5. **temperature=1.0 视为不覆盖**：语义即模型默认，避免面板默认值覆盖原生参数。
6. **时间感知 = 开关 + 自然上下文行**：无 `[时间提醒]` 前缀、无「请结合当前时间作答」命令式口吻；用户纠偏核心。
7. **selection 原子写 + 助手删除级联清理**：崩溃安全 + 悬空引用双保险。
8. **chats 全量退役**：类型 @deprecated → 工程师删除；聊天历史唯一来源 = DSH SessionStore。

---

## 附录：与本文件配套的源码/文档

- 契约：src/shared/{types,contracts,schema}.ts；旧架构：docs/ARCHITECTURE.md（§4/§5/§7 被本文件取代）
- API 核实：docs/DESIGN-ACTIVATION.md（研究员）
- 需求源：docs/DESIGN.md（研究员调研）