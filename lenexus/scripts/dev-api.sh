#!/usr/bin/env bash
set -euo pipefail
workspace="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
supports_sqlite() {
  "$1" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||(major===22&&minor>=16)?0:1)' >/dev/null 2>&1
}
if ! supports_sqlite "$(command -v node)"; then
  found="${LENEXUS_NODE_BINARY:-}"
  if [[ -z "$found" || ! -x "$found" ]] || ! supports_sqlite "$found"; then
    echo "Lenexus API requires Node.js >=22.16. Set LENEXUS_NODE_BINARY to a compatible runtime; the bot runtime has not been changed." >&2
    exit 1
  fi
  export PATH="$(dirname "$found"):$PATH"
fi
cd "$workspace"
exec pnpm --filter @workspace/api-server run dev:runtime
