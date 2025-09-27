# lex-pr-runner

**Lex-PR Runner** — fan-out PRs, compute a merge pyramid, run local gates, and **weave** merges cleanly.
- CLI: `lex-pr plan|run|merge|doctor|format|ci-replay`
- MCP server: exposes tools (`plan.create`) and resources under `.smartergpt/runner/`

## Quick start
```bash
# Install dependencies
npm install

# dev
npm run dev

# run CLI (ts)
npm run cli -- plan --help

# run MCP server
npm run mcp
```

## Project layout
- `src/core`: planner, gates runner, weave strategies
- `src/cli.ts`: human CLI (Commander)
- `src/mcp/server.ts`: MCP tool/resource surface (adapter)
- `.smartergpt/`: canonical inputs + runner artifacts

## CLI Commands

```bash
# Compute merge pyramid and freeze plan artifacts
npm run cli -- plan [--out <dir>]

# Environment and config sanity checks
npm run cli -- doctor
```

## MCP Tools

The MCP server exposes the following tools for chat/agent integration:

### `plan.create`
Runs the same logic as the CLI plan command, generating:
- `plan.json`: Structured plan data
- `snapshot.md`: Human-readable plan summary

**Parameters:**
- `out` (optional): Artifacts output directory (default: `.smartergpt/runner`)

**Returns:** Plan metadata and URIs to generated artifacts

### Resources
- `.smartergpt/runner/plan.json`: Read-only access to structured plan data
- `.smartergpt/runner/snapshot.md`: Read-only access to plan summary

## Notes
- Deterministic > clever. Outputs are sorted for stable diffs.
- Plan artifacts are deterministic when inputs are unchanged.
- MCP server provides programmatic access to planning functionality.