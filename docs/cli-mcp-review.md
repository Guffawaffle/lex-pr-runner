# CLI/MCP Current Behavior Review

This document provides an inventory of the current CLI commands and MCP server tools in lex-pr-runner, documenting their behavior, outputs, and error handling patterns.

## CLI Commands

### Core Commands

#### `plan [options]`
- **Purpose**: Generate plan from configuration sources
- **Options**:
  - `--json`: Output plan as JSON to stdout only
  - `--out <dir>`: Output directory for artifacts (default: `.smartergpt/runner`)
  - `--dry-run`: Show what would be generated without writing files
- **Outputs**:
  - JSON mode: Plan object to stdout with deterministic key ordering
  - Normal mode: `plan.json` and `snapshot.md` files + summary to stdout
- **Exit codes**: 0 (success), 1 (unexpected), 2 (validation)

#### `merge-order [options] [file]`
- **Purpose**: Compute dependency levels and merge order
- **Options**:
  - `--plan <file>`: Path to plan.json (alternative to positional arg)
  - `--json`: Output JSON format
- **Outputs**:
  - JSON mode: `{"levels": [["item1"], ["item2", "item3"]]}` 
  - Normal mode: Human-readable level listing
- **Exit codes**: 0 (success), 2 (validation errors), 1 (unexpected)

#### `execute [options] [file]`
- **Purpose**: Execute plan with policy-aware gate running
- **Options**:
  - `--plan <file>`: Path to plan.json
  - `--artifact-dir <dir>`: Output directory for artifacts
  - `--timeout <ms>`: Gate timeout (default: 30000)
  - `--dry-run`: Validate plan without running gates
  - `--json`: Output results in JSON format
  - `--status-table`: Generate status table for PR comments
- **Exit codes**: 0 (success), 1 (failure), 2 (validation)

#### `status [options] [file]`
- **Purpose**: Show execution status and merge eligibility
- **Options**:
  - `--plan <file>`: Path to plan.json
  - `--json`: Output JSON format
- **Outputs**: Plan structure and merge eligibility information
- **Exit codes**: 0 (success), 2 (validation errors)

#### `report [options] <dir>`
- **Purpose**: Aggregate gate reports from directory
- **Options**:
  - `--out <format>`: Output format (`json` or `md`)
- **Outputs**:
  - JSON: Structured gate results with `allGreen` status
  - Markdown: Human-readable summary
- **Exit codes**: 0 (all gates pass), 1 (any gates fail), 2 (validation)

### Schema Operations

#### `schema validate [options] [file]`
- **Purpose**: Validate plan.json against schema
- **Options**:
  - `--plan <file>`: Path to plan.json
  - `--json`: Output machine-readable JSON errors
- **Outputs**:
  - JSON mode: `{"valid": boolean, "errors": ValidationError[]}`
  - Normal mode: Human-readable validation messages
- **Exit codes**: 0 (valid), 1 (invalid), 2 (validation errors)

#### `doctor`
- **Purpose**: Environment and config sanity checks
- **Outputs**: System information and configuration validation
- **Exit codes**: 0 (success)

## MCP Server Tools

### Available Tools

#### `plan.create`
- **Purpose**: Create a plan from configuration files
- **Input Schema**:
  ```json
  {
    "json": boolean (optional, default: false),
    "outDir": string (optional)
  }
  ```
- **Output**: `PlanCreateResult` with `plan` object and `outDir` path
- **Environment**: Uses `LEX_PROFILE_DIR` (default: `.smartergpt`)

#### `gates.run`
- **Purpose**: Execute gates for plan items
- **Input Schema**:
  ```json
  {
    "onlyItem": string (optional),
    "onlyGate": string (optional), 
    "outDir": string (optional)
  }
  ```
- **Output**: `GatesRunResult` with items, gate statuses, and `allGreen` flag

#### `merge.apply`
- **Purpose**: Apply merge operations
- **Input Schema**:
  ```json
  {
    "dryRun": boolean (optional, default: true)
  }
  ```
- **Output**: `MergeApplyResult` with `allowed` flag and `message`
- **Environment**: Requires `ALLOW_MUTATIONS=true` for non-dry-run operations

## Current Exit Code Patterns

Based on `exitWith()` function and CLI implementations:

- **0**: Success - operation completed without errors
- **1**: Unexpected errors - system failures, network issues, crashes
- **2**: Validation errors - invalid configuration, schema violations, unknown dependencies

## JSON Output Characteristics

### Deterministic Ordering
- Uses `canonicalJSONStringify()` for consistent byte-for-byte output
- Object keys sorted recursively, arrays preserve authored order
- All JSON outputs end with newline for consistent file artifacts

### Current JSON Structures
- Plan objects: Follow schema v1.0.0 with `schemaVersion`, `target`, `items`
- Error objects: `{"error": string}` or `{"valid": false, "errors": ValidationError[]}`
- Results: Command-specific structures (levels, gate results, etc.)

## Error Handling Patterns

### Schema Validation Errors
- Thrown as `SchemaValidationError` with structured `issues` array
- Exit code 2 for validation failures
- JSON mode provides machine-readable error details

### Dependency Errors
- `UnknownDependencyError` for invalid dependency references
- `CycleError` for circular dependencies
- Both result in exit code 2

### Unexpected Errors
- Generic Error instances and unknown exceptions
- Exit code 1 for system-level failures
- Error messages written to stderr in non-JSON mode

## Current Limitations

1. **Inconsistent JSON flag support**: Not all commands support `--json`
2. **Mixed error formats**: Some errors go to stderr, others to stdout
3. **No structured error codes**: Only basic exit codes, no detailed error taxonomy
4. **Limited MCP error handling**: Basic McpError wrapping without detailed classification