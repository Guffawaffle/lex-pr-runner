# Configuration Precedence and Policy Handling

This document defines the configuration precedence order, policy handling rules, and troubleshooting guide for the lex-pr-runner.

## Configuration Precedence Order

The runner resolves configuration from multiple sources with the following precedence (highest to lowest):

1. **CLI flags** - Command-line arguments override all other sources
2. **Environment variables** - System environment variables  
3. **Configuration files** - Files in `.smartergpt/` directory
4. **Default values** - Built-in defaults

### CLI Flags

CLI flags have the highest precedence and override all other configuration sources:

```bash
# Override target branch
npm run cli -- plan --target=develop

# Override output directory  
npm run cli -- plan --out=custom-artifacts

# Enable JSON-only mode
npm run cli -- plan --json

# Enable dry-run mode
npm run cli -- plan --dry-run
```

### Environment Variables

Environment variables provide system-level configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `LEX_PROFILE_DIR` | `.smartergpt` | Profile directory location |
| `ALLOW_MUTATIONS` | `false` | Enable mutation operations in MCP server |
| `LEX_TARGET_BRANCH` | `main` | Default target branch |
| `LEX_MAX_WORKERS` | `1` | Maximum concurrent gate workers |
| `LEX_ADMIN_USERS` | - | Comma-separated list of admin users |

Example usage:
```bash
# Use custom profile directory
export LEX_PROFILE_DIR="/custom/profile"
npm run cli -- plan

# Override target branch
export LEX_TARGET_BRANCH="develop" 
npm run cli -- plan

# Enable admin overrides for specific users
export LEX_ADMIN_USERS="admin1,admin2"
npm run cli -- run
```

### Configuration File Discovery

The runner searches for configuration files in the following order within the profile directory:

#### Primary Discovery Path: `.smartergpt/`

1. **`.smartergpt/stack.yml`** (highest precedence)
   - Explicit plan with items, dependencies, and strategies
   - When present, overrides all other configuration files
   - Complete specification of merge plan

2. **`.smartergpt/scope.yml`** (fallback)
   - Target branch and PR selection criteria
   - Used when `stack.yml` is not present
   - Provides defaults and selectors

3. **`.smartergpt/deps.yml`** (future use)
   - Dependency definitions and constraints
   - Currently loaded but not processed
   - Reserved for future dependency resolution features

#### Alternative Discovery: Current Directory

If `.smartergpt/` directory is not found, the runner will search in the current working directory:

1. `./stack.yml`
2. `./scope.yml` 
3. `./deps.yml`

## Configuration File Formats

### stack.yml (Complete Plan)

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
    gates:
      - name: test
        run: npm test
        runtime: local
      - name: lint
        run: npm run lint
        runtime: local
        env:
          NODE_ENV: test
  - id: 2
    name: api-endpoints    
    branch: feature/api-endpoints
    deps: ["auth-system"]  # Depends on item with name="auth-system"
    strategy: merge-weave
    gates:
      - name: build
        run: npm run build
        runtime: container
        container:
          image: node:20-alpine
```

### scope.yml (Selection Criteria)

```yaml
version: 1
target: main
sources:
  - query: "repo:org/repo is:pr state:open"
selectors:
  include_labels: ["ready-for-merge", "tested"]
  exclude_labels: ["work-in-progress", "blocked"]
defaults:
  strategy: merge-weave
  base: main
pin_commits: false
```

### Policy Configuration

Policies can be embedded in `stack.yml` or specified via environment variables:

```yaml
# In stack.yml
version: 1
target: main
policy:
  requiredGates: ["test", "lint", "build"]
  optionalGates: ["integration-test"]
  maxWorkers: 3
  retries:
    test:
      maxAttempts: 3
      backoffSeconds: 5
    integration-test:
      maxAttempts: 2
      backoffSeconds: 10
  overrides:
    adminGreen:
      allowedUsers: ["admin", "tech-lead"]
      requireReason: true
  blockOn: ["security-scan"]
  mergeRule:
    type: strict-required
items:
  # ... plan items
```

## Policy Override Rules

### Admin Green Scenarios

Admin overrides allow authorized users to bypass failing gates under specific conditions:

1. **User Authorization**: Only users listed in `policy.overrides.adminGreen.allowedUsers` can request overrides
2. **Reason Requirement**: If `requireReason: true`, a non-empty reason must be provided
3. **Audit Trail**: All override requests are logged with timestamp, user, and reason

```typescript
// Request override via API
evaluator.requestOverride("node-name", "admin-user", "Critical hotfix required");
```

Environment variable configuration:
```bash
export LEX_ADMIN_USERS="admin1,admin2"
export LEX_REQUIRE_OVERRIDE_REASON="true"
```

### Policy Composition Rules

When multiple configuration sources define policies, they are composed as follows:

1. **CLI flags** override specific policy fields
2. **Environment variables** provide policy defaults
3. **stack.yml policy section** provides explicit policy configuration
4. **Built-in defaults** fill any missing values

#### Composition Priority

- `requiredGates`: CLI > ENV > config file > defaults (`[]`)
- `maxWorkers`: CLI > ENV > config file > defaults (`1`)
- `adminGreen.allowedUsers`: CLI > ENV > config file > defaults (`undefined`)
- `adminGreen.requireReason`: CLI > ENV > config file > defaults (`false`)

## Configuration Validation

### Schema Validation

All configuration files are validated against Zod schemas:

- **stack.yml**: `StackConfig` schema with strict validation
- **scope.yml**: `ScopeConfig` schema with strict validation
- **Policy objects**: `Policy` schema with type checking

### Error Handling

The runner provides detailed error messages for configuration issues:

```bash
# Schema validation error
Error: Schema validation failed: items.0.strategy: Invalid enum value. Expected 'rebase-weave' | 'merge-weave' | 'squash-weave', received 'invalid-strategy'
Exit code: 2

# File not found (non-fatal)
Warning: Configuration file .smartergpt/stack.yml not found, falling back to scope.yml

# Invalid YAML/JSON
Error: Configuration parsing failed: Invalid YAML syntax at line 5, column 3
Exit code: 2

# Missing dependencies
Error: Unknown dependency: item 'api-endpoints' depends on 'unknown-item' which is not defined
Exit code: 2
```

## Environment Variable Type Coercion

Environment variables are strings and require type coercion:

- **Boolean values**: `"true"` → `true`, `"false"` (or empty) → `false`
- **Number values**: `"3"` → `3`, invalid numbers → default value + warning
- **Array values**: `"item1,item2,item3"` → `["item1", "item2", "item3"]`
- **Object values**: Not supported via environment variables

## Troubleshooting Configuration Issues

### Common Problems

#### 1. Configuration File Not Found

**Symptom**: Runner uses defaults instead of expected configuration

**Solution**: 
- Verify `.smartergpt/` directory exists
- Check file names (case-sensitive): `stack.yml`, `scope.yml`
- Ensure files are valid YAML format

```bash
# Check directory structure
ls -la .smartergpt/

# Validate YAML syntax
npm run cli -- doctor
```

#### 2. Schema Validation Failures

**Symptom**: Exit code 2 with schema validation errors

**Solution**:
- Review error message for specific field issues
- Check required vs optional fields
- Validate enum values (strategy types, runtime types)

```bash
# Test configuration validity
npm run cli -- plan --dry-run
```

#### 3. Dependency Resolution Errors

**Symptom**: "Unknown dependency" errors

**Solution**:
- Ensure all `deps` references match item `name` fields
- Verify item names are unique
- Check for circular dependencies

#### 4. Policy Override Failures

**Symptom**: Override requests rejected

**Solution**:
- Verify user is in `allowedUsers` list
- Provide reason if `requireReason: true`
- Check policy configuration in `stack.yml`

### Diagnostic Commands

```bash
# Check configuration loading
npm run cli -- doctor

# Validate plan generation
npm run cli -- plan --dry-run

# View configuration precedence
npm run cli -- plan --json | jq '.sources'

# Test policy evaluation
npm run cli -- status --json
```

### Debug Environment Variables

Enable detailed logging for configuration debugging:

```bash
export DEBUG="lex:config,lex:policy"
export LEX_VERBOSE="true"
npm run cli -- plan
```

## Configuration Examples

### Minimal Configuration

`.smartergpt/scope.yml`:
```yaml
version: 1
target: main
```

### Complete Configuration

`.smartergpt/stack.yml`:
```yaml
version: 1
target: main
policy:
  requiredGates: ["test", "lint"]
  maxWorkers: 2
  retries:
    test:
      maxAttempts: 3
      backoffSeconds: 5
  overrides:
    adminGreen:
      allowedUsers: ["admin"]
      requireReason: true
items:
  - id: 1 
    name: backend
    branch: feature/backend
    deps: []
    strategy: rebase-weave
    gates:
      - name: test
        run: npm test
      - name: lint  
        run: npm run lint
  - id: 2
    name: frontend
    branch: feature/frontend  
    deps: ["backend"]
    strategy: merge-weave
    gates:
      - name: test
        run: npm run test:frontend
      - name: build
        run: npm run build
```

### Environment Override Example

```bash
# Override defaults via environment
export LEX_TARGET_BRANCH="develop"
export LEX_MAX_WORKERS="4" 
export LEX_ADMIN_USERS="admin1,admin2"
export LEX_REQUIRE_OVERRIDE_REASON="true"

# CLI overrides environment
npm run cli -- plan --target=main --out=custom-artifacts
```

This configuration will result in:
- Target: `main` (CLI override)
- Max workers: `4` (environment variable)
- Output directory: `custom-artifacts` (CLI override)
- Admin users: `["admin1", "admin2"]` (environment variable)