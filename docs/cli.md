# CLI Reference

Complete reference for the lex-pr-runner command-line interface, including all subcommands, options, and JSON output schemas.

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

Generate plan from configuration sources.

```bash
lex-pr plan [options]

Options:
  --out <dir>       Output directory for artifacts (default: ".smartergpt/runner")
  --json            Output canonical plan JSON to stdout only
  --dry-run         Validate inputs and show what would be written
  -h, --help        Display help for command
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

### `execute`

Execute plan with policy-aware gate running and status tracking.

```bash
lex-pr execute [options] [file]

Arguments:
  file              Path to plan.json file (alternative to --plan)

Options:
  --plan <file>     Path to plan.json file
  --only-item <name> Execute gates for specific item only
  --json            Output JSON format
  --out <dir>       Output directory for execution state (default: ".smartergpt/runner")
  -h, --help        Display help for command
```

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