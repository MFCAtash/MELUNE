#!/usr/bin/env bash
# Generates (or refreshes) package-lock.json for the whole monorepo.
# Needs network access to registry.npmjs.org — run it on your machine or via
# the "Generate lockfile" GitHub workflow, not in an offline sandbox.
set -euo pipefail
cd "$(dirname "$0")/.."

need_major=20
node_major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$node_major" -lt "$need_major" ]; then
  echo "Node >= $need_major required (found $(node -v)). Try: nvm use" >&2
  exit 1
fi

# Fail early with a clear message when the registry is unreachable.
if ! npm ping --registry=https://registry.npmjs.org/ >/dev/null 2>&1; then
  echo "Cannot reach https://registry.npmjs.org/ — check network/proxy settings." >&2
  exit 1
fi

# --package-lock-only: resolve + write the lock without populating node_modules.
# --ignore-scripts: never run install scripts while merely resolving.
npm install --package-lock-only --ignore-scripts --no-audit --no-fund

node scripts/check-lockfile.mjs

# Final proof: npm itself must accept the lock (no changes, no network install).
npm ci --dry-run --ignore-scripts >/dev/null
echo "✔ package-lock.json generated and verified. Commit it:"
echo "    git add package-lock.json && git commit -m 'chore: add package-lock.json'"
