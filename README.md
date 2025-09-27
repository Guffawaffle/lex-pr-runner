# lex-pr-runner

**Lex-PR Runner** — fan-out PRs, compute a merge pyramid, run local gates, and **weave** merges cleanly.
- CLI: `lex-pr plan|run|merge|doctor|format|ci-replay`
- MCP server: exposes tools (`plan.create`, `gates.run`, `merge.apply`) and resources under `.smartergpt/runner/`.

## Quick start
```bash
# dev
npm run dev

# run CLI (ts)
npm run cli -- plan --help
```

## Project layout
- `src/core`: planner, gates runner, weave strategies
- `src/cli.ts`: human CLI (Commander)
- `src/mcp/server.ts`: MCP tool/resource surface (adapter)
- `.smartergpt/`: canonical inputs + runner artifacts
