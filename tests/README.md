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
