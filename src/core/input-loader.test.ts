import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { CanonicalInputLoader } from './input-loader.js';

const TEST_DIR = '/tmp/test-smartergpt';

describe('CanonicalInputLoader', () => {
	let loader: CanonicalInputLoader;

	beforeEach(() => {
		// Clean up and create test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
		loader = new CanonicalInputLoader(TEST_DIR);
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	test('loads stack.yml with highest precedence', async () => {
		// Create stack.yml
		writeFileSync(join(TEST_DIR, 'stack.yml'), `
version: 1
target: develop
prs:
  - id: 1
    branch: feat/test
    needs: []
    strategy: rebase-weave
`);

		// Create scope.yml (should be ignored due to precedence)
		writeFileSync(join(TEST_DIR, 'scope.yml'), `
version: 1
target: main
sources: []
`);

		const plan = await loader.loadPlan();

		expect(plan.target).toBe('develop'); // From stack.yml, not scope.yml
		expect(plan.items).toHaveLength(1);
		expect(plan.items[0]).toEqual({
			id: 1,
			branch: 'feat/test',
			needs: [],
			strategy: 'rebase-weave'
		});
	});

	test('falls back to scope.yml + deps.yml when stack.yml missing', async () => {
		// Create scope.yml
		writeFileSync(join(TEST_DIR, 'scope.yml'), `
version: 1
target: staging
sources:
  - query: "is:open"
`);

		// Create deps.yml
		writeFileSync(join(TEST_DIR, 'deps.yml'), `
version: 1
depends_on: ["feat/base"]
`);

		const plan = await loader.loadPlan();

		expect(plan.target).toBe('staging');
		expect(plan.items).toEqual([]); // No GitHub API integration in this implementation
	});

	test('validates stack.yml schema and reports errors', async () => {
		// Create invalid stack.yml (missing required fields)
		writeFileSync(join(TEST_DIR, 'stack.yml'), `
version: 1
prs:
  - id: 1
    # missing branch field
`);

		await expect(loader.loadPlan()).rejects.toThrow(/Invalid stack.yml format/);
	});

	test('validates scope.yml schema and reports errors', async () => {
		// Create invalid scope.yml
		writeFileSync(join(TEST_DIR, 'scope.yml'), `
version: "invalid"
target: main
`);

		await expect(loader.loadPlan()).rejects.toThrow(/Invalid scope.yml format/);
	});

	test('handles YAML parsing errors', async () => {
		// Create invalid YAML
		writeFileSync(join(TEST_DIR, 'stack.yml'), `
version: 1
target: main
prs: [
  invalid yaml
`);

		await expect(loader.loadPlan()).rejects.toThrow(/Failed to parse stack.yml/);
	});

	test('returns empty plan when no configuration files exist', async () => {
		const plan = await loader.loadPlan();

		expect(plan).toEqual({
			target: 'main',
			items: []
		});
	});

	test('handles optional fields in stack.yml correctly', async () => {
		writeFileSync(join(TEST_DIR, 'stack.yml'), `
version: 1
target: main
prs:
  - id: 1
    branch: feat/minimal
  - id: 2
    branch: feat/complete
    sha: abc123
    needs: [1]
    strategy: merge-weave
`);

		const plan = await loader.loadPlan();

		expect(plan.items).toHaveLength(2);
		expect(plan.items[0]).toEqual({
			id: 1,
			branch: 'feat/minimal',
			needs: [],
			strategy: 'rebase-weave' // default
		});
		expect(plan.items[1]).toEqual({
			id: 2,
			branch: 'feat/complete',
			sha: 'abc123',
			needs: [1],
			strategy: 'merge-weave'
		});
	});

	test('ensures deterministic output with repeated calls', async () => {
		writeFileSync(join(TEST_DIR, 'stack.yml'), `
version: 1
target: main
prs:
  - id: 1
    branch: feat/test
    needs: []
`);

		const plan1 = await loader.loadPlan();
		const plan2 = await loader.loadPlan();

		expect(plan1).toEqual(plan2);
		expect(JSON.stringify(plan1)).toBe(JSON.stringify(plan2));
	});
});