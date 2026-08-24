# dsh-zhushou · 助手人设，直接在你的 DSH 会话里

> DeepSeek Harness（DSH）侧边栏助手插件：侧边栏『助手』选项 → 管理/选择助手 → 选中后在 DSH **主会话**内直接以助手人设/模型/参数对话（世界书、记忆、时间感知一并生效）；不选则保持原生会话。

[![DSH](https://img.shields.io/badge/DSH-0.1.1--rc.2-blue)](https://github.com/deepseek-ai/deepseek-harness) [![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FStarlight-bananice%2Fdsh-zhushou%2Ftags&query=%24%5B0%5D.name&label=version&color=green)](https://github.com/Starlight-bananice/dsh-zhushou/releases) [![npm](https://img.shields.io/npm/v/@bananiceee/dsh-zhushou)](https://www.npmjs.com/package/@bananiceee/dsh-zhushou) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![topic](https://img.shields.io/badge/topic-dsh--plugin-orange)](https://github.com/topics/dsh-plugin)

[English](README.md) · [中文](README.zh.md)

---

## 概述

**解决什么问题：** 想在多个助手人设（编程导师、翻译、写作助手……）之间切换，却不想开多个应用、多个聊天窗，或每会话手改系统提示词。

**dsh-zhushou 做什么：** 侧边栏『助手』入口打开管理面板，创建/编辑助手——名称、头像、标签、绑定工作区、模型参数、系统提示词+变量、快捷回复、注入模式、世界书、skill 开关与记忆。选中助手即激活**会话级激活管线**：该 DSH 会话内每次 LLM 请求都会被重建（人设/模型参数/注入块/世界书/记忆/时间感知行）。取消选择（或删除助手）即恢复原生。

**功能亮点：**

- **会话级激活** — 选择状态按 DSH 会话存于 `selection.json`；激活管线拦截 `llm/stream`（`sessionId` 精确匹配 + `purpose === undefined` 过滤，排除压缩/标题/子代理调用）并短路重建请求
- **助手档案** — 名称 / 头像（dataURL 或 URL）/ 标签 / 绑定工作区
- **模型参数** — 模型（空=跟随主模型）/ 温度 / Top-P（预留）/ 思考强度 / 最大 Token / 上下文条数 / 流式开关
- **系统提示词引擎** — 模板 + 双语法变量（`{{var}}` 与 `{var}`）+ 每助手变量覆盖
- **快捷回复** — 一键发送的预写消息模板（绑定助手）
- **注入模式** — role（system/user/assistant）+ position（before/after/replace）+ trigger（always/keywords）
- **世界书** — 关键词命中 → 按 priority 降序 → token 预算（1024）截断 → 注入
- **Skill** — 从 `ctx.skills.list()` 枚举并按助手启用/禁用
- **记忆与时间感知** — 全局/私有记忆池、参考聊天记录开关、时间感知开关（把当前时间/上次对话时间/间隔注入为自然上下文行，无命令式「时间提醒」消息）
- **侧边栏 UI** — `sidebar.footer.action` 文字选项（含选中态）+ `shell.overlay` 管理面板（选择/取消/编辑/复制/删除）+ `settings.section` 设置页
- **干净交接** — 不选 = 完全原生会话；取消选择立即恢复原生

## 兼容性

| 项目 | 值 |
|---|---|
| DSH 版本 | `0.1.1-rc.2`（主线 `master`） |
| 运行时 | Node ≥ 22（host）+ 现代浏览器（client）；无外部服务 |
| 数据 | `${DSH_HOME \|\| ~/.dsh}/dsh-assistant-panel/`（助手/选择/记忆；可在设置页覆盖） |

## 安装 / 卸载

### 安装

```sh
# 从 npm 安装（推荐）
dsh plugin --profile web add @bananiceee/dsh-zhushou

# 或固定精确版本
dsh plugin --profile web add @bananiceee/dsh-zhushou@0.0.1

# 或从 GitHub 仓库安装
dsh plugin --profile web add github:Starlight-bananice/dsh-zhushou

# 或从本地 checkout 装配进 profile
dsh plugin --profile web add ../dsh-assistant-panel

# 或固定 release tarball——不可变且带版本（每次 GitHub Release 均附带）
dsh plugin --profile web add https://github.com/Starlight-bananice/dsh-zhushou/releases/download/v0.0.1/bananiceee-dsh-zhushou-0.0.1.tgz
```

> **注意：** pnpm 11 对刚发布的包强制 24h `minimumReleaseAge`——如果当天发布的版本被拒绝，给 `dsh plugin add` 追加 `--config.minimumReleaseAge=0`。

> **注意：** 仓库已提交预构建的 `lib/` 产物——git 安装开箱即用，**无需构建**。加入插件、重启 DSH Web 即可。

```sh
# 或运行时注入、免重启（开发者流程）
#   dev_inject_plugin / dsh-super-injector → 指向本仓库目录
```

随后启动/重启 DSH Web。无需任何配置——侧边栏底部出现『助手』入口。

### 升级

```sh
# npm 安装：直接更新到 registry 最新版
dsh plugin --profile web update @bananiceee/dsh-zhushou

# github: 安装按安装时的 commit 固定——重新 add 更新的 ref 升级：
dsh plugin --profile web remove @bananiceee/dsh-zhushou
dsh plugin --profile web add github:Starlight-bananice/dsh-zhushou#v0.0.1
```

### 停用

- **只停激活、保留数据** — 在管理面板取消选择助手：所有会话恢复原生；助手与记忆原地保留。
- **彻底停用插件** — 从 profile 的 `bundles` 列表移除；重新加入即恢复。

### 卸载

```sh
dsh plugin --profile web remove @bananiceee/dsh-zhushou
```

**遗留数据：** `${DSH_HOME || ~/.dsh}/dsh-assistant-panel/`（设置/选择/助手/记忆）不会被删除——如需清空请手动移除。

## 快速上手

1. 安装（见上），重启 DSH Web。
2. 点击侧边栏底部的『助手』→ 打开管理面板。
3. 创建助手（名称、头像、模型参数、系统提示词、世界书、skill、记忆……）并保存。
4. 为当前会话选中它——面板显示当前选择状态；此后本会话的每次回复都使用该助手的人设与参数。
5. 取消选择即回到原生会话。

## 功能清单

| 功能 | 说明 |
|---|---|
| 助手档案 | 名称 / 头像（dataURL 或 URL）/ 标签 / 绑定工作区 |
| 模型参数 | 模型（空=跟随主模型）/ 温度 / Top-P（预留）/ 思考强度 / 最大 Token / 上下文条数 / 流式开关 |
| 系统提示词 | 模板 + 变量双语法（`{{var}}` 与 `{var}`）+ 自定义变量覆盖 |
| 快捷回复 | 一键发送的预写消息模板（绑定助手） |
| 注入模式 | role(system/user/assistant) + position(before/after/replace) + trigger(always/keywords) |
| 世界书 | 关键词命中 → 按 priority 降序 → token 预算（1024）截断 → 注入 |
| Skill | 从 `ctx.skills.list()` 枚举并按助手启用/禁用 |
| 记忆 | 全局/私有池开关、参考聊天记录、时间感知开关（注入当前时间/上次对话时间/间隔为自然上下文） |
| 会话级选择 | `selection.json` 按 DSH 会话记录选中助手；选中即在主会话注入（人设/模型参数/世界书/记忆），取消即恢复原生 |
| 侧边栏 UI | `sidebar.footer.action` 文字选项（含选中态）+ `shell.overlay` 管理面板（选择/取消/编辑）+ `settings.section` 设置页 |

## HTTP API

根路径：`/assistant-panel/api`（prefix 路由，同源本机服务，无鉴权）。统一信封：`{ ok: true, data }` / `{ ok: false, error: { code, message, details? } }`。

| 方法/路径 | 用途 |
|---|---|
| GET /health | 健康检查（版本 / dataDir / uptime） |
| GET /assistants · POST /assistants | 助手列表摘要 / 创建 |
| GET /assistants/:id · PUT /assistants/:id · DELETE /assistants/:id | 读取 / 部分更新 / 删除（连带私有记忆） |
| ~~POST /chat~~ | ~~SSE 聊天~~（已退役：主会话对话，激活见 docs/ARCHITECTURE-ACTIVATION.md） |
| ~~GET /chats…~~ | ~~会话列表 / 历史 / 删除~~（已退役，历史由 DSH 会话承载） |
| GET /selection?sessionId= · POST /selection | 会话级助手激活/取消（`{sessionId, assistantId\|null}`；`null`=恢复原生） |
| GET /memory?global=&assistantId= · POST /memory · PUT /memory/:id · DELETE /memory/:id | 记忆条目 CRUD |
| GET /skills?cwd= | skill 枚举（`ctx.skills.list`） |
| GET /models | 提供商/模型枚举（含 default 主模型标记、思考强度档位、上下文窗口） |
| GET /workspaces | 工作区枚举（`ctx.workspaceRegistry.list`） |
| GET /profile · PUT /profile | 插件身份/本地化（userName/locale/timezone/dataDir） |

## 数据布局

数据根（可经 `PUT /profile` 的 `dataDir` 覆盖）：`${DSH_HOME || ~/.dsh}/dsh-assistant-panel/`

```
settings.json            # 插件级设置（userName/locale/timezone/dataDir）
selection.json           # 会话级选择状态（sessionId → {assistantId, lastChatTs}）
assistants/<id>.json     # 助手档案（原子写：tmp + rename）
global-memory.jsonl      # 全局记忆池
memory/<assistantId>.jsonl  # 助手私有记忆池
# chats/ 已退役：聊天历史由 DSH 会话（~/.dsh/sessions）承载
```

## 已知限制

1. **Top-P 暂不生效**：DSH `GenerateOptions` / `LlmCallConfig` 当前没有 `topP` 字段（DESIGN 调研核实）。本插件将其作为设置保留、参与校验与持久化，但不传给 `ctx.llm.stream`；官方支持后接线。
2. **会话模型 UI 显示不随激活变化**：选中助手后，人设/模型/参数覆盖仅作用于 `llm/stream` **请求层**（激活管线，见 docs/ARCHITECTURE-ACTIVATION.md）；会话头部与 DSH UI 显示的 provider/model 仍是原值。后续如需展示可走 request-inspection 投影（本期不做）。
3. **官方 system 可被助手人设替换**：激活时 `rebuilt.system` 以助手组装段为主体（人设优先）；助手 system 为空时保留官方 system。
4. **注入不进会话日志**：激活注入只作用于请求面，`session/event` 记录的仍是原始消息（一致性优先）。
5. **reasoningEffort 就近映射**：DSH 仅 off/low/high/max 四档；medium 由 host 映射为 low；auto 不传（服务端默认）。
6. **记忆抽取未闭环**：记忆注入（关键词+时间衰减取 top 5）与 CRUD 已实现；「fast model 自动抽取事实 → 写入记忆池」的异步抽取仍未接线（记忆条目由用户在设置页手动维护）。
7. **skill 面板受 host 运行时影响**：`ctx.skills.list()` 返回当前运行时注册的技能（如 vision-skills），非编译期全量目录。
8. **多模态未支持**：仅文本消息；图片等后续版本扩展。

## 开发

```sh
# 重建 host + client（需要 DeepSeek Harness checkout；自动探测 DSH_CHECKOUT 或常见路径）
DSH_CHECKOUT=~/deepseek-harness bash scripts/build.sh
npm run build:client          # tsdown → lib/client.js

# 校验已提交的 lib/ 与 src/ 同步（完整重建 + 字节级 diff）
npm run verify

# 启用 pre-push 守护（src/ 或构建配置变更时自动跑 verify.sh）
git config core.hooksPath .githooks

# 运行时注入、免重启（dsh-super-injector 流程）
dev_build_plugin { "dir": "/path/to/dsh-assistant-panel" }
dev_inject_plugin { "dir": "/path/to/dsh-assistant-panel" }
dev_plugin_status
dev_uninject_plugin { "match": "dsh-zhushou" }
```

## 文档

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 整体架构
- [docs/ARCHITECTURE-ACTIVATION.md](docs/ARCHITECTURE-ACTIVATION.md) — 激活管线（llm/stream 短路重建）
- [docs/DESIGN-ACTIVATION.md](docs/DESIGN-ACTIVATION.md) — 激活设计的源码级 API 调研
- [docs/DESIGN.md](docs/DESIGN.md) — 原始产品调研

## 许可证

[MIT](LICENSE) © 2026 Starlight-bananice
