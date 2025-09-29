# CLI & MCP Planning (lex-pr-runner)

## Node.js Toolchain Pinning Policy

This document establishes the **deterministic toolchain requirements** for lex-pr-runner, supporting the Weave v0.2 contract's toolchain alignment prerequisite.

### Pinning Strategy

To ensure **lockfile stability** and **reproducible builds** between local and CI environments, lex-pr-runner implements a dual-pinning approach:

#### 1. Package.json Engines (Primary)
```json
{
  "engines": {
    "node": "20.19.5",
    "npm": "10.8.2"
  },
  "packageManager": "npm@10.8.2"
}
```

#### 2. Node Version File (Secondary)
- **`.nvmrc`**: Contains exact Node.js version for nvm/fnm users
- **Format**: `20.19.5` (single line, no prefix)

#### 3. CI Alignment
- All CI workflows must use the exact versions specified above
- Docker images, GitHub Actions, and other environments must match these pins

### Doctor Verification (Pre-Lockfile Gate)

The `lex-pr doctor` command **must enforce toolchain alignment** before any lockfile regeneration operations.

#### Required Checks

1. **Node.js Version Match**
   ```bash
   # Must match package.json engines.node exactly
   node --version === "v20.19.5"
   ```

2. **npm Version Match**
   ```bash
   # Must match package.json engines.npm exactly  
   npm --version === "10.8.2"
   ```

3. **Package Manager Consistency**
   ```bash
   # Must match package.json packageManager field
   npm --version === packageManager field
   ```

#### Failure Behavior

**Doctor must fail** (exit code ≠ 0) if any toolchain mismatch is detected before:
- `npm install` operations that modify `package-lock.json`
- Dependency updates or lockfile regeneration
- Any weave operations involving lockfile changes

#### Success Requirements

Doctor passes only when:
- ✓ Local Node.js version exactly matches `engines.node`
- ✓ Local npm version exactly matches `engines.npm` 
- ✓ `package-lock.json` exists and is consistent with current toolchain
- ✓ No pending lockfile changes that would be affected by version drift

### Integration with Weave Contract

This toolchain pinning supports Weave v0.2 contract requirements:

- **Lockfile stability**: Prevents version drift between environments
- **Mechanical weave safety**: Lockfile conflicts resolve deterministically 
- **Rollback reliability**: Determinism check remains stable across toolchain differences
- **Pre-regeneration gate**: Doctor verification prevents cross-version lockfile corruption

### Migration and Adoption

#### For New Repositories
1. Copy `.nvmrc` from lex-pr-runner
2. Set `package.json` engines to match `.nvmrc` 
3. Add `packageManager` field matching npm version
4. Configure CI to use pinned versions
5. Run `lex-pr doctor` before any lockfile operations

#### For Existing Repositories  
1. Audit current toolchain versions across team and CI
2. Choose LTS Node.js version supported by all environments
3. Update all environments to match chosen versions
4. Add pinning files and update CI configurations
5. Test lockfile regeneration with `lex-pr doctor` verification

### Maintenance

- **LTS Alignment**: Update pins only during major LTS transitions
- **Security Updates**: Exception process for critical Node.js security patches
- **Team Coordination**: All team members must update local environments when pins change
- **CI Synchronization**: Verify all CI environments reflect pin updates

---

**Enforcement**: This policy is enforced by the `lex-pr doctor` command and must pass before any lockfile-modifying operations.