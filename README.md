# lex-pr-runner

**Fan-out tasks as multiple PRs in parallel, then build a merge pyramid from the blocks. Compute dependency order, run gates locally, and merge cleanly.**

**CLI Commands:**
- Core: `lex-pr plan|run|merge|doctor|format|ci-replay`
- Extended: `lex-pr execute|merge-order|report|status|schema`
- MCP server: exposes tools (`plan.create`, `gates.run`, `merge.apply`) and resources under `.smartergpt/runner/`.

## Quick start
```bash
# install dependencies
npm install

# dev mode
npm run dev

# run CLI (ts)
npm run cli -- plan --help
```

## CLI Commands

### Plan Generation
```bash
# Generate plan artifacts (plan.json + snapshot.md)
npm run cli -- plan [--out .smartergpt/runner]

# JSON-only mode for CI integration
npm run cli -- plan --json

# Custom output directory
npm run cli -- plan --out ./my-artifacts
```

### Other Commands
```bash
# Environment and config sanity checks
npm run cli -- doctor

# Gate report aggregation
npm run cli -- report <directory> [--out json|md]

# Python CLI (legacy)
lex-pr schema validate plan.json
lex-pr merge-order plan.json --json
```

### Gate Report Aggregation

The `report` command aggregates gate results from a directory of JSON files:

```bash
# Aggregate gate reports (JSON output)
npm run cli -- report ./gate-results --out json

# Generate markdown summary
npm run cli -- report ./gate-results --out md
```

**Gate Result Format:**
Each gate result file must follow the JSON schema with stable keys:
```json
{
  "item": "item-name",
  "gate": "gate-name",
  "status": "pass|fail",
  "duration_ms": 1000,
  "started_at": "2024-01-15T10:30:00Z",
  "stderr_path": "/path/to/stderr.log",  // optional
  "stdout_path": "/path/to/stdout.log",  // optional
  "meta": {                              // optional
    "exit_code": "0",
    "command": "npm test"
  }
}
```

**Features:**
- Stable, deterministic output with sorted items and gates
- Validation against JSON schema
- Summary statistics (allGreen, pass/fail counts)
- Multiple output formats (JSON, Markdown)
- Exit code 0 if all gates pass, 1 if any fail

## Configuration

The planner reads configuration from `.smartergpt/` directory:

- **`.smartergpt/stack.yml`**: Explicit plan with items, dependencies, and strategies (highest priority)
- **`.smartergpt/scope.yml`**: Target branch and PR selection criteria (fallback)
- **`.smartergpt/deps.yml`**: Dependency definitions (future use)

### Example stack.yml
```yaml
version: 1
target: main
items:
  - id: 1
    name: auth-system      # Dependencies resolve by 'name' field
    branch: feature/auth-system
    sha: abc123def456
    deps: []               # Use 'deps' array (references other item names)
    strategy: rebase-weave
  - id: 2
    name: api-endpoints    # Generator defaults: name := id
    branch: feature/api-endpoints
    deps: ["auth-system"]  # Depends on item with name="auth-system"
    strategy: merge-weave
```

## CLI Exit Codes

The CLI follows standard Unix conventions for automation and CI integration:

- **`0`**: Success - operation completed without errors
- **`2`**: Validation errors - invalid configuration, unknown dependencies, schema violations
- **`1`**: Unexpected errors - system failures, network issues, crashes

```bash
# CI-friendly validation
npm run cli -- plan --json || echo "Plan validation failed with exit code $?"
```

## Project layout
- `src/core`: planner, gates runner, weave strategies
- `src/cli.ts`: human CLI (Commander)
- `src/mcp/server.ts`: MCP tool/resource surface (adapter)
- `.smartergpt/`: canonical inputs + runner artifacts

## Deterministic Behavior

The runner prioritizes **deterministic outputs** for reliable CI/CD integration:

```bash
# Verify determinism - identical inputs produce identical byte outputs
npm run cli -- plan --out .artifacts1
npm run cli -- plan --out .artifacts2
cmp .artifacts1/plan.json .artifacts2/plan.json  # Should be identical
```

**Key guarantees:**
- Canonical JSON with stable key ordering (no timestamps)
- Raw-byte deterministic hashing for artifact verification
- Cross-platform portability (Windows, macOS, Linux)
- Dependency resolution by `name` field with cycle detection

## Notes
- Deterministic > clever. Outputs are sorted for stable diffs.
- `schemas/plan.schema.json` is the source of truth for validation.
- Dependencies resolve by `name` field (generator can default `name := id`)
