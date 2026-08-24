# dsh-zhushou · Assistant personas, inside your DSH session

> A DeepSeek Harness (DSH) sidebar assistant plugin: manage and pick assistant personas from the sidebar, then talk to the selected one **inside the main DSH session** — with its own persona, model, parameters, world book and memory. Leave the selection empty and the session stays fully native.

[![DSH](https://img.shields.io/badge/DSH-0.1.1--rc.2-blue)](https://github.com/deepseek-ai/deepseek-harness) [![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FStarlight-bananice%2Fdsh-zhushou%2Ftags&query=%24%5B0%5D.name&label=version&color=green)](https://github.com/Starlight-bananice/dsh-zhushou/releases) [![npm](https://img.shields.io/npm/v/@bananiceee/dsh-zhushou)](https://www.npmjs.com/package/@bananiceee/dsh-zhushou) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![topic](https://img.shields.io/badge/topic-dsh--plugin-orange)](https://github.com/topics/dsh-plugin)

[English](README.md) · [中文](README.zh.md)

---

## Overview

**The problem:** you want to switch between assistant personas (a coding mentor, a translator, a story writer…) without juggling separate apps, separate chat windows, or hand-edited system prompts per session.

**What dsh-zhushou does:** a sidebar **助手 (Assistant)** option opens a management panel where you create and edit assistants — name, avatar, tags, workspace binding, model parameters, system prompt with variables, quick replies, injection modes, world book entries, skill switches and memory. Selecting an assistant activates a **session-level activation pipeline**: every LLM request in that DSH session is rebuilt with the assistant's persona, model parameters, injected blocks, world-book context, memory and time-awareness line. Deselect (or delete) the assistant and the session returns to its native behavior.

**Feature highlights:**

- **Session-scoped activation** — selection lives in `selection.json` per DSH session; the activation pipeline intercepts `llm/stream` (exact `sessionId` match, `purpose === undefined` filters out compaction/session-title/subagent calls) and short-circuits with a rebuilt request
- **Assistant profiles** — name / avatar (dataURL or URL) / tags / bound workspace
- **Model parameters** — model (empty = follow the main model) / temperature / Top-P (reserved) / reasoning effort / max tokens / context message count / streaming switch
- **System prompt engine** — template + dual variable syntax (`{{var}}` and `{var}`) + per-assistant variable overrides
- **Quick replies** — one-click prewritten message templates bound to an assistant
- **Injection modes** — role (system/user/assistant) + position (before/after/replace) + trigger (always/keywords)
- **World book** — keyword hit → priority order → 1024-token budget truncation → injected into the request
- **Skills** — enumerate `ctx.skills.list()` and enable/disable per assistant
- **Memory & time awareness** — global/private memory pools, chat-history reference switch, and a time-awareness switch that injects current time / last-chat time / elapsed interval as a natural context line (no directive "time reminder" messages)
- **Sidebar UI** — `sidebar.footer.action` text entry (with selected state) + `shell.overlay` management panel (select/cancel/edit/copy/delete) + `settings.section` full settings page
- **Clean handoff** — no selection ⇒ fully native session; cancelling a selection restores native behavior immediately

## Compatibility

| Item | Value |
|---|---|
| DSH versions | `0.1.1-rc.2` (mainline `master`) |
| Runtime | Node ≥ 22 (host) + modern browser (client); no external services |
| Data | `${DSH_HOME \|\| ~/.dsh}/dsh-assistant-panel/` (assistants, selection, memory; overridable via the settings page) |

## Install / Uninstall

### Install

```sh
# From npm (recommended)
dsh plugin --profile web add @bananiceee/dsh-zhushou

# Or pin an exact npm version
dsh plugin --profile web add @bananiceee/dsh-zhushou@0.0.1

# Or from the GitHub repository
dsh plugin --profile web add github:Starlight-bananice/dsh-zhushou

# Or from a local checkout (profile assembly)
dsh plugin --profile web add ../dsh-assistant-panel

# Or a pinned release tarball — immutable and versioned (attached to every GitHub release)
dsh plugin --profile web add https://github.com/Starlight-bananice/dsh-zhushou/releases/download/v0.0.1/bananiceee-dsh-zhushou-0.0.1.tgz
```

> **Note:** pnpm 11 enforces a 24h `minimumReleaseAge` for freshly published packages — if a same-day release is rejected, append `--config.minimumReleaseAge=0` to the `dsh plugin add` command.

> **Note:** the built `lib/` artifacts are committed to the repository — a git install is ready to run immediately, **no build step required**. Add the plugin, restart DSH Web, done.

```sh
# Or runtime injection without a restart (developer workflow)
#   dev_inject_plugin / dsh-super-injector → point at this repository
```

Then start/restart DSH Web. No configuration is required — the 助手 entry appears in the sidebar footer.

### Upgrade

```sh
# npm installs: update straight to the latest registry version
dsh plugin --profile web update @bananiceee/dsh-zhushou

# github: installs pin a commit at install time — re-add a newer ref to upgrade:
dsh plugin --profile web remove @bananiceee/dsh-zhushou
dsh plugin --profile web add github:Starlight-bananice/dsh-zhushou#v0.0.1
```

### Disable

- **Keep the data, stop the activation** — deselect the assistant in the management panel: every session returns to native behavior; assistants and memory stay in place.
- **Stop the plugin entirely** — remove it from the profile's `bundles` list; re-adding restores it.

### Uninstall

```sh
dsh plugin --profile web remove @bananiceee/dsh-zhushou
```

**Data left behind:** `${DSH_HOME || ~/.dsh}/dsh-assistant-panel/` (settings, selection, assistants, memory) is not deleted — remove it manually if you want a clean slate.

## Quick start

1. Install (above), restart DSH Web.
2. Click **助手** in the sidebar footer → the management panel opens.
3. Create an assistant (name, avatar, model parameters, system prompt, world book, skills, memory…) and save.
4. Select it for the current session — the panel shows the active selection; from now on every reply in this session uses the assistant's persona and parameters.
5. Deselect to return to the native session.

## Features

| Feature | Details |
|---|---|
| Assistant profiles | name / avatar (dataURL or URL) / tags / bound workspace |
| Model parameters | model (empty = follow main model) / temperature / Top-P (reserved) / reasoning effort / max tokens / context message count / streaming switch |
| System prompt | template + dual variable syntax (`{{var}}` and `{var}`) + per-assistant variable overrides |
| Quick replies | one-click prewritten message templates (bound to an assistant) |
| Injection modes | role (system/user/assistant) + position (before/after/replace) + trigger (always/keywords) |
| World book | keyword hit → priority order → token budget (1024) truncation → injection |
| Skills | enumerate `ctx.skills.list()` and enable/disable per assistant |
| Memory | global/private pool switches, chat-history reference, time-awareness switch (injects current time / last-chat time / interval as a natural context line) |
| Session selection | `selection.json` records the chosen assistant per DSH session; selecting injects persona/model/world-book/memory into the main session, deselecting restores native behavior |
| Sidebar UI | `sidebar.footer.action` text entry (with selected state) + `shell.overlay` management panel (select/cancel/edit) + `settings.section` settings page |

## HTTP API

Root: `/assistant-panel/api` (prefix route, same-origin local service, no auth). Unified envelope: `{ ok: true, data }` / `{ ok: false, error: { code, message, details? } }`.

| Method / path | Purpose |
|---|---|
| GET /health | health check (version / dataDir / uptime) |
| GET /assistants · POST /assistants | assistant list summary / create |
| GET /assistants/:id · PUT /assistants/:id · DELETE /assistants/:id | read / partial update / delete (cascades private memory) |
| ~~POST /chat~~ | ~~SSE chat~~ (retired: main-session dialogue; see docs/ARCHITECTURE-ACTIVATION.md) |
| ~~GET /chats…~~ | ~~chat list / history / delete~~ (retired; history lives in DSH sessions) |
| GET /selection?sessionId= · POST /selection | session-level activation (`{sessionId, assistantId\|null}`; `null` = restore native) |
| GET /memory?global=&assistantId= · POST /memory · PUT /memory/:id · DELETE /memory/:id | memory entry CRUD |
| GET /skills?cwd= | skill enumeration (`ctx.skills.list`) |
| GET /models | provider/model enumeration (default main-model marker, reasoning-effort tiers, context windows) |
| GET /workspaces | workspace enumeration (`ctx.workspaceRegistry.list`) |
| GET /profile · PUT /profile | plugin identity/localization (userName/locale/timezone/dataDir) |

## Data layout

Data root (overridable via `PUT /profile` `dataDir`): `${DSH_HOME || ~/.dsh}/dsh-assistant-panel/`

```
settings.json            # plugin settings (userName/locale/timezone/dataDir)
selection.json           # session selection state (sessionId → {assistantId, lastChatTs})
assistants/<id>.json     # assistant profiles (atomic write: tmp + rename)
global-memory.jsonl      # global memory pool
memory/<assistantId>.jsonl  # per-assistant private memory pool
# chats/ retired: chat history is carried by DSH sessions (~/.dsh/sessions)
```

## Known limitations

1. **Top-P not wired yet** — DSH `GenerateOptions` / `LlmCallConfig` has no `topP` field today; the setting is kept, validated and persisted but not passed to `ctx.llm.stream`. It will be wired once the official API supports it.
2. **Session model UI does not follow activation** — persona/model/parameter overrides act on the `llm/stream` **request layer** (activation pipeline, see docs/ARCHITECTURE-ACTIVATION.md); the session header and DSH UI still show the original provider/model.
3. **The official system prompt can be replaced** — on activation, `rebuilt.system` is the assistant-composed block (persona first); if the assistant system prompt is empty the official system prompt is kept.
4. **Injections don't appear in the session log** — activation only rewrites the request face; `session/event` records the original messages (consistency first).
5. **reasoningEffort is mapped to the nearest tier** — DSH only has off/low/high/max; medium is mapped to low host-side, auto is omitted (server default).
6. **Memory extraction not closed-loop** — memory injection (keyword + time-decay top 5) and CRUD are implemented; the async "fast-model auto-extracts facts → memory pool" step is not wired yet (entries are maintained manually on the settings page).
7. **Skill panel reflects the host runtime** — `ctx.skills.list()` returns the skills registered in the current runtime (e.g. vision-skills), not a compile-time full catalog.
8. **No multimodal support** — text messages only; images etc. are planned for later versions.

## Development

```sh
# Rebuild host + client (needs a DeepSeek Harness checkout; probes DSH_CHECKOUT or common paths)
DSH_CHECKOUT=~/deepseek-harness bash scripts/build.sh
npm run build:client          # tsdown → lib/client.js

# Verify committed lib/ is in sync with src/ (full rebuild + byte diff)
npm run verify

# Enable the pre-push guard (auto-runs verify.sh when src/ or build config changes)
git config core.hooksPath .githooks

# Runtime injection without a restart (dsh-super-injector workflow)
dev_build_plugin { "dir": "/path/to/dsh-assistant-panel" }
dev_inject_plugin { "dir": "/path/to/dsh-assistant-panel" }
dev_plugin_status
dev_uninject_plugin { "match": "dsh-zhushou" }
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — overall architecture
- [docs/ARCHITECTURE-ACTIVATION.md](docs/ARCHITECTURE-ACTIVATION.md) — the activation pipeline (llm/stream short-circuit rebuild)
- [docs/DESIGN-ACTIVATION.md](docs/DESIGN-ACTIVATION.md) — source-verified API research behind the activation design
- [docs/DESIGN.md](docs/DESIGN.md) — original product research

## License

[MIT](LICENSE) © 2026 Starlight-bananice
