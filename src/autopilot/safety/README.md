# Safety Framework

The Safety Framework provides comprehensive safety mechanisms for autopilot operations in lex-pr-runner.

## Features

### 1. TTY Confirmation Prompts

Interactive confirmation for destructive operations with clear operation summaries:

```typescript
import { SafetyFramework } from './autopilot/safety';

const safety = new SafetyFramework(githubAPI);

const summary = {
  autopilotLevel: 3,
  mergeOperations: [
    { type: 'create-branch', description: 'Create branch: merge-weave/20251002-153045' },
    { type: 'merge', description: 'Merge PR-123 → integration branch', prNumber: 123 },
    { type: 'push', description: 'Push integration branch to origin' },
  ],
  prOperations: [
    { type: 'open-pr', description: 'Open integration PR targeting main', target: 'main' },
    { type: 'add-comment', description: 'Add status comment to PR-123', prNumber: 123 },
  ],
  affectedPRs: [123],
};

const result = await safety.confirmOperation(summary);
if (!result.confirmed) {
  console.log('Operation cancelled');
  process.exit(0);
}
```

**Output (in TTY):**
```
⚠️  Autopilot Level 3 will perform these operations:

🔀 Merge Operations:
  • Create branch: merge-weave/20251002-153045
  • Merge PR-123 → integration branch
  • Push integration branch to origin

🔧 PR Operations:
  • Open integration PR targeting main
  • Add status comment to PR-123

❓ Continue? [y/N/details]:
```

**CI Behavior:** Automatically confirms in non-TTY environments (CI), but always respects abort signals.

### 2. Advisory Lock Labels

Prevent concurrent weave operations with timestamped labels:

```typescript
const timestamp = '20251002-153045';

// Check for existing locks
const existingLocks = await safety.checkExistingLocks([123, 456]);
if (existingLocks.length > 0) {
  console.error('Another weave operation is in progress');
  process.exit(1);
}

// Apply locks before starting
await safety.applyAdvisoryLock([123, 456], timestamp);

try {
  // Perform weave operations...
} finally {
  // Clean up locks
  await safety.removeAdvisoryLocks([123, 456], timestamp);
}
```

Labels created: `lex-pr:weaving-20251002-153045`

### 3. Containment Checks

Validate PR reachability, merge conflicts, and external dependencies:

```typescript
const containmentCheck = await safety.performContainmentChecks([123, 456], 'main');
const validation = safety.validateContainment(containmentCheck);

if (!validation.valid) {
  console.error('Containment check failed:');
  validation.errors.forEach(err => console.error(`  • ${err}`));
  process.exit(1);
}
```

**Checks performed:**
- ✅ All PRs are reachable via GitHub API
- ✅ PRs target the expected base branch
- ✅ No merge conflicts detected
- ✅ No external dependencies outside the plan

### 4. Kill Switch

Handle graceful shutdown via signals or programmatic abort:

```typescript
const safety = new SafetyFramework(githubAPI);

// Install signal handlers for SIGINT, SIGTERM
safety.installKillSwitch();

// Programmatic abort (e.g., from --abort flag)
if (opts.abort) {
  safety.requestAbort();
}

// Check before operations
if (safety.isAbortRequested()) {
  console.log('Operation aborted');
  process.exit(130);
}
```

### 5. Rollback Procedures

Automatic rollback on failure with PR marking:

```typescript
try {
  // Perform weave operations...
} catch (error) {
  const rollbackResult = await safety.rollback(
    lastCommitSha,
    affectedPRs,
    'Gates failed: test suite returned non-zero exit code'
  );

  if (rollbackResult.success) {
    console.log(`Rolled back to: ${rollbackResult.revertCommit}`);
    console.log(`Marked PRs as needs-manual-weave: ${rollbackResult.affectedPRs.join(', ')}`);
  } else {
    console.error(`Rollback failed: ${rollbackResult.error}`);
  }
}
```

**Rollback actions:**
- Create revert commit
- Mark affected PRs with `needs-manual-weave` label
- Log rollback reason and affected PRs

### 6. Audit Trail

All safety decisions are logged for audit purposes:

```typescript
safety.logSafetyDecision('containment-check', 'passed', {
  prNumbers: [123, 456],
  targetBranch: 'main',
});

safety.logSafetyDecision('confirmation', 'user-approved', {
  autopilotLevel: 3,
  operationCount: 5,
});

safety.logSafetyDecision('rollback', 'executed', {
  reason: 'gate-failure',
  revertCommit: 'abc123',
});
```

**Log format:**
```json
[SAFETY-LOG] {"timestamp":"2025-10-02T15:30:45.123Z","operation":"containment-check","decision":"passed","prNumbers":[123,456],"targetBranch":"main"}
```

## Complete Example

Full safety workflow for autopilot operations:

```typescript
import { SafetyFramework } from './autopilot/safety';
import { createGitHubAPI } from './github/api';

async function runAutopilotMerge(prNumbers: number[], targetBranch: string) {
  const githubAPI = await createGitHubAPI();
  if (!githubAPI) {
    throw new Error('GitHub API not available');
  }

  const safety = new SafetyFramework(githubAPI);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // Install kill switch
  safety.installKillSwitch();

  try {
    // Step 1: Check for existing locks
    const existingLocks = await safety.checkExistingLocks(prNumbers);
    if (existingLocks.length > 0) {
      console.error('❌ Another weave operation is in progress');
      safety.logSafetyDecision('preflight', 'blocked', { reason: 'existing-locks' });
      process.exit(1);
    }

    // Step 2: Perform containment checks
    const containmentCheck = await safety.performContainmentChecks(prNumbers, targetBranch);
    const validation = safety.validateContainment(containmentCheck);

    if (!validation.valid) {
      console.error('❌ Containment check failed:');
      validation.errors.forEach(err => console.error(`  • ${err}`));
      safety.logSafetyDecision('containment-check', 'failed', { errors: validation.errors });
      process.exit(1);
    }

    safety.logSafetyDecision('containment-check', 'passed', { prNumbers, targetBranch });

    // Step 3: Apply advisory locks
    await safety.applyAdvisoryLock(prNumbers, timestamp);
    safety.logSafetyDecision('advisory-lock', 'applied', { prNumbers, timestamp });

    // Step 4: Get user confirmation
    const summary = {
      autopilotLevel: 3,
      mergeOperations: [
        { type: 'create-branch', description: `Create branch: merge-weave/${timestamp}` },
        ...prNumbers.map(pr => ({
          type: 'merge' as const,
          description: `Merge PR-${pr} → integration branch`,
          prNumber: pr,
        })),
        { type: 'push', description: 'Push integration branch to origin' },
      ],
      prOperations: [
        { type: 'open-pr', description: 'Open integration PR targeting ' + targetBranch, target: targetBranch },
      ],
      affectedPRs: prNumbers,
    };

    const confirmResult = await safety.confirmOperation(summary);
    if (!confirmResult.confirmed) {
      safety.logSafetyDecision('confirmation', confirmResult.aborted ? 'aborted' : 'declined');
      await safety.removeAdvisoryLocks(prNumbers, timestamp);
      process.exit(0);
    }

    safety.logSafetyDecision('confirmation', 'approved', { autopilotLevel: 3 });

    // Step 5: Perform merge operations
    console.log('🚀 Starting merge operations...');
    const mergeCommit = await performMergeOperations(prNumbers, targetBranch);

    // Step 6: Run gates
    console.log('🔍 Running gates...');
    const gatesResult = await runGates();

    if (!gatesResult.passed) {
      console.error('❌ Gates failed, rolling back...');
      const rollbackResult = await safety.rollback(
        mergeCommit,
        prNumbers,
        'Gates failed: ' + gatesResult.failureReason
      );

      safety.logSafetyDecision('rollback', 'executed', {
        reason: gatesResult.failureReason,
        revertCommit: rollbackResult.revertCommit,
      });

      await safety.removeAdvisoryLocks(prNumbers, timestamp);
      process.exit(1);
    }

    // Step 7: Success - clean up locks
    await safety.removeAdvisoryLocks(prNumbers, timestamp);
    safety.logSafetyDecision('merge', 'completed', { prNumbers, mergeCommit });

    console.log('✅ Merge completed successfully');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    await safety.removeAdvisoryLocks(prNumbers, timestamp);
    safety.logSafetyDecision('merge', 'error', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Helper functions (implement based on your needs)
async function performMergeOperations(prNumbers: number[], targetBranch: string): Promise<string> {
  // Implement merge logic
  return 'commit-sha';
}

async function runGates(): Promise<{ passed: boolean; failureReason?: string }> {
  // Implement gate execution
  return { passed: true };
}
```

## Error Handling

The Safety Framework provides clear error messages for common scenarios:

### GitHub API Not Available
```typescript
const safety = new SafetyFramework(); // No GitHub API

await safety.applyAdvisoryLock([123], timestamp);
// Error: GitHub API not available for advisory locks
```

### Unreachable PRs
```typescript
const check = await safety.performContainmentChecks([999], 'main');
// check.unreachablePRs: [999]
// check.allPRsReachable: false
```

### Merge Conflicts
```typescript
const check = await safety.performContainmentChecks([123], 'main');
// check.hasMergeConflicts: true
// check.conflictingPRs: [123]
```

### External Dependencies
```typescript
const check = await safety.performContainmentChecks([123], 'main');
// check.hasExternalDeps: true
// check.externalDeps: ["PR #123 targets develop, not main"]
```

## Design Principles

1. **Fail-safe defaults**: Require explicit confirmation for destructive operations
2. **Graceful degradation**: Skip prompts in CI, but always respect abort signals
3. **Clear communication**: Provide detailed operation summaries and error messages
4. **Audit trail**: Log all safety decisions for troubleshooting and compliance
5. **Idempotent operations**: Safe to retry lock removal and other operations
6. **Minimal dependencies**: Only requires GitHub API for label operations

## Testing

The Safety Framework includes comprehensive test coverage:

- **Unit tests** (`tests/safety-framework.spec.ts`): 26 tests covering all methods
- **Integration tests** (`tests/safety-integration.spec.ts`): 11 tests for end-to-end workflows

Run tests:
```bash
npm test -- tests/safety-framework.spec.ts tests/safety-integration.spec.ts
```

## Future Enhancements

Potential improvements for future versions:

- [ ] Distributed lock coordination (Redis/etcd) for multi-runner scenarios
- [ ] Webhook notifications for long-running operations
- [ ] Configurable timeout for user confirmation
- [ ] Integration with SARIF for security gate results
- [ ] Checkpoint/resume support for interrupted operations
- [ ] Dry-run mode for testing safety checks without execution
