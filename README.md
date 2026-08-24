# @dsh-external/dsh-assistant-panel

> 项目仓库（dsh-zhushou）：https://github.com/Starlight-bananice/dsh-zhushou
> 项目管理（issues）：https://github.com/Starlight-bananice/dsh-zhushou/issues

DSH 侧边栏助手插件（功能对标 RikkaHub）：侧边栏『助手』选项 → 管理/选择助手 → 选中后在 DSH **主会话**内以助手人设/模型/参数对话，不选保持原生。功能：助手档案、模型参数、系统提示词+系统变量、快捷回复、注入模式、世界书、skill 开关、记忆与时间感知。

---

## 安装

### 方式一：运行时注入（dsh-super-injector，免重启）

```bash
# 1. 构建（host tsc + client typecheck + tsdown 打 client bundle）
DSH_CHECKOUT=/Users/a64485/deepseek-harness bash scripts/build.sh
# 或注入器环境内一键：dev_build_plugin {"dir": "/Users/a64485/Documents/dsh/dsh-assistant-panel"}

# 2. 注入（host + client 同时生效）
dev_inject_plugin {"dir": "/Users/a64485/Documents/dsh/dsh-assistant-panel"}

# 3. 状态确认
dev_plugin_status

# 4. 卸载（恢复原状）
dev_uninject_plugin {"match": "dsh-assistant-panel"}
```

### 方式二：装配进 profile（重启后持久生效）

将本包放入 profile 的 bundles 列表并安装依赖（参考 DSH 插件装配流程），重启后由 bundles 正常装配，与注入器双路径一致。

## 功能清单

| 功能 | 说明 |
|---|---|
| 助手档案 | 名称 / 头像（dataURL 或 URL）/ 标签 / 绑定工作区 |
| 模型参数 | 模型（空=跟随主模型）/ 温度 / Top-P（预留）/ 思考强度 / 最大 Token / 上下文条数 / 流式开关 |
| 系统提示词 | 模板 + 变量双语法（{{var}} 与 {var}）+ 自定义变量覆盖 |
| 快捷回复 | 一键发送的预写消息模板（绑定助手） |
| 注入模式 | role(system/user/assistant) + position(before/after/replace) + trigger(always/keywords) |
| 世界书 | 关键词命中 → 按 priority 降序 → token 预算（1024）截断 → 注入 |
| Skill | 从 ctx.skills.list() 枚举并按助手启用/禁用 |
| 记忆 | 全局/私有池开关、参考聊天记录、时间感知开关（注入当前时间/上次对话时间/间隔为自然上下文） |
| 会话级选择 | selection.json 按 DSH 会话记录选中助手；选中即在主会话注入（人设/模型参数/世界书/记忆），取消即恢复原生 |
| 侧边栏 UI | sidebar.footer.action 文字选项（含选中态）+ shell.overlay 管理面板（选择/取消/编辑）+ settings.section 设置页 |

## HTTP API

根路径：/assistant-panel/api（prefix 路由，同源本机服务，无鉴权）。统一信封：{ ok: true, data } / { ok: false, error: { code, message, details? } }。

| 方法/路径 | 用途 |
|---|---|
| GET /health | 健康检查（版本 / dataDir / uptime） |
| GET /assistants · POST /assistants | 助手列表摘要 / 创建 |
| GET /assistants/:id · PUT /assistants/:id · DELETE /assistants/:id | 读取 / 部分更新 / 删除（连带私有记忆与会话） |
| ~~POST /chat~~ | ~~SSE 聊天~~（已退役：主会话对话，激活见 docs/ARCHITECTURE-ACTIVATION.md） |
| ~~GET /chats…~~ | ~~会话列表 / 历史 / 删除~~（已退役，历史由 DSH 会话承载） |
| GET /selection?sessionId= · POST /selection | 会话级助手激活/取消（{sessionId, assistantId|null}；null=恢复原生） |
| GET /memory?global=&assistantId= · POST /memory · PUT /memory/:id · DELETE /memory/:id | 记忆条目 CRUD |
| GET /skills?cwd= | skill 枚举（ctx.skills.list） |
| GET /models | 提供商/模型枚举（含 default 主模型标记、思考强度档位、上下文窗口） |
| GET /workspaces | 工作区枚举（ctx.workspaceRegistry.list） |
| GET /profile · PUT /profile | 插件身份/本地化（userName/locale/timezone/dataDir） |

## 数据布局

数据根（可经 PUT /profile 的 dataDir 覆盖）：${DSH_HOME || ~/.dsh}/dsh-assistant-panel/

```
settings.json            # 插件级设置（userName/locale/timezone/dataDir）
selection.json           # 会话级选择状态（sessionId → {assistantId, lastChatTs}）
assistants/<id>.json     # 助手档案（原子写：tmp + rename）
global-memory.jsonl      # 全局记忆池
memory/<assistantId>.jsonl  # 助手私有记忆池
# chats/ 已退役：聊天历史由 DSH 会话（~/.dsh/sessions）承载
```

## 已知限制

1. **Top-P 暂不生效**：DSH GenerateOptions / LlmCallConfig 当前没有 topP 字段（DESIGN 调研核实）。本插件将其作为设置保留、参与校验与持久化，但不传给 ctx.llm.stream；官方支持后接线。
2. **会话模型 UI 显示不随激活变化**：选中助手后，人设/模型/参数覆盖仅作用于 llm/stream **请求层**（激活管线，见 docs/ARCHITECTURE-ACTIVATION.md）；会话头部与 DSH UI 显示的 provider/model 仍是原值。后续如需展示可走 request-inspection 投影（本期不做）。
3. **官方 system 可被助手人设替换**：激活时 `rebuilt.system` 以助手组装段为主体（人设优先）；助手 system 为空时保留官方 system。
4. **注入不进会话日志**：激活注入只作用于请求面，session/event 记录的仍是原始消息（一致性优先）。
5. **reasoningEffort 就近映射**：DSH 仅 off/low/high/max 四档；medium 由 host 映射为 low；auto 不传（服务端默认）。
6. **记忆抽取未闭环**：记忆注入（关键词+时间衰减取 top 5）与 CRUD 已实现；「fast model 自动抽取事实 → 写入记忆池」的异步抽取仍未接线（记忆条目由用户在设置页手动维护）。
7. **skill 面板受 host 运行时影响**：ctx.skills.list() 返回当前运行时注册的技能（如 vision-skills），非编译期全量目录。
8. **多模态未支持**：仅文本消息；图片等后续版本扩展。
