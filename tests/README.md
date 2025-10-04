Short notes for test authors
===========================

Some tests in this repository change the process working directory (via `process.chdir`) and create temporary files/directories to simulate real workspaces. When running Vitest with parallel workers, multiple test files can run at the same time. If different test files use the same temp path they can collide: one test may remove the directory while another test is still using it, which leads to transient failures such as `getcwd() failed: No such file or directory` or ENOENT errors when creating artifacts.

To avoid this, follow the per-file temp directory pattern used across the test suite:

```ts
import * as os from 'os';
import * as path from 'path';

// Ensure the temp directory is unique per test file
const testDir = path.join(os.tmpdir(), `lex-pr-runner-determinism-test-${path.basename(__filename)}`);

// Create and switch into the directory
fs.mkdirSync(testDir, { recursive: true });
process.chdir(testDir);

// ... run tests that write files or call the CLI ...

// Cleanup in afterEach/afterAll
process.chdir('/');
fs.rmSync(testDir, { recursive: true });
```

Why this matters
-----------------
- Vitest may execute multiple worker processes; filesystem operations (mkdir/rm/chdir) are not atomic across processes on the same temp path.
- Using per-file unique temp paths makes tests deterministic and avoids flaky CI failures.

Best practices
--------------
- Prefer creating and removing any test directories inside beforeEach/afterEach to limit the window where collisions could occur.
- When possible, avoid relying on `process.cwd()` globally; prefer passing explicit cwd values to subprocesses or library calls.
- Keep tests hermetic: always clean up files you create.

If you add documentation elsewhere (e.g., CONTRIBUTING.md), include this guidance so future contributors don't reintroduce flaky tests.

Autopilot Level 3-4 E2E Tests
==============================

The `autopilot-e2e-level3-4.spec.ts` file contains comprehensive end-to-end tests for Autopilot Levels 3-4:

**Level 3 Test Coverage:**
- Integration branch creation and naming validation
- Multi-PR integration scenarios (sequential and parallel dependencies)
- Merge conflict detection and handling
- Gate execution on integration branches
- Integration branch lifecycle (create → merge → cleanup)
- Error handling and recovery testing
- Complex dependency graphs (diamond, deep chain, wide parallel)
- Performance testing for high-throughput execution

**Level 4 Test Coverage (Stub Tests):**
- PR cleanup and comment posting functionality (placeholders for when Level 4 is implemented)
- Integration branch finalization and deletion
- Custom comment templates

**Test Fixtures:**
- `fixtures/plan.integration-pyramid.json`: Multi-level dependency pyramid with foundation → features → integration
- `fixtures/plan.deep-chain.json`: 10-PR sequential dependency chain
- `fixtures/plan.wide-parallel.json`: 12 parallel PRs with no dependencies

**Running the tests:**
```bash
# Run all autopilot E2E tests
npm test -- autopilot-e2e-level3-4.spec.ts

# Run specific test suites
npm test -- autopilot-e2e-level3-4.spec.ts -t "Integration Branch Workflows"
npm test -- autopilot-e2e-level3-4.spec.ts -t "Gate Execution"
npm test -- autopilot-e2e-level3-4.spec.ts -t "Complex Dependency Graphs"
```

**Key Design Decisions:**
- Tests create real git repositories in temp directories for authentic integration testing
- All tests are deterministic and avoid timing dependencies
- Level 4 tests are stubs documenting expected behavior for when the implementation is complete
- Fixtures provide realistic PR graph patterns for validation
