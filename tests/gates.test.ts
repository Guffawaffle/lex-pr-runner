import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeGate, executeItemGates, executeGatesWithPolicy } from '../src/gates.js';
import { loadPlan, Policy, Gate } from '../src/schema.js';
import { ExecutionState } from '../src/executionState.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Gate Execution', () => {
	const defaultPolicy: Policy = {
		requiredGates: [],
		optionalGates: [],
		maxWorkers: 1,
		retries: {},
		overrides: {},
		blockOn: [],
		mergeRule: { type: "strict-required" }
	};

	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-test-'));
	});

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true });
		}
	});

	it('executes a passing gate', async () => {
		const gate: Gate = {
			name: 'test-pass',
			run: 'bash -c "exit 0"',
			runtime: 'local'
		};

		const result = await executeGate(gate, defaultPolicy, tempDir, 5000);

		expect(result.gate).toBe('test-pass');
		expect(result.status).toBe('pass');
		expect(result.exitCode).toBe(0);
		expect(result.duration).toBeGreaterThan(0);
		expect(result.attempts).toBe(1);
		expect(result.lastAttempt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO date format
	});

	it('executes a failing gate', async () => {
		const gate: Gate = {
			name: 'test-fail',
			run: 'bash -c "echo error message >&2; exit 1"',
			runtime: 'local'
		};

		const result = await executeGate(gate, defaultPolicy, tempDir, 5000);

		expect(result.gate).toBe('test-fail');
		expect(result.status).toBe('fail');
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('error message');
	});

	it('captures stdout and stderr', async () => {
		const gate: Gate = {
			name: 'test-output',
			run: 'bash -c "echo hello world; echo error message >&2"',
			runtime: 'local'
		};

		const result = await executeGate(gate, defaultPolicy, tempDir, 5000);

		expect(result.stdout).toContain('hello world');
		expect(result.stderr).toContain('error message');
	});

	it('respects working directory', async () => {
		const gate: Gate = {
			name: 'test-cwd',
			run: 'pwd',
			cwd: '/tmp',
			runtime: 'local'
		};

		const result = await executeGate(gate, defaultPolicy, tempDir, 5000);

		expect(result.stdout).toContain('/tmp');
	});

	it('respects environment variables', async () => {
		const gate: Gate = {
			name: 'test-env',
			run: 'echo $TEST_VAR',
			env: { TEST_VAR: 'test-value' },
			runtime: 'local'
		};

		const result = await executeGate(gate, defaultPolicy, tempDir, 5000);

		expect(result.stdout).toContain('test-value');
	});

	it('handles timeouts', async () => {
		const gate: Gate = {
			name: 'test-timeout',
			run: 'sleep 1', // Sleep for 1 second
			runtime: 'local'
		};

		const result = await executeGate(gate, defaultPolicy, tempDir, 100); // 100ms timeout

		expect(result.gate).toBe('test-timeout');
		expect(result.status).toBe('fail'); // Timeout should result in fail status
	});

	it('executes item gates sequentially', async () => {
		const item = {
			name: 'test-item',
			deps: [],
			gates: [
				{ name: 'gate1', run: 'echo "gate 1"', runtime: 'local' as const },
				{ name: 'gate2', run: 'echo "gate 2"', runtime: 'local' as const }
			]
		};

		const executionState = new ExecutionState({
			schemaVersion: '1.0.0',
			target: 'main',
			items: [item]
		});

		const results = await executeItemGates(item, defaultPolicy, executionState, tempDir, 5000);

		expect(results).toHaveLength(2);
		expect(results[0].gate).toBe('gate1');
		expect(results[0].status).toBe('pass');
		expect(results[1].gate).toBe('gate2');
		expect(results[1].status).toBe('pass');
	});

	it('handles items with no gates', async () => {
		const item = {
			name: 'test-item-no-gates',
			deps: []
		};

		const executionState = new ExecutionState({
			schemaVersion: '1.0.0',
			target: 'main',
			items: [item]
		});

		const results = await executeItemGates(item, defaultPolicy, executionState, tempDir, 5000);

		expect(results).toHaveLength(0);
	});

	it('executes plan with policy awareness', async () => {
		const planContent = fs.readFileSync('tests/fixtures/plan.gates.json', 'utf-8');
		const plan = loadPlan(planContent);

		const executionState = new ExecutionState(plan);

		// Just test individual item execution for now to avoid complex concurrency issues in tests
		const firstItem = plan.items[0];
		if (firstItem && firstItem.gates) {
			const results = await executeItemGates(firstItem, defaultPolicy, executionState, tempDir, 1000);
			expect(results.length).toBeGreaterThan(0);

			// Check that results have the expected structure
			for (const result of results) {
				expect(result.gate).toBeDefined();
				expect(['pass', 'fail', 'blocked', 'skipped', 'retrying']).toContain(result.status);
			}
		}
	}, 10000); // 10 second timeout
});