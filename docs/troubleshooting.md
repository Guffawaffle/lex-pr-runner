# Troubleshooting Guide

Common issues, solutions, and debugging techniques for lex-pr-runner.

## Quick Diagnostics

Always start with the doctor command:

```bash
lex-pr doctor
```

This validates:
- Node.js and npm versions
- Git configuration
- GitHub token (if provided)
- Workspace configuration
- Profile directory resolution

## Common Issues

### Installation & Setup

#### Issue: `command not found: lex-pr`

**Cause:** Package not installed globally or not in PATH.

**Solutions:**

```bash
# Option 1: Install globally
npm install -g lex-pr-runner

# Option 2: Use npx
npx lex-pr-runner init

# Option 3: Use local installation
npm install --save-dev lex-pr-runner
npx lex-pr init

# Option 4: Add to package.json scripts
{
  "scripts": {
    "lex-pr": "lex-pr"
  }
}
npm run lex-pr -- init
```

#### Issue: `Error: Cannot find module 'lex-pr-runner'`

**Cause:** Dependencies not installed.

**Solution:**

```bash
# In project directory
npm install

# Or clean reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Issue: Node version mismatch

**Cause:** Using incompatible Node.js version.

**Solution:**

```bash
# Check required version
cat .nvmrc
# Output: 20.18.0

# Use nvm to switch
nvm install 20.18.0
nvm use 20.18.0

# Or use volta
volta install node@20.18.0
```

### Configuration Issues

#### Issue: `Could not detect GitHub repository`

**Cause:** Running outside a Git repository or no GitHub remote configured.

**Solutions:**

```bash
# Check Git remote
git remote -v

# If no remote, add one
git remote add origin https://github.com/owner/repo.git

# Or specify explicitly
lex-pr discover --owner <owner> --repo <repo>

# Or initialize workspace first
lex-pr init
```

#### Issue: `Profile directory not found`

**Cause:** Workspace not initialized or wrong directory.

**Solutions:**

```bash
# Initialize workspace
lex-pr init

# Or specify profile directory
lex-pr plan --profile-dir .smartergpt.local

# Or use environment variable
export LEX_PR_PROFILE_DIR=.smartergpt.local
lex-pr plan
```

#### Issue: `Invalid configuration file: scope.yml`

**Cause:** YAML syntax error or invalid schema.

**Solution:**

```bash
# Validate YAML syntax
cat .smartergpt/scope.yml | python -c 'import yaml, sys; yaml.safe_load(sys.stdin)'

# Check example
cat .smartergpt/scope.yml

# Expected format:
# target: main
# filters:
#   labels: ["ready-to-merge"]
#   exclude_labels: ["wip"]
```

### GitHub API Issues

#### Issue: `GitHub API Error: 401 Unauthorized`

**Cause:** Missing or invalid GitHub token.

**Solutions:**

```bash
# Set token via environment
export GITHUB_TOKEN=ghp_your_token_here
lex-pr discover

# Or via CLI
lex-pr init --github-token ghp_your_token_here

# Verify token has required scopes
# Minimum: repo (for private repos) or public_repo (for public repos)
```

#### Issue: `GitHub API Error: 403 Forbidden`

**Cause:** Rate limit exceeded or insufficient permissions.

**Solutions:**

```bash
# Check rate limit
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit

# Wait for rate limit reset or use authenticated requests
# Authenticated: 5000 req/hour
# Unauthenticated: 60 req/hour

# Verify token permissions
gh auth status
```

#### Issue: `GitHub API Error: 404 Not Found`

**Cause:** Repository doesn't exist or no access.

**Solutions:**

```bash
# Verify repository exists
gh repo view owner/repo

# Check token has access
gh api repos/owner/repo

# Verify owner and repo names
lex-pr discover --owner <owner> --repo <repo>
```

### Plan Generation Issues

#### Issue: `Unknown dependency: feature-b`

**Cause:** Dependency references non-existent item.

**Solution:**

```yaml
# In deps.yml or stack.yml
# Ensure dependency names match item names exactly

# ❌ Wrong
items:
  - name: feature-a
    deps: ["feature-B"]  # Case mismatch!

# ✅ Correct
items:
  - name: feature-a
    deps: ["feature-b"]  # Exact match
```

#### Issue: `Cycle detected in dependency graph`

**Cause:** Circular dependencies (A → B → A).

**Solution:**

```bash
# Visualize dependencies to find cycle
lex-pr plan --json | jq '.items[] | {name, deps}'

# Fix by removing circular reference
# Example cycle: auth → api → auth
# Break by removing one dependency
```

#### Issue: `No PRs found matching scope`

**Cause:** Scope filters too restrictive or no matching PRs.

**Solutions:**

```bash
# Check discovered PRs
lex-pr discover

# Relax scope.yml filters
# Before:
# filters:
#   labels: ["ready-to-merge", "approved"]
#   
# After:
# filters:
#   labels: ["ready-to-merge"]

# Or discover without filters
lex-pr discover --state open
```

### Gate Execution Issues

#### Issue: `Gate failed: npm test`

**Cause:** Tests failing in plan items.

**Debug Steps:**

```bash
# 1. Check gate output
cat gate-results/item-name/gate-name.json | jq '.meta'

# 2. View detailed logs
cat gate-results/item-name/gate-name.stderr.log

# 3. Run gate manually
cd /path/to/pr-branch
npm test

# 4. Check gate configuration
cat .smartergpt/gates.yml
```

#### Issue: `Gate timeout exceeded`

**Cause:** Gate command running longer than timeout.

**Solutions:**

```yaml
# Increase timeout in gates.yml
gates:
  - name: slow-test
    command: npm run integration-test
    timeout: 600  # 10 minutes instead of default 300

# Or via environment
export LEX_PR_TIMEOUT=600
lex-pr execute plan.json
```

#### Issue: `Gate execution failed: command not found`

**Cause:** Gate command not available in PATH.

**Solutions:**

```bash
# Use absolute paths
# gates.yml:
gates:
  - name: custom-check
    command: /usr/local/bin/custom-check

# Or relative to workspace
gates:
  - name: custom-check
    command: ./scripts/custom-check.sh

# Ensure script is executable
chmod +x ./scripts/custom-check.sh
```

### Merge Operation Issues

#### Issue: `Merge failed: Cannot fast-forward`

**Cause:** Merge conflicts or diverged branches.

**Solution:**

```bash
# Run with --dry-run first
lex-pr merge plan.json --dry-run

# Check conflict analysis
lex-pr merge plan.json --analyze

# Manual conflict resolution required
git checkout feature-branch
git merge main
# Resolve conflicts
git add .
git commit
```

#### Issue: `Merge blocked: Gates not passing`

**Cause:** Quality gates failed.

**Solution:**

```bash
# Check which gates failed
lex-pr report gate-results --out md

# Re-run specific gate
lex-pr execute plan.json --item feature-a --gate test

# Skip gates (not recommended for production)
lex-pr merge plan.json --skip-gates
```

#### Issue: `Dry-run only, use --execute to merge`

**Cause:** Default behavior is dry-run for safety.

**Solution:**

```bash
# This is expected! Dry-run is the default
lex-pr merge plan.json --dry-run

# To actually merge, use --execute
lex-pr merge plan.json --execute
```

## Debugging Techniques

### Enable Verbose Logging

```bash
# Set log level
export LOG_LEVEL=debug
lex-pr plan

# Or use --verbose flag (if available)
lex-pr plan --verbose
```

### Inspect Generated Plan

```bash
# Pretty-print plan
cat plan.json | jq '.'

# Check dependency graph
cat plan.json | jq '.items[] | {name, deps}'

# Verify merge order
lex-pr merge-order plan.json
```

### Validate Configuration

```bash
# Check schema validation
lex-pr schema validate plan.json

# Dump effective configuration
lex-pr doctor --json | jq '.'

# Verify profile resolution
lex-pr doctor | grep "using profile"
```

### Test Gates Manually

```bash
# Extract gate command
cat .smartergpt/gates.yml | grep -A 3 "name: test"

# Run in isolation
cd /path/to/pr-branch
npm test  # Or whatever the gate command is

# Check exit code
echo $?  # Should be 0 for success
```

### Analyze Gate Results

```bash
# List all gate results
ls -la gate-results/

# Check specific result
cat gate-results/feature-a/test.json | jq '.'

# View failure logs
cat gate-results/feature-a/test.stderr.log

# Aggregate results
lex-pr report gate-results --out md
```

## Advanced Troubleshooting

### Determinism Issues

**Symptom:** Same inputs producing different outputs.

**Debug:**

```bash
# Run twice and compare
lex-pr plan --out .artifacts1
lex-pr plan --out .artifacts2

# Byte-level comparison
diff -u .artifacts1/plan.json .artifacts2/plan.json

# Should be identical - if not, file a bug
cmp .artifacts1/plan.json .artifacts2/plan.json
```

### Performance Issues

**Symptom:** Slow gate execution or planning.

**Debug:**

```bash
# Profile plan generation
time lex-pr plan

# Check gate parallelism
export LEX_PR_MAX_WORKERS=4
lex-pr execute plan.json

# Monitor resource usage
top  # Check CPU/memory while running
```

### Profile Resolution Issues

**Symptom:** Wrong profile being used.

**Debug:**

```bash
# Check resolution order
lex-pr doctor

# Output shows:
# lex-pr-runner using profile: /path/to/profile (role: local)

# Verify files exist
ls -la .smartergpt.local/
ls -la .smartergpt/

# Check environment
env | grep LEX_PR
```

## Getting Help

### Self-Service Resources

1. **Documentation**: Check `docs/` directory
   - [Quickstart Guide](./quickstart.md)
   - [CLI Reference](./cli.md)
   - [Architecture Overview](./architecture.md)

2. **Examples**: Review `examples/` directory
   - GitHub integration examples
   - CI/CD pipeline examples

3. **Tests**: Look at test files for usage patterns
   - `tests/*.spec.ts`
   - `tests/integration-*.test.ts`

### Community Support

1. **GitHub Issues**: Search existing issues
   ```bash
   # Search issues
   gh issue list --search "error message"
   ```

2. **Discussions**: Check GitHub Discussions for Q&A

3. **Bug Reports**: File issues with:
   - Output of `lex-pr doctor`
   - Minimal reproduction steps
   - Expected vs actual behavior
   - Relevant logs/error messages

### Debug Information to Collect

When filing issues, include:

```bash
# 1. Version information
lex-pr --version
node --version
npm --version

# 2. Environment validation
lex-pr doctor

# 3. Configuration files
cat .smartergpt/scope.yml
cat .smartergpt/gates.yml
cat .smartergpt/profile.yml

# 4. Error output (sanitized)
lex-pr plan 2>&1 | tee error.log

# 5. Minimal reproduction
# Share smallest possible plan.json or config that reproduces issue
```

## Known Limitations

### Current Limitations

1. **GitHub Only**: Only supports GitHub (GitLab/Bitbucket coming)
2. **Local Execution**: No distributed/cloud execution
3. **Sequential Merges**: Merges execute sequentially (by design)
4. **No Auto-Conflict Resolution**: Manual intervention needed for conflicts

### Workarounds

1. **Other Git Hosts**: Use GitHub mirror or API adapters
2. **Remote Execution**: Use CI/CD runners (see [integrations](./integrations/))
3. **Parallel Merges**: Not supported (ensures dependency order)
4. **Conflict Resolution**: Use weave contract (see [weave-contract.md](./weave-contract.md))

## Related Documentation

- [CLI Reference](./cli.md) - Complete command documentation
- [Error Taxonomy](./errors.md) - Error codes and handling
- [Architecture Overview](./architecture.md) - System design
- [Migration Guide](./migration-guide.md) - Migrating from manual processes
