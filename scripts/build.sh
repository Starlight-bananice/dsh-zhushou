#!/bin/bash
# Build @bananiceee/dsh-zhushou.
#   1. probe the dsh checkout (DSH_CHECKOUT env → 常见路径)
#   2. junction-link host/client build deps from the checkout
#   3. compile host src/ → lib/ with the checkout's tsc (tsconfig.json, client 排除)
#   4. compile client declarations → lib/types/client (tsconfig.client.json)
# The UI bundle itself is produced by tsdown (package.json build:client).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── 1. locate the checkout ────────────────────────────────────────────────
CHECKOUT="${DSH_CHECKOUT:-}"
if [ -z "$CHECKOUT" ]; then
  for candidate in \
    "$HOME/deepseek-harness" \
    "$HOME/dsh-harness" \
    "$HOME/dsh" \
    "$HOME/.dsh/dsh-harness"; do
    if [ -d "$candidate/packages" ]; then CHECKOUT="$candidate"; break; fi
  done
fi
if [ -z "$CHECKOUT" ] || [ ! -d "$CHECKOUT/packages" ]; then
  echo "build: cannot locate the dsh checkout (set DSH_CHECKOUT)" >&2
  exit 1
fi
echo "=== Checkout: $CHECKOUT ==="

TSC="$CHECKOUT/node_modules/.bin/tsc"
if [ ! -x "$TSC" ] && [ ! -f "$TSC.cmd" ]; then
  echo "build: tsc not found at $TSC" >&2
  exit 1
fi

link_pkg() {
  # link_pkg <node_modules 相对路径> <checkout 内相对路径>
  local link="node_modules/$1"
  local target="$CHECKOUT/$2"
  if [ ! -e "$target" ]; then
    echo "build: dependency target missing: $target" >&2
    return 1
  fi
  node -e "
    const fs = require('fs');
    const path = require('path');
    const link = path.resolve(process.argv[1]);
    const target = path.resolve(process.argv[2]);
    fs.rmSync(link, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  " "$link" "$target"
}

echo "=== Linking build dependencies (checkout: $CHECKOUT) ==="
mkdir -p node_modules/@deepseek-ai
node -e "const fs=require('fs');fs.rmSync('node_modules/@standard-schema',{recursive:true,force:true})"
link_pkg cordis vendor/cordis
link_pkg cosmokit vendor/cosmokit
link_pkg schemastery vendor/schemastery
link_pkg @deepseek-ai/dsh-tools packages/core/tools
link_pkg @deepseek-ai/dsh-llm packages/llm/llm
link_pkg @deepseek-ai/dsh-system-prompt packages/core/system-prompt
link_pkg @deepseek-ai/dsh-host-webserver packages/host/webserver
link_pkg @deepseek-ai/dsh-session packages/core/session
link_pkg @deepseek-ai/dsh-client-ui-slots packages/client/ui-slots
link_pkg @deepseek-ai/dsh-client-locale packages/client/locale
link_pkg @deepseek-ai/dsh-settings packages/settings/settings
link_pkg @deepseek-ai/dsh-skill packages/skill/skill
link_pkg @deepseek-ai/dsh-workspace packages/workspace/workspace
link_pkg @deepseek-ai/dsh-agent-default-model packages/core/agent-default-model
link_pkg @types/node node_modules/@types/node

# react / react-dom（client 类型与打包外置）：从 checkout pnpm 树链
REACT_DIR=$(find "$CHECKOUT/node_modules/.pnpm" -maxdepth 1 -type d -name 'react@*' 2>/dev/null | head -1)
if [ -n "$REACT_DIR" ]; then
  link_pkg react "node_modules/.pnpm/$(basename "$REACT_DIR")/node_modules/react"
fi
for pkg in react react-dom; do
  T=$(find "$CHECKOUT/node_modules/.pnpm" -maxdepth 1 -type d -name "@types+$pkg@*" 2>/dev/null | head -1)
  if [ -n "$T" ]; then
    node -e "
      const fs = require('fs');
      const path = require('path');
      const link = path.resolve('node_modules/@types/$pkg');
      const target = path.resolve(process.argv[1] + '/node_modules/@types/$pkg');
      fs.rmSync(link, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    " "$T"
  fi
done

STD_SCHEMA=$(find "$CHECKOUT/node_modules/.pnpm" -maxdepth 1 -type d -iname '@standard-schema+spec@*' 2>/dev/null | head -1)
if [ -n "$STD_SCHEMA" ]; then
  node -e "
    const fs = require('fs');
    const path = require('path');
    fs.rmSync('node_modules/@standard-schema', { recursive: true, force: true });
    fs.mkdirSync('node_modules/@standard-schema', { recursive: true });
    fs.symlinkSync(path.resolve(process.argv[1]), path.resolve('node_modules/@standard-schema/spec'), process.platform === 'win32' ? 'junction' : 'dir');
  " "$STD_SCHEMA/node_modules/@standard-schema/spec"
fi

# 本机 node_modules/.bin 为空（pnpm install 未跑）：补 tsc 直链 + tsdown 包装器
# （checkout 的 .bin/tsdown 是 shim，基于 $0 的 basedir 解析 .pnpm 仓库路径，
#   在插件目录以相对路径调用时会把 run.mjs 解析到插件自己的 node_modules/.pnpm → 必挂。
#   故改用绝对路径包装器直跑 store 里的 run.mjs。）
if [ ! -e "node_modules/.bin/tsc" ] && [ -e "$CHECKOUT/node_modules/.bin/tsc" ]; then
  mkdir -p node_modules/.bin
  ln -s "$CHECKOUT/node_modules/.bin/tsc" "node_modules/.bin/tsc"
fi
TSDOWN_STORE=$(find "$CHECKOUT/node_modules/.pnpm" -maxdepth 1 -type d -iname 'tsdown@*' 2>/dev/null | head -1)
if [ -n "$TSDOWN_STORE" ] && [ ! -e "node_modules/.bin/tsdown" ]; then
  mkdir -p node_modules/.bin
  cat > node_modules/.bin/tsdown <<EOF
#!/bin/sh
exec node "$TSDOWN_STORE/node_modules/tsdown/dist/run.mjs" "$@"
EOF
  chmod +x node_modules/.bin/tsdown
  echo "wrote node_modules/.bin/tsdown -> $TSDOWN_STORE/node_modules/tsdown/dist/run.mjs"
fi

echo "=== Compiling host src → lib ==="
"$TSC" -p tsconfig.json

echo "=== Compiling client declarations → lib/types/client ==="
"$TSC" -p tsconfig.client.json

echo "=== Build complete (client bundle: run tsdown / npm run build:client) ==="
