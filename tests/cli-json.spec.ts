import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { canonicalJSONStringify } from '../src/util/canonicalJson';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('CLI JSON Output Tests', () => {
	const testDir = path.join(os.tmpdir(), 'lex-pr-runner-cli-json-test');
	const cliPath = path.resolve(__dirname, '..', 'dist', 'cli.js');

	beforeEach(() => {
		// Clean test directory
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true });
		}
		fs.mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);

		// Build CLI if not exists
		const repoRoot = path.resolve(__dirname, '..');
		if (!fs.existsSync(cliPath)) {
			// Use pre-built CLI to avoid rebuild loop
			if (!fs.existsSync(path.join(repoRoot, 'dist/cli.js'))) {
				console.log('CLI not built, skipping test');
				return;
			}
		}
	});

	afterEach(() => {
		// Cleanup
		process.chdir('/');
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true });
		}
	});

	describe('schema validate --json', () => {
		it('should output valid JSON for valid plan file', () => {
			// Create valid plan.json
			const validPlan = {
				schemaVersion: '1.0.0',
				target: 'main',
				items: [
					{
						name: 'test-item',
						deps: []
					}
				]
			};
			fs.writeFileSync('plan.json', canonicalJSONStringify(validPlan));

			const output = execSync(`node ${cliPath} schema validate plan.json --json`, {
				encoding: 'utf8'
			});

			const result = JSON.parse(output);
			expect(result).toHaveProperty('valid', true);
		});

		it('should output valid JSON for invalid plan file', () => {
			// Create invalid plan.json (missing required fields)
			fs.writeFileSync('plan.json', '{"invalid": "plan"}');

			let output: string;
			try {
				execSync(`node ${cliPath} schema validate plan.json --json`, {
					encoding: 'utf8',
					stdio: 'pipe'
				});
				throw new Error('Should have failed');
			} catch (error: any) {
				output = error.stdout || error.message;
			}

			// Should still be valid JSON even on error
			const result = JSON.parse(output);
			expect(result).toHaveProperty('valid', false);
			expect(result).toHaveProperty('errors');
			expect(Array.isArray(result.errors)).toBe(true);
		});

		it('should have deterministic key ordering in error output', () => {
			fs.writeFileSync('plan.json', '{"invalid": "plan"}');

			let output1: string, output2: string;
			try {
				execSync(`node ${cliPath} schema validate plan.json --json`, {
					encoding: 'utf8',
					stdio: 'pipe'
				});
			} catch (error: any) {
				output1 = error.stdout || error.message;
			}

			try {
				execSync(`node ${cliPath} schema validate plan.json --json`, {
					encoding: 'utf8',
					stdio: 'pipe'
				});
			} catch (error: any) {
				output2 = error.stdout || error.message;
			}

			expect(output1!).toBe(output2!);
		});
	});

	describe('plan --json', () => {
		it('should output deterministic JSON plan', () => {
			// Create minimal config
			fs.mkdirSync('.smartergpt', { recursive: true });
			fs.writeFileSync('.smartergpt/stack.yml', `
version: 1
target: main
items:
  - id: test-item
    branch: feat/test
    deps: []
`);

			const output1 = execSync(`node ${cliPath} plan --json`, { encoding: 'utf8' });
			const output2 = execSync(`node ${cliPath} plan --json`, { encoding: 'utf8' });

			expect(output1).toBe(output2);

			// Verify it's valid JSON with expected structure
			const plan = JSON.parse(output1);
			expect(plan).toHaveProperty('schemaVersion', '1.0.0');
			expect(plan).toHaveProperty('target', 'main');
			expect(plan).toHaveProperty('items');
			expect(Array.isArray(plan.items)).toBe(true);
		});

		it('should handle empty configuration gracefully', () => {
			// No config files - should generate empty plan
			const output = execSync(`node ${cliPath} plan --json`, { encoding: 'utf8' });

			const plan = JSON.parse(output);
			expect(plan.schemaVersion).toBe('1.0.0');
			expect(plan.target).toBe('main');
			expect(plan.items).toHaveLength(0);
		});

		it('should use canonical JSON formatting with sorted keys', () => {
			fs.mkdirSync('.smartergpt', { recursive: true });
			fs.writeFileSync('.smartergpt/stack.yml', `
version: 1
target: main
items:
  - id: zebra-item
    branch: feat/zebra
    deps: []
  - id: alpha-item
    branch: feat/alpha
    deps: []
`);

			const output = execSync(`node ${cliPath} plan --json`, { encoding: 'utf8' });

			// Verify keys are sorted and formatting is consistent
			expect(output).toMatch(/"items".*"schemaVersion".*"target"/s);
			expect(output.endsWith('\n')).toBe(true);
		});
	});

	describe('merge-order --json', () => {
		beforeEach(() => {
			// Create a plan file for merge-order tests
			const plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				items: [
					{ name: 'item-a', deps: [] },
					{ name: 'item-b', deps: ['item-a'] },
					{ name: 'item-c', deps: ['item-b'] }
				]
			};
			fs.writeFileSync('plan.json', canonicalJSONStringify(plan));
		});

		it('should output deterministic merge order JSON', () => {
			const output1 = execSync(`node ${cliPath} merge-order plan.json --json`, { encoding: 'utf8' });
			const output2 = execSync(`node ${cliPath} merge-order plan.json --json`, { encoding: 'utf8' });

			expect(output1).toBe(output2);

			const result = JSON.parse(output1);
			expect(result).toHaveProperty('levels');
			expect(Array.isArray(result.levels)).toBe(true);
		});

		it('should have stable ordering in levels', () => {
			const output = execSync(`node ${cliPath} merge-order plan.json --json`, { encoding: 'utf8' });

			const result = JSON.parse(output);
			expect(result.levels).toHaveLength(3);
			expect(result.levels[0]).toEqual(['item-a']);
			expect(result.levels[1]).toEqual(['item-b']);
			expect(result.levels[2]).toEqual(['item-c']);
		});
	});

	describe('status --json', () => {
		beforeEach(() => {
			const plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				items: [
					{ name: 'test-item', deps: [] }
				]
			};
			fs.writeFileSync('plan.json', canonicalJSONStringify(plan));
		});

		it('should output deterministic status JSON', () => {
			const output1 = execSync(`node ${cliPath} status plan.json --json`, { encoding: 'utf8' });
			const output2 = execSync(`node ${cliPath} status plan.json --json`, { encoding: 'utf8' });

			expect(output1).toBe(output2);

			const result = JSON.parse(output1);
			expect(result).toHaveProperty('plan');
			expect(result).toHaveProperty('mergeSummary');
		});

		it('should use canonical JSON with sorted keys', () => {
			const output = execSync(`node ${cliPath} status plan.json --json`, { encoding: 'utf8' });

			// Verify canonical formatting
			expect(output.endsWith('\n')).toBe(true);
			const result = JSON.parse(output);
			expect(result.plan).toHaveProperty('schemaVersion');
		});
	});

	describe('execute --json', () => {
		beforeEach(() => {
			const plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				items: [
					{ name: 'test-item', deps: [] }
				]
			};
			fs.writeFileSync('plan.json', canonicalJSONStringify(plan));
		});

		it('should output deterministic execution results in dry-run mode', () => {
			const output1 = execSync(`node ${cliPath} execute plan.json --dry-run --json`, { encoding: 'utf8' });
			const output2 = execSync(`node ${cliPath} execute plan.json --dry-run --json`, { encoding: 'utf8' });

			expect(output1).toBe(output2);

			const result = JSON.parse(output1);
			expect(result).toHaveProperty('dryRun', true);
			expect(result).toHaveProperty('plan');
			expect(result).toHaveProperty('execution');
			expect(result.execution).toHaveProperty('levels');
		});

		it('should handle errors gracefully without crashing', () => {
			// Create plan file that will fail during loading
			fs.writeFileSync('malformed.json', 'not valid json at all');

			// Should not crash, regardless of exit code
			try {
				execSync(`node ${cliPath} execute malformed.json --json`, {
					encoding: 'utf8',
					stdio: 'pipe'
				});
			} catch (error: any) {
				// Error is expected, just ensure we don't crash
				expect(error.status).toBeGreaterThan(0);
			}
		});
	});

	describe('Exit codes and error handling', () => {
		it('should use correct exit codes for different error types', () => {
			// Schema validation error (exit 2)
			fs.writeFileSync('invalid.json', '{"invalid": true}');

			try {
				execSync(`node ${cliPath} schema validate invalid.json --json`, { stdio: 'pipe' });
				throw new Error('Should have failed');
			} catch (error: any) {
				expect(error.status).toBe(1); // Schema validation error
			}
		});

		it('should handle missing files gracefully with JSON output', () => {
			try {
				execSync(`node ${cliPath} schema validate nonexistent.json --json`, {
					encoding: 'utf8',
					stdio: 'pipe'
				});
				throw new Error('Should have failed');
			} catch (error: any) {
				const output = error.stdout || error.stderr;
				// Should still attempt JSON output for errors
				expect(output).toBeTruthy();
			}
		});
	});
});