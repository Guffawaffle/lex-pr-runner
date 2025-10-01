#!/usr/bin/env bash
# Simple CI debug helper: prints environment and runs the project's checks in verbose mode.
set -euo pipefail
echo "--- CI DEBUG: environment ---"
echo "USER: $(whoami)"
echo "PWD: $(pwd)"
echo "Node: $(node --version || echo 'node not found')"
echo "NPM: $(npm --version || echo 'npm not found')"
echo "NPX: $(npx --version || echo 'npx not found')"
echo "--- ENV VARS (selected) ---"
echo "CI=${CI:-}"
echo "GITHUB_ACTIONS=${GITHUB_ACTIONS:-}"
echo "GITHUB_REF=${GITHUB_REF:-}"
echo "GITHUB_SHA=${GITHUB_SHA:-}"
echo "--- DISK USAGE ---"
df -h . || true
echo "--- Node modules size ---"
du -sh node_modules 2>/dev/null || true
echo "--- Typecheck ---"
npm run typecheck
echo "--- Build ---"
npm run build
echo "--- Tests (verbose) ---"
CI=${CI:-} npm test -- --run --reporter verbose || true
