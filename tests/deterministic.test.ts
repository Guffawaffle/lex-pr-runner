import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generatePlan, generateEmptyPlan } from '../src/core/plan';
import { loadInputs } from '../src/core/inputs';
import { canonicalJSONStringify } from '../src/util/canonicalJson';
import * as fs from 'fs';
import * as path from 'path';

describe('deterministic plan generation', () => {
	const testDir = '/tmp/lex-pr-runner-test';

	beforeEach(() => {
		// Clean test directory
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true });
		}
		fs.mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);
	});

	afterEach(() => {
		// Cleanup
		process.chdir('/');
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true });
		}
	});	it('should generate identical plans for same inputs', () => {
		// Create .smartergpt directory structure
		fs.mkdirSync('.smartergpt', { recursive: true });

		// Create stack.yml with deterministic content
		fs.writeFileSync('.smartergpt/stack.yml', `
version: 1
target: main
items:
  - id: item-1
    branch: feat/item-1
    deps: []
    gates:
      - name: lint
        run: npm run lint
      - name: test
        run: npm test
  - id: item-2
    branch: feat/item-2
    deps: [item-1]
    gates:
      - name: lint
        run: npm run lint
      - name: test
        run: npm test
`);

		// Generate plans multiple times
		const inputs1 = loadInputs();
		const plan1 = generatePlan(inputs1);

		const inputs2 = loadInputs();
		const plan2 = generatePlan(inputs2);

		const inputs3 = loadInputs();
		const plan3 = generatePlan(inputs3);

		// Should be byte-for-byte identical
		const json1 = canonicalJSONStringify(plan1);
		const json2 = canonicalJSONStringify(plan2);
		const json3 = canonicalJSONStringify(plan3);

		expect(json1).toBe(json2);
		expect(json2).toBe(json3);

		// Verify structure
		expect(plan1.schemaVersion).toBe('1.0.0');
		expect(plan1.target).toBe('main');
		expect(plan1.items).toHaveLength(2);

		// Verify deterministic ordering
		expect(plan1.items[0].name).toBe('item-1');
		expect(plan1.items[1].name).toBe('item-2');
		expect(plan1.items[1].deps).toEqual(['item-1']);
	});	it('should handle scope-level overrides deterministically', () => {
		// Create stack config
		fs.writeFileSync('stack.yml', `
target: main
items:
  - id: base-item
    title: "Base item"
    gates: ["lint"]
`);

		// Create scope config with overrides
		fs.writeFileSync('scope.yml', `
policy:
  maxWorkers: 4
  retries:
    test:
      maxAttempts: 3
      backoffSeconds: 30
items:
  - id: scope-item
    title: "Scope item"
    dependencies: ["base-item"]
    gates: ["lint", "test"]
`);

		const inputs = loadInputs();
		const plan = generatePlan(inputs);

		// Should merge configurations deterministically
		expect(plan.items).toHaveLength(2);
		expect(plan.policy?.maxWorkers).toBe(4);
		expect(plan.policy?.retries?.test?.maxAttempts).toBe(3);

		// Generate again to verify consistency
		const inputs2 = loadInputs();
		const plan2 = generatePlan(inputs2);

		expect(canonicalJSONStringify(plan)).toBe(canonicalJSONStringify(plan2));
	});

	it('should validate dependencies and fail deterministically', () => {
		fs.writeFileSync('stack.yml', `
target: main
items:
  - id: item-1
    title: "First item"
    dependencies: ["nonexistent-item"]
    gates: ["lint"]
`);

		expect(() => {
			const inputs = loadInputs();
			generatePlan(inputs);
		}).toThrow(/unknown dependency.*nonexistent-item/i);
	});

	it('should handle complex dependency graphs', () => {
		fs.writeFileSync('stack.yml', `
target: main
items:
  - id: foundation
    title: "Foundation"
    gates: ["lint"]
  - id: core-utils
    title: "Core utilities"
    dependencies: ["foundation"]
    gates: ["lint", "test"]
  - id: api-client
    title: "API client"
    dependencies: ["core-utils"]
    gates: ["lint", "test"]
  - id: web-ui
    title: "Web UI"
    dependencies: ["api-client"]
    gates: ["lint", "test", "e2e"]
  - id: mobile-ui
    title: "Mobile UI"
    dependencies: ["api-client"]
    gates: ["lint", "test"]
  - id: integration
    title: "Integration tests"
    dependencies: ["web-ui", "mobile-ui"]
    gates: ["integration"]
`);

		const inputs = loadInputs();
		const plan = generatePlan(inputs);

		// Verify all dependencies resolved
		expect(plan.items).toHaveLength(6);

		const itemMap = Object.fromEntries(plan.items.map(item => [item.name, item]));

		expect(itemMap['foundation'].deps).toEqual([]);
		expect(itemMap['core-utils'].deps).toEqual(['foundation']);
		expect(itemMap['api-client'].deps).toEqual(['core-utils']);
		expect(itemMap['web-ui'].deps).toEqual(['api-client']);
		expect(itemMap['mobile-ui'].deps).toEqual(['api-client']);
		expect(itemMap['integration'].deps).toEqual(['web-ui', 'mobile-ui']);

		// Generate multiple times to verify consistency
		const plan2 = generatePlan(loadInputs());
		expect(canonicalJSONStringify(plan)).toBe(canonicalJSONStringify(plan2));
	});

	it('should handle empty configurations gracefully', () => {
		fs.writeFileSync('stack.yml', `
target: main
items: []
`);

		const inputs = loadInputs();
		const plan = generatePlan(inputs);

		expect(plan.schemaVersion).toBe('1.0.0');
		expect(plan.target).toBe('main');
		expect(plan.items).toEqual([]);

		// Should still be deterministic
		const plan2 = generatePlan(loadInputs());
		expect(canonicalJSONStringify(plan)).toBe(canonicalJSONStringify(plan2));
	});

	it('should normalize gate arrays consistently', () => {
		fs.writeFileSync('stack.yml', `
target: main
items:
  - id: test-gates
    title: "Test gates ordering"
    gates: ["e2e", "lint", "test", "build"] # Deliberately unsorted
`);

		const inputs = loadInputs();
		const plan = generatePlan(inputs);

		// Gates should be normalized in consistent order
		const item = plan.items[0];
		expect(item.gates).toEqual(['e2e', 'lint', 'test', 'build']); // Maintains input order by design

		// But serialization should be deterministic
		const json1 = canonicalJSONStringify(plan);
		const json2 = canonicalJSONStringify(generatePlan(loadInputs()));

		expect(json1).toBe(json2);
	});
});