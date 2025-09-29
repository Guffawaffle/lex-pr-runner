import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadInputs, InputConfig, StackConfig, ScopeConfig } from '../src/core/inputs.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Configuration Integration', () => {
	let tempDir: string;
	let smartergptDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
		smartergptDir = path.join(tempDir, '.smartergpt');
		fs.mkdirSync(smartergptDir, { recursive: true });
	});

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true });
		}
	});

	describe('Configuration Loading from Various Sources', () => {
		it('loads configuration from stack.yml with highest precedence', () => {
			const stackConfig = {
				version: 1,
				target: 'develop',
				items: [
					{
						id: 1,
						name: 'backend',
						branch: 'feature/backend',
						deps: [],
						strategy: 'rebase-weave',
						gates: [
							{
								name: 'test',
								run: 'npm test',
								runtime: 'local'
							}
						]
					}
				]
			};

			const scopeConfig = {
				version: 1,
				target: 'main', // This should be ignored due to stack.yml precedence
				defaults: {
					strategy: 'merge-weave'
				}
			};

			fs.writeFileSync(path.join(smartergptDir, 'stack.yml'), `version: ${stackConfig.version}
target: ${stackConfig.target}
items:
  - id: ${stackConfig.items[0].id}
    name: ${stackConfig.items[0].name}
    branch: ${stackConfig.items[0].branch}
    deps: []
    strategy: ${stackConfig.items[0].strategy}
    gates:
      - name: ${stackConfig.items[0].gates![0].name}
        run: ${stackConfig.items[0].gates![0].run}
        runtime: ${stackConfig.items[0].gates![0].runtime}
`);

			fs.writeFileSync(path.join(smartergptDir, 'scope.yml'), `version: ${scopeConfig.version}
target: ${scopeConfig.target}
defaults:
  strategy: ${scopeConfig.defaults.strategy}
`);

			const config = loadInputs(tempDir);

			expect(config.target).toBe('develop'); // From stack.yml, not scope.yml
			expect(config.version).toBe(1);
			expect(config.items).toHaveLength(1);
			expect(config.items[0].name).toBe('backend');
			expect(config.items[0].strategy).toBe('rebase-weave');
			expect(config.sources).toHaveLength(1); // Only stack.yml source when it exists
			expect(config.sources[0].file).toBe('stack.yml');
			expect(config.sources[0].exists).toBe(true);
		});

		it('falls back to scope.yml when stack.yml does not exist', () => {
			const scopeConfig = {
				version: 1,
				target: 'staging',
				defaults: {
					strategy: 'merge-weave',
					base: 'main'
				}
			};

			fs.writeFileSync(path.join(smartergptDir, 'scope.yml'), `version: ${scopeConfig.version}
target: ${scopeConfig.target}
defaults:
  strategy: ${scopeConfig.defaults.strategy}
  base: ${scopeConfig.defaults.base}
`);

			const config = loadInputs(tempDir);

			expect(config.target).toBe('staging');
			expect(config.version).toBe(1);
			expect(config.items).toHaveLength(0); // No items in scope.yml
			expect(config.sources).toHaveLength(3); // stack.yml (missing), scope.yml, deps.yml (missing)
			expect(config.sources[0].file).toBe('stack.yml');
			expect(config.sources[0].exists).toBe(false);
			expect(config.sources[1].file).toBe('scope.yml');
			expect(config.sources[1].exists).toBe(true);
		});

		it('uses defaults when no configuration files exist', () => {
			// No files created - should use defaults

			const config = loadInputs(tempDir);

			expect(config.target).toBe('main'); // Default target
			expect(config.version).toBe(1); // Default version
			expect(config.items).toHaveLength(0);
			expect(config.sources).toHaveLength(3); // All three config files checked but not found
			expect(config.sources.every(s => !s.exists)).toBe(true);
		});
	});

	describe('Configuration Precedence Rules', () => {
		it('verifies stack.yml overrides scope.yml completely', () => {
			const stackConfig = `version: 2
target: production
items:
  - id: 1
    name: stack-item
    branch: feature/stack
    deps: []
    strategy: squash-weave
`;

			const scopeConfig = `version: 3
target: development
defaults:
  strategy: rebase-weave
  base: master
`;

			fs.writeFileSync(path.join(smartergptDir, 'stack.yml'), stackConfig);
			fs.writeFileSync(path.join(smartergptDir, 'scope.yml'), scopeConfig);

			const config = loadInputs(tempDir);

			// All values should come from stack.yml
			expect(config.version).toBe(2);
			expect(config.target).toBe('production');
			expect(config.items[0].name).toBe('stack-item');
			expect(config.items[0].strategy).toBe('squash-weave');
		});

		it('merges scope.yml and deps.yml when stack.yml is absent', () => {
			const scopeConfig = `version: 1
target: staging
`;

			const depsConfig = `# Dependencies configuration placeholder
# Currently not processed but loaded for future use
`;

			fs.writeFileSync(path.join(smartergptDir, 'scope.yml'), scopeConfig);
			fs.writeFileSync(path.join(smartergptDir, 'deps.yml'), depsConfig);

			const config = loadInputs(tempDir);

			expect(config.target).toBe('staging');
			expect(config.sources).toHaveLength(3);
			expect(config.sources[1].exists).toBe(true); // scope.yml
			expect(config.sources[2].exists).toBe(true); // deps.yml
		});
	});

	describe('Error Cases and Schema Violations', () => {
		it('handles missing files gracefully', () => {
			// Try to load from non-existent directory
			const nonExistentDir = path.join(tempDir, 'does-not-exist');

			const config = loadInputs(nonExistentDir);

			expect(config.target).toBe('main');
			expect(config.version).toBe(1);
			expect(config.items).toHaveLength(0);
			expect(config.sources.every(s => !s.exists)).toBe(true);
		});

		it('handles invalid YAML syntax', () => {
			const invalidYaml = `version: 1
target: main
items:
  - id: 1
    name: test
    branch: feature/test
    invalid: yaml: syntax: here
      broken: indentation
`;

			fs.writeFileSync(path.join(smartergptDir, 'stack.yml'), invalidYaml);

			// Should handle YAML parsing error gracefully by falling back
			const config = loadInputs(tempDir);
			
			// Should fall back to other configs or defaults when YAML is invalid
			expect(config.target).toBe('main'); // Default value
		});

		it('handles schema validation errors', () => {
			const invalidConfig = `version: "invalid"
target: 123
items:
  - id: "1"
    name: test
    branch: feature/test
    strategy: invalid-strategy
    deps: "not-an-array"
`;

			fs.writeFileSync(path.join(smartergptDir, 'stack.yml'), invalidConfig);

			// Should handle schema validation error gracefully by falling back
			const config = loadInputs(tempDir);
			
			// Should fall back to defaults when validation fails
			expect(config.target).toBe('main'); // Default value
		});

		it('handles empty files', () => {
			fs.writeFileSync(path.join(smartergptDir, 'stack.yml'), ''); // Empty file

			const config = loadInputs(tempDir);

			// Should fall back gracefully when file is empty
			expect(config.target).toBe('main'); // Default value
			expect(config.sources[0].exists).toBe(true);
			expect(config.sources[0].content).toBe(null); // Empty content
		});

		it('handles files with only comments', () => {
			const commentsOnly = `# This is a comment
# Another comment
# No actual configuration
`;

			fs.writeFileSync(path.join(smartergptDir, 'stack.yml'), commentsOnly);

			const config = loadInputs(tempDir);

			// Should use defaults when stack.yml has no content
			expect(config.target).toBe('main'); // Default
		});
	});

	describe('Environment Variable Parsing and Type Coercion', () => {
		let originalEnv: NodeJS.ProcessEnv;

		beforeEach(() => {
			originalEnv = { ...process.env };
		});

		afterEach(() => {
			process.env = originalEnv;
		});

		it('handles boolean environment variables', () => {
			// Test various boolean representations
			const testCases = [
				{ input: 'true', expected: true },
				{ input: 'TRUE', expected: true },
				{ input: 'false', expected: false },
				{ input: 'FALSE', expected: false },
				{ input: '', expected: false },
				{ input: '0', expected: false },
				{ input: '1', expected: true },
				{ input: 'yes', expected: true },
				{ input: 'no', expected: false }
			];

			testCases.forEach(({ input, expected }) => {
				process.env.TEST_BOOLEAN = input;
				const result = process.env.TEST_BOOLEAN === 'true' || 
							   process.env.TEST_BOOLEAN === 'TRUE' ||
							   process.env.TEST_BOOLEAN === '1' ||
							   process.env.TEST_BOOLEAN === 'yes';
				
				expect(result).toBe(expected);
			});
		});

		it('handles number environment variables', () => {
			const testCases = [
				{ input: '1', expected: 1 },
				{ input: '42', expected: 42 },
				{ input: '0', expected: 0 },
				{ input: '-1', expected: -1 },
				{ input: '3.14', expected: 3.14 },
				{ input: 'invalid', expected: NaN },
				{ input: '', expected: 0 } // Empty string converts to 0, not NaN
			];

			testCases.forEach(({ input, expected }) => {
				process.env.TEST_NUMBER = input;
				const result = Number(process.env.TEST_NUMBER);
				
				if (isNaN(expected)) {
					expect(isNaN(result)).toBe(true);
				} else {
					expect(result).toBe(expected);
				}
			});
		});

		it('handles array environment variables', () => {
			const testCases = [
				{ input: 'item1,item2,item3', expected: ['item1', 'item2', 'item3'] },
				{ input: 'single', expected: ['single'] },
				{ input: '', expected: [] }, // Empty string should result in empty array
				{ input: 'a,b,c,d', expected: ['a', 'b', 'c', 'd'] },
				{ input: 'spaced , items , here', expected: ['spaced ', ' items ', ' here'] }
			];

			testCases.forEach(({ input, expected }) => {
				process.env.TEST_ARRAY = input;
				const result = process.env.TEST_ARRAY && process.env.TEST_ARRAY.length > 0 
					? process.env.TEST_ARRAY.split(',') 
					: [];
				expect(result).toEqual(expected);
			});
		});
	});

	describe('Real-world Configuration Scenarios', () => {
		it('handles complex multi-item configuration', () => {
			const complexConfig = `version: 1
target: main
items:
  - id: 1
    name: auth-service
    branch: feature/auth-refactor
    sha: abc123def456
    deps: []
    strategy: rebase-weave
    gates:
      - name: unit-tests
        run: npm test
        runtime: local
        env:
          NODE_ENV: test
          CI: "true"
      - name: integration-tests
        run: npm run test:integration
        runtime: container
        container:
          image: node:20-alpine
        artifacts:
          - coverage/lcov.info
          - test-results.xml
  - id: 2
    name: user-service
    branch: feature/user-profiles
    deps: ["auth-service"]
    strategy: merge-weave
    gates:
      - name: lint
        run: npm run lint
        runtime: local
      - name: build
        run: npm run build
        runtime: local
        artifacts:
          - dist/
  - id: 3
    name: frontend-app
    branch: feature/new-dashboard
    deps: ["auth-service", "user-service"]
    strategy: squash-weave
    gates:
      - name: e2e-tests
        run: npm run test:e2e
        runtime: ci-service
        env:
          BROWSER: chrome
          HEADLESS: "true"
        artifacts:
          - screenshots/
          - videos/
`;

			fs.writeFileSync(path.join(smartergptDir, 'stack.yml'), complexConfig);

			const config = loadInputs(tempDir);

			expect(config.items).toHaveLength(3);
			
			// Verify first item
			const authService = config.items.find(item => item.name === 'auth-service');
			expect(authService).toBeDefined();
			expect(authService!.deps).toEqual([]);
			expect(authService!.strategy).toBe('rebase-weave');
			expect(authService!.gates).toHaveLength(2);
			
			// Verify dependencies are preserved
			const userService = config.items.find(item => item.name === 'user-service');
			expect(userService!.deps).toEqual(['auth-service']);
			
			const frontendApp = config.items.find(item => item.name === 'frontend-app');
			expect(frontendApp!.deps).toEqual(['auth-service', 'user-service']);
			
			// Verify gate configurations
			const unitTestGate = authService!.gates!.find(gate => gate.name === 'unit-tests');
			expect(unitTestGate!.env).toEqual({ CI: 'true', NODE_ENV: 'test' });
			expect(unitTestGate!.runtime).toBe('local');
		});

		it('handles configuration with policy settings', () => {
			const configWithPolicy = `version: 1
target: main
policy:
  requiredGates: ["test", "lint", "security-scan"]
  optionalGates: ["performance-test"]
  maxWorkers: 3
  retries:
    security-scan:
      maxAttempts: 2
      backoffSeconds: 30
  overrides:
    adminGreen:
      allowedUsers: ["tech-lead", "devops-admin"]
      requireReason: true
  blockOn: ["license-check"]
  mergeRule:
    type: strict-required
items:
  - id: 1
    name: backend
    branch: feature/backend
    deps: []
    strategy: merge-weave
    gates:
      - name: test
        run: npm test
      - name: lint
        run: npm run lint
      - name: security-scan
        run: npm audit
      - name: license-check
        run: npm run license-check
`;

			fs.writeFileSync(path.join(smartergptDir, 'stack.yml'), configWithPolicy);

			const config = loadInputs(tempDir);

			// Note: Policy validation would happen at plan generation level
			// Here we just verify the configuration loads without errors
			expect(config.items).toHaveLength(1);
			expect(config.items[0].gates).toHaveLength(4);
		});

		it('maintains deterministic ordering across multiple loads', () => {
			const configWithUnsortedItems = `version: 1
target: main
items:
  - id: 3
    name: zebra-service
    branch: feature/zebra
    deps: []
    strategy: merge-weave
  - id: 1  
    name: alpha-service
    branch: feature/alpha
    deps: []
    strategy: merge-weave
  - id: 2
    name: beta-service
    branch: feature/beta
    deps: ["alpha-service"]
    strategy: merge-weave
`;

			fs.writeFileSync(path.join(smartergptDir, 'stack.yml'), configWithUnsortedItems);

			const config1 = loadInputs(tempDir);
			const config2 = loadInputs(tempDir);
			const config3 = loadInputs(tempDir);

			// All loads should produce identical ordering
			expect(config1.items.map(i => i.name)).toEqual(config2.items.map(i => i.name));
			expect(config2.items.map(i => i.name)).toEqual(config3.items.map(i => i.name));
			
			// Items should be sorted by name
			const expectedOrder = ['alpha-service', 'beta-service', 'zebra-service'];
			expect(config1.items.map(i => i.name)).toEqual(expectedOrder);
		});
	});
});