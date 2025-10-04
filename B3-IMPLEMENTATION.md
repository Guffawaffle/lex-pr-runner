# B3: Plan Generation CLI - Implementation Summary

## Overview

Successfully implemented comprehensive CLI tools for automatic plan.json generation from repository analysis, PR graphs, and dependency declarations.

## Implemented Features

### 1. Repository Structure Analysis ✅
- **Function**: `generatePlanFromGitHub()` in `src/core/githubPlan.ts`
- **Capabilities**:
  - Repository validation and access verification
  - PR discovery with configurable filters
  - File change analysis for conflict detection
  - Automatic metadata extraction

### 2. PR Dependency Parser ✅
- **Module**: `src/planner/dependencyParser.ts`
- **Supported Formats**:
  - `Depends-on: #123, #456`
  - `Depends: PR-123, PR-456`
  - `Requires: #123`
  - GitHub keywords: `Closes #123`, `Fixes #456`
  - Cross-repo: `owner/repo#123`
- **Metadata Extraction**:
  - Gate overrides (skip/required)
  - YAML front matter
  - Priority and labels

### 3. Plan Generation Engine ✅
- **Modes**:
  1. **Configuration Files**: `.smartergpt/` YAML files
  2. **GitHub Auto-Discovery**: Direct PR analysis
- **Output**: Validated `plan.json` with canonical JSON format

### 4. Configurable Policy Integration ✅
- **CLI Options**:
  - `--required-gates <gates>`: Custom gate list (default: lint,typecheck,test)
  - `--max-workers <n>`: Parallel execution limit (default: 2)
  - `--target <branch>`: Merge target branch
- **Implementation**: Policy embedded in generated plan

### 5. Dependency Resolution & Cycle Detection ✅
- **Algorithm**: Kahn's topological sort in `computeMergeOrder()`
- **Features**:
  - Circular dependency detection
  - Unknown dependency validation
  - Deterministic ordering
- **CLI**: `--validate-cycles` (enabled by default)

### 6. Plan Optimization & Validation ✅
- **Optimization**: Shows parallelization levels
- **CLI**: `--optimize` flag
- **Output Example**:
  ```
  ✓ Plan optimized for parallel execution: 3 levels
    Level 1: PR-100
    Level 2: PR-101, PR-102
    Level 3: PR-103
  ```

### 7. CLI Commands ✅
- **Command**: `lex-pr plan [options]`
- **Options** (15 total):
  - Output control: `--out`, `--json`, `--dry-run`
  - GitHub mode: `--from-github`, `--query`, `--labels`, `--include-drafts`
  - Authentication: `--github-token`, `--owner`, `--repo`
  - Policy: `--required-gates`, `--max-workers`, `--target`
  - Validation: `--validate-cycles`, `--optimize`

### 8. Multiple Plan Generation Strategies ✅
- **Config-based**: Load from `.smartergpt/` files
- **GitHub-based**: Auto-discover with search queries
- **Label filtering**: `--labels "feature,priority-high"`
- **Query syntax**: GitHub search queries

### 9. Comprehensive Tests ✅
- **New Test File**: `tests/cli-plan-generation.spec.ts`
  - Policy Configuration (3 tests)
  - Dependency Validation (3 tests)
  - Plan Optimization (2 tests)
  - GitHub Plan Generation (2 tests)
  - Error Messages (2 tests)
- **Existing Coverage**:
  - `github-integration.spec.ts`: GitHub client & plan generation
  - `dependencyParser.spec.ts`: Parser functionality
  - `mergeOrder.test.ts`: Cycle detection

### 10. Documentation ✅
- **Updated**: `docs/cli.md`
  - Complete plan command reference
  - All CLI options documented
  - Usage examples
- **New**: `docs/plan-generation.md`
  - Comprehensive generation guide
  - Mode explanations
  - Policy configuration
  - Troubleshooting
  - Best practices

## How to Verify

### 1. Plan Generation from Repository
```bash
# GitHub auto-discovery (requires GITHUB_TOKEN)
lex-pr plan --from-github --dry-run

# With custom policy
lex-pr plan --from-github \
  --required-gates "lint,test,security-scan" \
  --max-workers 4 \
  --optimize
```

### 2. Dependency Parsing Verification
```bash
# Test various formats in PR descriptions
npm test -- tests/dependencyParser.spec.ts --run

# Expected: All formats parsed correctly
```

### 3. Schema Validation
```bash
# Generate and validate plan
lex-pr plan --from-github --json > plan.json

# Verify schema compliance
npm run cli -- merge-order plan.json
```

### 4. Cycle Detection
```bash
# Create plan with circular dependencies
echo '{
  "schemaVersion": "1.0.0",
  "target": "main",
  "items": [
    {"name": "PR-1", "deps": ["PR-2"], "gates": []},
    {"name": "PR-2", "deps": ["PR-1"], "gates": []}
  ]
}' > /tmp/cycle.json

# Verify cycle detection
lex-pr merge-order /tmp/cycle.json
# Expected: Error about circular dependency
```

### 5. Different Repository States
```bash
# Empty repository (no PRs)
lex-pr plan --from-github --dry-run

# With drafts
lex-pr plan --from-github --include-drafts

# Filtered by labels
lex-pr plan --from-github --labels "feature,bug"
```

## Test Results

All tests passing:
```
Test Files  52 passed (52)
Tests       603 passed | 9 skipped (612)
```

New tests added:
- `cli-plan-generation.spec.ts`: 12 tests (all passing)

## Key Improvements

1. **Flexible Policy Configuration**: CLI options for gates, workers, target branch
2. **Automatic Validation**: Built-in cycle detection (default enabled)
3. **Plan Optimization**: Visual parallelization levels with `--optimize`
4. **Enhanced Error Messages**: Clear cycle detection and dependency errors
5. **Comprehensive Documentation**: Full guide with examples and troubleshooting

## Files Changed

### Source Code
- `src/cli.ts`: Added 5 new CLI options, validation logic
- `src/core/githubPlan.ts`: Enhanced policy handling for empty plans

### Tests
- `tests/cli-plan-generation.spec.ts`: New comprehensive test suite (12 tests)

### Documentation
- `docs/cli.md`: Updated plan command section with all options
- `docs/plan-generation.md`: New comprehensive generation guide

## Acceptance Criteria Status

All 10 acceptance criteria ✅ COMPLETED:

1. ✅ Analyze repository structure and existing PR dependencies
2. ✅ Implement PR dependency parser (footers, labels, metadata)
3. ✅ Create plan generation engine from repository state
4. ✅ Add configurable policy integration for plan generation
5. ✅ Implement dependency resolution and cycle detection
6. ✅ Add plan optimization and validation
7. ✅ Create CLI commands for plan generation workflow
8. ✅ Add support for multiple plan generation strategies
9. ✅ Create comprehensive tests for plan generation accuracy
10. ✅ Update documentation for plan generation CLI usage

## Related Issues

- Parent Epic: #75 - Diffgraph Planner & Dependency Resolution
- Related: #99
