# lex-pr-runner

**Fan-out tasks as multiple PRs in parallel, then build a merge pyramid from the blocks. Compute dependency order, run gates locally, and merge cleanly.**

## Components

- **Runner CLI**: TypeScript command-line app under `src/**`. Commands: `plan|run|merge|doctor|format|ci-replay` + `execute|merge-order|report|status|schema`
- **MCP server**: Optional read-only adapter at `src/mcp/server.ts`. Exposes tools (`plan.create`, `gates.run`, `merge.apply`) and resources under `.smartergpt/runner/`
- **Workspace profile**: Portable example profile under `.smartergpt/**`. Configuration inputs the runner consumes

## Two-track separation (firm)

See [`docs/TERMS.md`](docs/TERMS.md) for complete canonical terms and separation rules. Core runner (`src/**`) never stores user/work artifacts. `.smartergpt/**` contains portable example profile only.

## Requirements

- **Node.js**: Version specified in `.nvmrc` (currently 20.18.0)
- **npm**: Version specified in `packageManager` field of `package.json` (currently 10.0.0)
- **Git**: Configured with `user.name` and `user.email`

Use `npm run cli -- doctor` to verify your environment meets all requirements.

## Quick start

### For New Users

```bash
# 1. Install globally or in your project
npm install -g lex-pr-runner

# 2. Initialize workspace (interactive)
lex-pr init

# 3. Verify environment
lex-pr doctor

# 4. Discover PRs
lex-pr discover

# 5. Generate plan
lex-pr plan --from-github

# 6. Execute gates
lex-pr execute plan.json

# 7. Merge PRs
lex-pr merge plan.json
```

See [docs/quickstart.md](docs/quickstart.md) for a complete 5-minute onboarding guide.

## 📚 Documentation

**[Complete Documentation →](docs/README.md)**

### Quick Links
- **[Getting Started](docs/quickstart.md)** - 5-minute onboarding
- **[Architecture Overview](docs/architecture.md)** - System design & philosophy
- **[CLI Reference](docs/cli.md)** - Complete command documentation
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues & solutions
- **[Migration Guide](docs/migration-guide.md)** - From manual to automated
- **[Video Tutorials](docs/tutorials/)** - Step-by-step video guides
- **[Workflows](docs/workflows/)** - Examples for different team sizes
- **[CI/CD Integrations](docs/integrations/)** - Platform-specific setup

### For Development

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

### Profile Resolution

The runner uses a **precedence chain** to locate the profile directory:

1. `--profile-dir <path>` - Explicit CLI override
2. `LEX_PR_PROFILE_DIR` - Environment variable
3. `.smartergpt.local/` - Local overlay (development, not tracked)
4. `.smartergpt/` - Tracked example profile (default)

**Quick start:**
```bash
# Initialize local overlay for development
npm run cli -- init-local

# Runner automatically uses .smartergpt.local/
npm run cli -- plan

# Or use explicit override
npm run cli -- plan --profile-dir /custom/path
```

See [docs/profile-resolution.md](docs/profile-resolution.md) for complete documentation, migration guide, and examples.

### Configuration Files

The planner reads configuration from the resolved profile directory:

- **`stack.yml`**: Explicit plan with items, dependencies, and strategies (highest priority)
- **`scope.yml`**: Target branch and PR selection criteria (fallback)
- **`deps.yml`**: Dependency definitions (future use)
- **`profile.yml`**: Profile metadata and role (`example`, `development`, `local`)

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

## Note about tests and temp directories

When running tests the suite may run files in parallel. Some tests temporarily change the process working directory (for example to exercise CLI behaviors) and create/remove temp directories. To avoid race conditions and `getcwd()` failures we use a per-test-file temporary directory naming pattern (based on the test filename) so parallel test files don't collide when they change `process.cwd()` or remove temporary folders. If you add new tests that change directory, follow the same pattern:

```ts
const testDir = path.join(os.tmpdir(), `lex-pr-runner-determinism-test-${path.basename(__filename)}`);
process.chdir(testDir);
```

This keeps tests isolated and prevents intermittent failures when running the full test suite.

## Notes
- Deterministic > clever. Outputs are sorted for stable diffs.
- `schemas/plan.schema.json` is the source of truth for validation.
- Dependencies resolve by `name` field (generator can default `name := id`)
