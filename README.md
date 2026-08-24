# @dsh-external/dsh-assistant-panel

> 项目仓库（dsh-zhushou）：https://github.com/Starlight-bananice/dsh-zhushou
> 项目管理（issues）：https://github.com/Starlight-bananice/dsh-zhushou/issues

DSH 侧边栏助手插件（功能对标 RikkaHub）：助手档案、模型参数、系统提示词+系统变量、快捷回复、注入模式、世界书、skill 开关、记忆与时间间隔提醒。

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
| 记忆 | 全局/私有池开关、参考聊天记录、时间间隔提醒（默认 30 分钟） |
| 侧边栏 UI | sidebar.footer.action 图标 + shell.overlay 浮层面板 + settings.section 设置页 |

## HTTP API

根路径：/assistant-panel/api（prefix 路由，同源本机服务，无鉴权）。统一信封：{ ok: true, data } / { ok: false, error: { code, message, details? } }。

| 方法/路径 | 用途 |
|---|---|
| GET /health | 健康检查（版本 / dataDir / uptime） |
| GET /assistants · POST /assistants | 助手列表摘要 / 创建 |
| GET /assistants/:id · PUT /assistants/:id · DELETE /assistants/:id | 读取 / 部分更新 / 删除（连带私有记忆与会话） |
| POST /chat | SSE 聊天（text/event-stream；overrides.stream=false 走非流式聚合） |
| GET /chats?assistantId= · GET /chats/:id/messages · DELETE /chats/:id | 会话列表 / 历史 / 删除 |
| GET /memory?global=&assistantId= · POST /memory · PUT /memory/:id · DELETE /memory/:id | 记忆条目 CRUD |
| GET /skills?cwd= | skill 枚举（ctx.skills.list） |
| GET /models | 提供商/模型枚举（含 default 主模型标记、思考强度档位、上下文窗口） |
| GET /workspaces | 工作区枚举（ctx.workspaceRegistry.list） |
| GET /profile · PUT /profile | 插件身份/本地化（userName/locale/timezone/dataDir） |

SSE 事件：connected → reasoning-delta* / text-delta* → done（或 error）；空闲 15s 心跳注释行。

## 数据布局

数据根（可经 PUT /profile 的 dataDir 覆盖）：${DSH_HOME || ~/.dsh}/dsh-assistant-panel/

```
settings.json            # 插件级设置（userName/locale/timezone/dataDir）
assistants/<id>.json     # 助手档案（原子写：tmp + rename）
chats/<chatId>.jsonl     # 会话日志（首行头部 + 逐行消息；>10MB 轮转归档）
global-memory.jsonl      # 全局记忆池
memory/<assistantId>.jsonl  # 助手私有记忆池
```

## 已知限制

1. **Top-P 暂不生效**：DSH GenerateOptions / LlmCallConfig 当前没有 topP 字段（DESIGN 调研核实）。本插件将其作为设置保留、参与校验与持久化，但不传给 ctx.llm.stream；官方支持后接线。
2. **reasoningEffort 就近映射**：DSH 仅 off/low/high/max 四档；medium 由 host 映射为 low；auto 不传（服务端默认）。
3. **记忆抽取未闭环**：记忆注入（关键词+时间衰减取 top 5）与 CRUD 已实现；「fast model 自动抽取事实 → 写入记忆池」的异步抽取仍未接线（契约位 SSE memory-saved 已留），当前记忆内容由用户在设置页手动维护。
4. **skill 面板受 host 运行时影响**：ctx.skills.list() 返回当前运行时注册的技能（如 vision-skills），非编译期全量目录。
5. **多模态未支持**：仅文本消息；图片等后续版本扩展。
