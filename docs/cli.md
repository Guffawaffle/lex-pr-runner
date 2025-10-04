# CLI Reference

Complete reference for the lex-pr-runner command-line interface, including all subcommands, options, and JSON output schemas.

> **📖 See Also**: 
> - [Autopilot Levels](./autopilot-levels.md) - Comprehensive guide to automation levels 0-4
> - [Advanced CLI Features](./advanced-cli.md) - Power user tools and interactive modes

## Global Options

```bash
lex-pr [options] [command]

Options:
  -V, --version     Output the version number
  -h, --help        Display help for command
```

## Configuration Precedence

Configuration values are resolved in the following order (highest to lowest priority):

1. **Command-line flags** (`--out ./custom-dir`)
2. **Environment variables** (`LEX_PR_OUT_DIR=./custom-dir`)  
3. **Configuration files** (`.smartergpt/config.json`)
4. **Built-in defaults**

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LEX_PR_OUT_DIR` | Default output directory for artifacts | `.smartergpt/runner` |
| `LEX_PR_MAX_WORKERS` | Maximum parallel gate execution | `1` |
| `LEX_PR_TIMEOUT` | Default gate timeout in seconds | `300` |

## Commands

### `init`

Initialize lex-pr-runner workspace with interactive setup wizard.

```bash
lex-pr init [options]

Options:
  --force                 Overwrite existing configuration files
  --non-interactive       Run without prompts (use environment variables)
  --github-token <token>  GitHub token for authentication
  --profile-dir <dir>     Profile directory (default: .smartergpt.local)
  -h, --help              Display help for command
```

#### What Gets Created

The init command creates a complete workspace configuration:

```
.smartergpt.local/
├── profile.yml              # Profile metadata (role: local)
├── intent.md                # Project goals and scope
├── scope.yml                # PR discovery rules
├── deps.yml                 # Dependency relationships
├── gates.yml                # Quality gates configuration
└── pull-request-template.md # PR template with dependency syntax
```

#### Interactive Setup

When run without `--non-interactive`, the wizard will:

1. Detect project type (Node.js, Python, Rust, Go, etc.)
2. Prompt for GitHub token (optional)
3. Validate repository access if token provided
4. Create workspace configuration files
5. Display next steps

#### Examples

```bash
# Interactive setup with prompts
lex-pr init

# Non-interactive setup (use environment variables)
export GITHUB_TOKEN=your_token_here
lex-pr init --non-interactive

# Force overwrite existing configuration
lex-pr init --force

# Use custom profile directory
lex-pr init --profile-dir .smartergpt.custom

# Provide GitHub token via CLI
lex-pr init --github-token ghp_your_token_here
```

#### Environment Variables

| Variable | Description | Used When |
|----------|-------------|-----------|
| `GITHUB_TOKEN` | GitHub personal access token | Token authentication |
| `GH_TOKEN` | Alternative GitHub token | Token authentication |

#### Exit Codes

- `0`: Initialization successful
- `1`: Initialization failed (general error)
- `2`: Write protection error (tried to write to read-only profile)

#### Profile Directory Selection

The init command automatically selects the appropriate profile directory:

1. If `--profile-dir` is specified, uses that directory
2. If `.smartergpt` exists (tracked example), uses `.smartergpt.local`
3. Otherwise, uses `.smartergpt.local` for new setups

This ensures local development work doesn't overwrite tracked example configurations.

#### See Also

- [Quickstart Guide](./quickstart.md) - Complete onboarding workflow
- [Profile Resolution](./profile-resolution.md) - Understanding profile directories
- `lex-pr doctor` - Validate environment after initialization

---

### `schema validate`

Validate plan.json files against the schema.

```bash
lex-pr schema validate [options] [file]

Arguments:
  file              Path to plan.json file (alternative to --plan)

Options:
  --plan <file>     Path to plan.json file  
  --json            Output machine-readable JSON errors
  -h, --help        Display help for command
```

#### Examples

```bash
# Validate with human-readable output
lex-pr schema validate plan.json

# Validate with JSON output for CI
lex-pr schema validate --json plan.json

# Using --plan flag
lex-pr schema validate --plan ./configs/plan.json --json
```

#### JSON Output Schema

**Success Response:**
```json
{
  "valid": true
}
```

**Error Response:**
```json
{
  "valid": false,
  "errors": [
    {
      "path": "string",     // Dot-notation path to invalid field
      "message": "string",  // Human-readable error message
      "code": "string"      // Zod validation error code
    }
  ]
}
```

**Exit Codes:**
- `0`: Validation successful
- `1`: System error (file not readable, etc.)
- `2`: Validation failed

---

### `plan`

Generate plan from configuration sources or GitHub PRs.

```bash
lex-pr plan [options]

Options:
  --out <dir>               Output directory for artifacts (default: ".smartergpt/runner")
  --json                    Output canonical plan JSON to stdout only
  --dry-run                 Validate inputs and show what would be written
  --from-github             Auto-discover PRs from GitHub API
  --query <query>           GitHub search query (e.g., 'is:open label:stack:*')
  --labels <labels>         Filter PRs by comma-separated labels
  --include-drafts          Include draft PRs in the plan
  --github-token <token>    GitHub API token (or use GITHUB_TOKEN env var)
  --owner <owner>           GitHub repository owner (auto-detected from git remote)
  --repo <repo>             GitHub repository name (auto-detected from git remote)
  --required-gates <gates>  Comma-separated list of required gates (default: lint,typecheck,test)
  --max-workers <n>         Maximum parallel workers for execution (default: 2)
  --target <branch>         Target branch for merging PRs (default: repo default branch)
  --validate-cycles         Enable dependency cycle detection (default: true)
  --optimize                Optimize plan for parallel execution
  -h, --help                Display help for command
```

#### Plan Generation Modes

**1. Configuration Files Mode (Default)**
```bash
# Generate from .smartergpt/ configuration files
lex-pr plan
```

**2. GitHub Auto-Discovery Mode**
```bash
# Auto-discover PRs from GitHub repository
lex-pr plan --from-github

# With custom GitHub search query
lex-pr plan --from-github --query "is:open label:stack:feature"

# Filter by specific labels
lex-pr plan --from-github --labels "enhancement,feature"

# Include draft PRs
lex-pr plan --from-github --include-drafts
```

#### Examples

```bash
# Generate plan with default output directory
lex-pr plan

# Generate plan to custom directory  
lex-pr plan --out ./my-artifacts

# JSON-only output for piping/processing
lex-pr plan --json

# Validate inputs without writing files
lex-pr plan --dry-run

# GitHub mode: Auto-discover and generate plan
lex-pr plan --from-github --github-token $GITHUB_TOKEN

# Custom policy configuration
lex-pr plan --from-github \
  --required-gates "lint,test,security-scan" \
  --max-workers 4 \
  --target develop

# Optimize and validate plan
lex-pr plan --from-github --optimize --validate-cycles

# Search for specific PRs
lex-pr plan --from-github \
  --query "is:open label:stack:*" \
  --labels "priority-high"
```

#### Dependency Validation

The plan command automatically validates dependencies:

- **Cycle Detection**: Detects circular dependencies between PRs (enabled by default with `--validate-cycles`)
- **Unknown Dependencies**: Validates all dependencies exist in the plan
- **Optimization**: Shows parallelization levels with `--optimize` flag

```bash
# Enable cycle detection (default)
lex-pr plan --from-github --validate-cycles

# Show optimization levels
lex-pr plan --from-github --optimize
```

Example output with `--optimize`:
```
✓ Auto-discovered 5 PRs from GitHub
✓ Dependency validation passed (no cycles detected)
✓ Plan optimized for parallel execution: 3 levels
  Level 1: PR-100
  Level 2: PR-101, PR-102
  Level 3: PR-103, PR-104
```

#### JSON Output Schema (`--json` flag)

**Success Response:**
```json
{
  "schemaVersion": "1.0.0",
  "target": "main",
  "policy": {
    "requiredGates": ["string"],
    "optionalGates": ["string"], 
    "maxWorkers": 1,
    "retries": {},
    "overrides": {},
    "blockOn": ["string"],
    "mergeRule": {
      "type": "strict-required"
    }
  },
  "items": [
    {
      "name": "string",
      "deps": ["string"],
      "gates": [
        {
          "name": "string",
          "run": "string",
          "cwd": "string",
          "env": {},
          "runtime": "local|container|ci-service",
          "container": {
            "image": "string",
            "entrypoint": ["string"],
            "mounts": [
              {
                "source": "string",
                "target": "string", 
                "type": "bind|volume"
              }
            ]
          },
          "artifacts": ["string"]
        }
      ]
    }
  ]
}
```

**Deterministic Guarantees:**
- Keys sorted alphabetically at all levels
- Arrays maintain stable ordering (deps sorted, items by name)
- No runtime timestamps or random values
- Cross-platform identical output

**Exit Codes:**
- `0`: Plan generated successfully
- `1`: System error (filesystem, permissions)
- `2`: Configuration validation failed

---

### `merge-order`

Compute dependency levels and merge order using Kahn's algorithm.

```bash
lex-pr merge-order [options] [file]

Arguments:
  file              Path to plan.json file (alternative to --plan)

Options:
  --plan <file>     Path to plan.json file
  --json            Output JSON format
  -h, --help        Display help for command
```

#### Examples

```bash
# Human-readable merge order
lex-pr merge-order plan.json

# JSON output for automation
lex-pr merge-order --json plan.json

# Using --plan flag
lex-pr merge-order --plan ./configs/plan.json
```

#### JSON Output Schema (`--json` flag)

**Success Response:**
```json
{
  "levels": [
    ["item-a", "item-c"],  // Level 0: No dependencies
    ["item-b"],            // Level 1: Depends on level 0
    ["item-d"]             // Level 2: Depends on level 1
  ],
  "totalItems": 4,
  "maxParallelism": 2
}
```

**Human-Readable Output:**
```
Merge Order (3 levels):
  Level 0: item-a, item-c  
  Level 1: item-b
  Level 2: item-d

Total items: 4, Max parallelism: 2
```

**Exit Codes:**
- `0`: Merge order computed successfully
- `1`: System error (file not readable)
- `2`: Dependency cycle or unknown dependency detected

---

### `plan-review`

Interactively review and edit a plan with human-in-the-loop validation.

```bash
lex-pr plan-review [options] [file]

Arguments:
  file                  Path to plan.json file (alternative to --plan)

Options:
  --plan <file>         Path to plan.json file
  --non-interactive     Non-interactive mode (auto-approve)
  --profile-dir <dir>   Profile directory for history tracking
  --save-history        Save plan versions to history
  --output <file>       Output file for approved/modified plan
  -h, --help            Display help for command
```

#### Features

- **Interactive Review**: View plan summary, dependency graph, and merge order
- **Plan Editing**: Add/remove items, modify dependencies, change target branch
- **Validation**: Automatic validation of dependencies and cycles during editing
- **Approval Workflow**: Approve or reject plans with optional reason
- **History Tracking**: Save plan versions with metadata for audit trail
- **Diff View**: See changes made during interactive session

#### Examples

```bash
# Interactive review with prompts
lex-pr plan-review plan.json

# Auto-approve in non-interactive mode
lex-pr plan-review plan.json --non-interactive

# Review and save to new file
lex-pr plan-review plan.json --output approved-plan.json

# Review with history tracking
lex-pr plan-review plan.json --save-history --profile-dir .smartergpt.local
```

#### Interactive Options

When running in interactive mode, you'll see:

1. **Plan Summary**: Items count, target branch, dependencies overview
2. **Dependency Graph**: ASCII visualization of item dependencies
3. **Merge Order**: Computed execution levels

Then you can choose:
- `[a]` Approve plan - Accept the plan as-is
- `[r]` Reject plan - Reject with optional reason
- `[e]` Edit plan - Interactively modify the plan
- `[v]` View plan details - See full JSON
- `[d]` Show diff - Compare original vs modified
- `[q]` Quit without saving

#### Edit Operations

When editing, you can:
- Add new items with dependencies
- Remove items (validated against dependents)
- Modify item dependencies (cycle detection)
- Change target branch
- Gates editing (planned for future release)

#### Exit Codes

- `0`: Plan approved
- `1`: Plan rejected or operation failed

---

### `plan-diff`

Compare two plans and show differences.

```bash
lex-pr plan-diff [options] <plan1> <plan2>

Arguments:
  plan1       First plan file
  plan2       Second plan file

Options:
  --json      Output JSON format
  -h, --help  Display help for command
```

#### Examples

```bash
# Human-readable diff
lex-pr plan-diff plan-v1.json plan-v2.json

# JSON output for automation
lex-pr plan-diff plan-v1.json plan-v2.json --json
```

#### Human-Readable Output

```
📊 Plan Comparison

Plan 1: plan-v1.json
Plan 2: plan-v2.json

Target Branch: main → develop

Added Items:
  + feature-d
    deps: feature-b
    gates: 2

Removed Items:
  - feature-c

Modified Items:
  ~ feature-b
    deps: [feature-a] → [feature-a, feature-x]
```

#### JSON Output Schema

```json
{
  "targetChanged": true,
  "originalTarget": "main",
  "modifiedTarget": "develop",
  "addedItems": [
    {
      "name": "feature-d",
      "deps": ["feature-b"],
      "gates": []
    }
  ],
  "removedItems": [
    {
      "name": "feature-c",
      "deps": ["feature-a"],
      "gates": []
    }
  ],
  "modifiedItems": [
    {
      "name": "feature-b",
      "originalDeps": ["feature-a"],
      "modifiedDeps": ["feature-a", "feature-x"],
      "originalGatesCount": 1,
      "modifiedGatesCount": 2
    }
  ],
  "hasChanges": true
}
```

#### Exit Codes

- `0`: No changes detected (plans are identical)
- `1`: Changes detected or comparison successful

---

### `execute`

Execute plan with policy-aware gate running and status tracking.

```bash
lex-pr execute [options] [file]

Arguments:
  file                       Path to plan.json file (alternative to --plan)

Options:
  --plan <file>              Path to plan.json file
  --artifact-dir <dir>       Output directory for artifacts (default: "./artifacts")
  --timeout <ms>             Gate timeout in milliseconds (default: "30000")
  --dry-run                  Validate plan and show execution order without running gates
  --json                     Output results in JSON format
  --status-table             Generate status table for PR comments
  --max-level <level>        Maximum autopilot level (0-4) (default: "0")
  --open-pr                  Open pull requests for integration branches (Level 3+)
  --close-superseded         Close superseded PRs after integration (Level 4)
  --comment-template <path>  Path to PR comment template (Level 2+)
  --branch-prefix <prefix>   Prefix for integration branch names (default: "integration/")
  -h, --help                 Display help for command
```

> **📖 Autopilot Levels**: See [Autopilot Levels](./autopilot-levels.md) for details on automation levels 0-4.

#### Examples

```bash
# Execute entire plan
lex-pr execute plan.json

# Execute specific item only
lex-pr execute --only-item item-a plan.json

# JSON output for monitoring
lex-pr execute --json plan.json
```

#### JSON Output Schema (`--json` flag)

**Success Response:**
```json
{
  "executionId": "string",       // Unique execution identifier
  "startedAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:35:00Z", 
  "status": "completed|failed|running",
  "totalItems": 4,
  "completedItems": 4,
  "failedItems": 0,
  "items": [
    {
      "name": "item-a",
      "status": "pass|fail|blocked|skipped|retrying",
      "gates": [
        {
          "gate": "test",
          "status": "pass|fail|blocked|skipped|retrying", 
          "exitCode": 0,
          "duration": 1500,     // milliseconds
          "stdout": "string",
          "stderr": "string",
          "artifacts": ["coverage.json"],
          "attempts": 1,
          "lastAttempt": "2024-01-15T10:32:00Z"
        }
      ],
      "blockedBy": [],          // Items that blocked this one
      "eligibleForMerge": true
    }
  ]
}
```

**Exit Codes:**
- `0`: All gates passed successfully
- `1`: System error during execution
- `2`: One or more gates failed

---

### `status` 

Show current execution status and merge eligibility.

```bash
lex-pr status [options] [file]

Arguments:
  file              Path to plan.json file (alternative to --plan)

Options:
  --plan <file>     Path to plan.json file
  --json            Output JSON format  
  --state-dir <dir> Directory containing execution state (default: ".smartergpt/runner")
  -h, --help        Display help for command
```

#### Examples

```bash
# Show human-readable status
lex-pr status plan.json

# JSON status for dashboards
lex-pr status --json plan.json
```

#### JSON Output Schema (`--json` flag)

**Success Response:**
```json
{
  "executionStatus": "not_started|running|completed|failed",
  "lastUpdated": "2024-01-15T10:35:00Z",
  "summary": {
    "totalItems": 4,
    "passedItems": 2,
    "failedItems": 1, 
    "blockedItems": 1,
    "eligibleForMerge": 2
  },
  "items": [
    {
      "name": "item-a",
      "status": "pass",
      "eligibleForMerge": true,
      "gatesSummary": {
        "total": 2,
        "passed": 2,
        "failed": 0
      }
    }
  ]
}
```

**Exit Codes:**
- `0`: Status retrieved successfully
- `1`: System error (state files not readable)
- `2`: No execution state found

---

### `report`

Aggregate gate reports from directory of JSON files.

```bash
lex-pr report [options] <dir>

Arguments:
  dir               Directory containing gate report JSON files

Options:
  --out <format>    Output format: json|md (default: "json")
  --validate        Validate reports against schema before aggregating
  -h, --help        Display help for command
```

#### Examples

```bash
# JSON summary of gate results
lex-pr report ./gate-results

# Markdown report for humans
lex-pr report --out md ./gate-results

# Validate reports first
lex-pr report --validate ./gate-results
```

#### JSON Output Schema (`--out json`)

**Success Response:**
```json
{
  "summary": {
    "totalReports": 8,
    "totalItems": 4,
    "totalGates": 12,
    "passedGates": 10,
    "failedGates": 2,
    "allGreen": false
  },
  "items": [
    {
      "name": "item-a",
      "gates": [
        {
          "name": "test",
          "status": "pass",
          "duration_ms": 1500,
          "started_at": "2024-01-15T10:30:00Z"
        }
      ],
      "summary": {
        "totalGates": 3,
        "passedGates": 3,
        "failedGates": 0
      }
    }
  ]
}
```

**Markdown Output (`--out md`):**
```markdown
# Gate Execution Report

## Summary
- **Total Items**: 4
- **Total Gates**: 12
- **Passed**: 10 ✅
- **Failed**: 2 ❌  
- **Overall Status**: ❌ FAILED

## Item Results

### item-a ✅
- test: ✅ PASS (1.5s)
- lint: ✅ PASS (0.8s)
- build: ✅ PASS (12.3s)
```

**Exit Codes:**
- `0`: All gates passed (allGreen: true)
- `1`: System error (directory not readable, invalid reports)
- `2`: One or more gates failed

---

### `doctor`

Environment and configuration sanity checks.

```bash
lex-pr doctor [options]

Options:
  --json            Output JSON format
  -h, --help        Display help for command
```

#### Examples

```bash
# Human-readable environment check
lex-pr doctor

# JSON output for automation
lex-pr doctor --json
```

#### JSON Output Schema (`--json` flag)

**Success Response:**
```json
{
  "status": "healthy|warning|error", 
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": [
    {
      "name": "node_version",
      "status": "pass|warn|fail",
      "message": "Node.js 20.10.0 (OK)",
      "expected": ">=18.0.0",
      "actual": "20.10.0"
    },
    {
      "name": "config_files",
      "status": "pass",
      "message": "All configuration files found",
      "details": [
        ".smartergpt/intent.md: ✓",
        ".smartergpt/scope.yml: ✓"
      ]
    }
  ],
  "summary": {
    "totalChecks": 5,
    "passed": 4,
    "warnings": 1,
    "failures": 0
  }
}
```

**Exit Codes:**
- `0`: All checks passed or warnings only
- `1`: System error during checks
- `2`: One or more critical checks failed

## Deterministic Output Requirements

All CLI commands with `--json` output must guarantee:

1. **Stable key ordering**: All JSON objects have keys sorted alphabetically
2. **Consistent formatting**: Use 2-space indentation, no trailing whitespace  
3. **Reproducible timestamps**: Avoid runtime timestamps except where semantically required
4. **Sorted arrays**: Dependencies, items, errors sorted by name/path
5. **Cross-platform consistency**: Same inputs produce identical outputs on Windows/macOS/Linux

### Verification

```bash
# Determinism check - should be byte-identical
npm run build && npm run format
git diff --exit-code  # Must be clean

# Cross-platform verification
lex-pr plan --json > output1.json
lex-pr plan --json > output2.json  
cmp output1.json output2.json     # Should be identical
```

---

## Advanced Commands

### `view`

Interactive plan viewer with keyboard navigation and filtering.

```bash
lex-pr view [options] [file]

Arguments:
  file              Path to plan.json file (alternative to --plan)

Options:
  --plan <file>     Path to plan.json file
  --filter <text>   Initial filter text
  --no-deps         Hide dependencies by default
  --no-gates        Hide gates by default
  -h, --help        Display help for command
```

**Keyboard Navigation:**
- `↑/↓` - Navigate items
- `/` - Enter filter mode
- `d` - Toggle dependencies
- `g` - Toggle gates
- `q` - Quit

#### Examples

```bash
# Open interactive viewer
lex-pr view plan.json

# Start with a filter
lex-pr view plan.json --filter "feature"

# Hide gates by default
lex-pr view plan.json --no-gates
```

---

### `query`

Advanced query and analysis of plan using SQL-like syntax.

```bash
lex-pr query [file] [query] [options]

Arguments:
  file              Path to plan.json file (alternative to --plan)
  query             Query string (e.g., 'level eq 1', 'name contains feature')

Options:
  --plan <file>     Path to plan.json file
  --format <fmt>    Output format: json, table, csv (default: "table")
  --output <file>   Output file (default: stdout)
  --stats           Show plan statistics
  --roots           Show root nodes (no dependencies)
  --leaves          Show leaf nodes (no dependents)
  --level <level>   Filter by merge level
  -h, --help        Display help for command
```

**Query Syntax:**
```
field operator value [AND field operator value]
```

**Operators:** `eq`, `ne`, `contains`, `in`, `gt`, `lt`, `gte`, `lte`

**Fields:** `name`, `level`, `depsCount`, `gatesCount`, `dependentsCount`

#### Examples

```bash
# Find all items at merge level 1
lex-pr query plan.json "level eq 1"

# Find items with specific name pattern
lex-pr query plan.json "name contains feature"

# Find items with more than 2 dependencies
lex-pr query plan.json "depsCount gt 2"

# Complex queries with AND
lex-pr query plan.json "level eq 1 AND depsCount eq 0"

# Show plan statistics
lex-pr query plan.json --stats

# Output as JSON
lex-pr query plan.json "level eq 1" --format json

# Save to file
lex-pr query plan.json --roots --output roots.json --format json
```

---

### `retry`

Retry failed gates with selective filtering.

```bash
lex-pr retry [options]

Options:
  --state-dir <dir>  State directory (default: ".smartergpt/runner")
  --filter <text>    Filter items/gates to retry
  --items <items>    Comma-separated list of items to retry
  --dry-run          Show what would be retried without executing
  --json             Output JSON format
  -h, --help         Display help for command
```

#### Examples

```bash
# Show all failed gates
lex-pr retry --dry-run

# Retry all failed gates
lex-pr retry

# Retry specific items
lex-pr retry --items "item1,item2"

# Retry with filter
lex-pr retry --filter "integration"

# JSON output
lex-pr retry --json
```

---

### `completion`

Generate shell completion scripts for bash and zsh.

```bash
lex-pr completion [shell] [options]

Arguments:
  shell             Shell type: bash, zsh (default: "bash")

Options:
  --install         Show installation instructions
  -h, --help        Display help for command
```

#### Examples

```bash
# Generate bash completion
lex-pr completion bash

# Generate zsh completion
lex-pr completion zsh

# Show installation instructions
lex-pr completion bash --install
```

**Installation:**

For bash:
```bash
# Add to ~/.bashrc
eval "$(lex-pr completion bash)"
```

For zsh:
```bash
# Add to ~/.zshrc
eval "$(lex-pr completion zsh)"
```

---

### Enhanced `merge` Options

The `merge` command now supports batch operations:

```bash
lex-pr merge [options]

Additional Batch Options:
  --batch               Enable batch mode for multiple items
  --filter <query>      Filter items using query language
  --levels <levels>     Comma-separated list of levels to merge
  --items <items>       Comma-separated list of items to merge
```

#### Batch Examples

```bash
# Merge specific items
lex-pr merge plan.json --batch --items "item1,item2" --execute

# Merge all items at specific levels
lex-pr merge plan.json --batch --levels "1,2" --execute

# Merge items matching a query
lex-pr merge plan.json --batch --filter "level eq 1" --execute
```

---

## Error Handling

All commands follow consistent error handling:

- **Exit code 0**: Success
- **Exit code 1**: System/infrastructure errors
- **Exit code 2**: User/validation errors

JSON error responses use consistent format:
```json
{
  "error": true,
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    // Command-specific error context
  }
}
```

See [Error Taxonomy](./errors.md) for complete error code reference.