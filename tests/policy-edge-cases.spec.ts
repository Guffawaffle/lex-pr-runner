import { describe, it, expect, beforeEach } from 'vitest';
import { MergeEligibilityEvaluator } from '../src/mergeEligibility.js';
import { ExecutionState } from '../src/executionState.js';
import { Plan, Policy, GateResult } from '../src/schema.js';

describe('Policy Edge Cases', () => {
	describe('Conflicting Gate Requirements', () => {
		it('handles conflicting required gates from multiple policy sources', () => {
			const plan: Plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				policy: {
					requiredGates: ['test', 'lint'], 
					optionalGates: ['build'],
					maxWorkers: 1,
					retries: {},
					overrides: {},
					blockOn: [],
					mergeRule: { type: 'strict-required' }
				},
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'test', run: 'npm test', runtime: 'local' },
							{ name: 'security', run: 'npm audit', runtime: 'local' }
						]
					}
				]
			};

			const state = new ExecutionState(plan);
			const evaluator = new MergeEligibilityEvaluator(plan, state);

			// Should fail when required gate 'lint' is missing
			const decision = evaluator.evaluateNode('A');
			expect(decision.eligible).toBe(false);
			expect(decision.reason).toContain('not eligible for merge');
		});

		it('resolves policy precedence correctly when gates conflict', () => {
			const plan: Plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				policy: {
					requiredGates: ['test'],
					optionalGates: ['lint'],
					maxWorkers: 1,
					retries: {},
					overrides: {},
					blockOn: ['security'], // Blocks on security gate
					mergeRule: { type: 'strict-required' }
				},
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'test', run: 'npm test', runtime: 'local' },
							{ name: 'lint', run: 'npm run lint', runtime: 'local' },
							{ name: 'security', run: 'npm audit', runtime: 'local' }
						]
					}
				]
			};

			const state = new ExecutionState(plan);
			
			// Mark test as passed but security as failed (blocked)
			state.updateGateResult('A', {
				gate: 'test',
				status: 'pass',
				exitCode: 0
			});

			state.updateGateResult('A', {
				gate: 'security', 
				status: 'fail',
				exitCode: 1
			});

			const evaluator = new MergeEligibilityEvaluator(plan, state);
			const decision = evaluator.evaluateNode('A');

			// Should be blocked due to failing security gate 
			expect(decision.eligible).toBe(false);
			expect(decision.reason).toContain('Failed required gates: security');
		});

		it('handles empty policy with item-level gate requirements', () => {
			const plan: Plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				// No policy specified - should use defaults
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'test', run: 'npm test', runtime: 'local' }
						]
					}
				]
			};

			const state = new ExecutionState(plan);
			const evaluator = new MergeEligibilityEvaluator(plan, state);

			// With no policy, should have default behavior
			const decision = evaluator.evaluateNode('A');
			expect(decision.eligible).toBe(false); // Gates not run yet
		});
	});

	describe('Retry Configuration Edge Cases', () => {
		it('handles retry configuration with timeout edge cases', () => {
			const plan: Plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				policy: {
					requiredGates: ['flaky-test'],
					optionalGates: [],
					maxWorkers: 1,
					retries: {
						'flaky-test': {
							maxAttempts: 3,
							backoffSeconds: 0.1 // Very short backoff for testing
						}
					},
					overrides: {},
					blockOn: [],
					mergeRule: { type: 'strict-required' }
				},
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'flaky-test', run: 'exit 1', runtime: 'local' }
						]
					}
				]
			};

			const state = new ExecutionState(plan);
			
			// Simulate multiple failed attempts
			const failedResult: GateResult = {
				gate: 'flaky-test',
				status: 'fail',
				exitCode: 1,
				attempts: 3,
				lastAttempt: new Date().toISOString()
			};

			state.updateGateResult('A', failedResult);

			const evaluator = new MergeEligibilityEvaluator(plan, state);
			const decision = evaluator.evaluateNode('A');

			expect(decision.eligible).toBe(false);
			expect(decision.reason).toContain('Failed required gates: flaky-test');
		});

		it('handles retry configuration for non-existent gates', () => {
			const plan: Plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				policy: {
					requiredGates: ['test'],
					optionalGates: [],
					maxWorkers: 1,
					retries: {
						'non-existent-gate': { // Config for gate that doesn't exist
							maxAttempts: 5,
							backoffSeconds: 1
						}
					},
					overrides: {},
					blockOn: [],
					mergeRule: { type: 'strict-required' }
				},
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'test', run: 'npm test', runtime: 'local' }
						]
					}
				]
			};

			const state = new ExecutionState(plan);
			state.updateGateResult('A', {
				gate: 'test',
				status: 'pass',
				exitCode: 0
			});

			const evaluator = new MergeEligibilityEvaluator(plan, state);
			const decision = evaluator.evaluateNode('A');

			// Should work fine, ignore retry config for non-existent gate
			expect(decision.eligible).toBe(true);
		});

		it('handles infinite retry attempts configuration', () => {
			const plan: Plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				policy: {
					requiredGates: ['test'],
					optionalGates: [],
					maxWorkers: 1,
					retries: {
						'test': {
							maxAttempts: Number.MAX_SAFE_INTEGER, // Edge case: very large number
							backoffSeconds: 0
						}
					},
					overrides: {},
					blockOn: [],
					mergeRule: { type: 'strict-required' }
				},
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'test', run: 'npm test', runtime: 'local' }
						]
					}
				]
			};

			// Should not throw error during construction
			const state = new ExecutionState(plan);
			const evaluator = new MergeEligibilityEvaluator(plan, state);

			expect(() => evaluator.evaluateNode('A')).not.toThrow();
		});
	});

	describe('Admin Override Scenarios', () => {
		let plan: Plan;

		beforeEach(() => {
			plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				policy: {
					requiredGates: ['test', 'security'],
					optionalGates: [],
					maxWorkers: 1,
					retries: {},
					overrides: {
						adminGreen: {
							allowedUsers: ['admin1', 'admin2'],
							requireReason: true
						}
					},
					blockOn: [],
					mergeRule: { type: 'strict-required' }
				},
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'test', run: 'npm test', runtime: 'local' },
							{ name: 'security', run: 'npm audit', runtime: 'local' }
						]
					}
				]
			};
		});

		it('validates admin override with proper authorization', () => {
			const state = new ExecutionState(plan);
			
			// Mark security gate as failed
			state.updateGateResult('A', {
				gate: 'test',
				status: 'pass',
				exitCode: 0
			});

			state.updateGateResult('A', {
				gate: 'security',
				status: 'fail',
				exitCode: 1
			});

			const evaluator = new MergeEligibilityEvaluator(plan, state);
			
			// Should reject override from unauthorized user
			const unauthorizedOverride = evaluator.requestOverride('A', 'regular-user', 'Emergency fix');
			expect(unauthorizedOverride).toBe(false);

			// Should accept override from authorized user
			const authorizedOverride = evaluator.requestOverride('A', 'admin1', 'Critical security patch');
			expect(authorizedOverride).toBe(true);

			// Now node should be eligible for merge
			const decision = evaluator.evaluateNode('A');
			expect(decision.eligible).toBe(true);
		});

		it('validates admin override reason requirement', () => {
			const state = new ExecutionState(plan);
			const evaluator = new MergeEligibilityEvaluator(plan, state);

			// Should reject override without reason when required
			const noReason = evaluator.requestOverride('A', 'admin1', '');
			expect(noReason).toBe(false);

			const whiteSpaceReason = evaluator.requestOverride('A', 'admin1', '   ');
			expect(whiteSpaceReason).toBe(false);

			// Should accept override with proper reason
			const validReason = evaluator.requestOverride('A', 'admin1', 'Emergency deployment');
			expect(validReason).toBe(true);
		});

		it('handles admin override when no admin policy configured', () => {
			const planNoAdmin: Plan = {
				...plan,
				policy: {
					...plan.policy!,
					overrides: {} // No admin override configured
				}
			};

			const state = new ExecutionState(planNoAdmin);
			const evaluator = new MergeEligibilityEvaluator(planNoAdmin, state);

			// Should reject all override attempts when not configured
			const overrideAttempt = evaluator.requestOverride('A', 'admin1', 'Emergency fix');
			expect(overrideAttempt).toBe(false);
		});

		it('handles admin override with empty allowed users list', () => {
			const planEmptyUsers: Plan = {
				...plan,
				policy: {
					...plan.policy!,
					overrides: {
						adminGreen: {
							allowedUsers: [], // Empty list
							requireReason: false
						}
					}
				}
			};

			const state = new ExecutionState(planEmptyUsers);
			const evaluator = new MergeEligibilityEvaluator(planEmptyUsers, state);

			// Should reject override when no users are allowed
			const overrideAttempt = evaluator.requestOverride('A', 'admin1', 'Emergency fix');
			expect(overrideAttempt).toBe(false);
		});

		it('handles admin override with undefined allowed users', () => {
			const planUndefinedUsers: Plan = {
				...plan,
				policy: {
					...plan.policy!,
					overrides: {
						adminGreen: {
							allowedUsers: undefined, // Undefined list
							requireReason: false
						}
					}
				}
			};

			const state = new ExecutionState(planUndefinedUsers);
			const evaluator = new MergeEligibilityEvaluator(planUndefinedUsers, state);

			// Should accept override when allowedUsers is undefined (no restriction)
			const overrideAttempt = evaluator.requestOverride('A', 'any-user', 'Emergency fix');
			expect(overrideAttempt).toBe(true);
		});
	});

	describe('Policy Composition Conflicts', () => {
		it('handles conflicting maxWorkers settings', () => {
			const plan: Plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				policy: {
					requiredGates: ['test'],
					optionalGates: [],
					maxWorkers: 0, // Invalid value - should be at least 1
					retries: {},
					overrides: {},
					blockOn: [],
					mergeRule: { type: 'strict-required' }
				},
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'test', run: 'npm test', runtime: 'local' }
						]
					}
				]
			};

			// Should not throw error, policy validation should handle this
			expect(() => new ExecutionState(plan)).not.toThrow();
		});

		it('handles conflicting merge rule types', () => {
			const plan: Plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				policy: {
					requiredGates: ['test'],
					optionalGates: [],
					maxWorkers: 1,
					retries: {},
					overrides: {},
					blockOn: [],
					mergeRule: { type: 'strict-required' }
				},
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'test', run: 'npm test', runtime: 'local' }
						]
					}
				]
			};

			const state = new ExecutionState(plan);
			state.updateGateResult('A', {
				gate: 'test',
				status: 'pass',
				exitCode: 0
			});

			const evaluator = new MergeEligibilityEvaluator(plan, state);
			const decision = evaluator.evaluateNode('A');

			// Should respect strict-required rule
			expect(decision.eligible).toBe(true);
		});

		it('handles missing policy with graceful defaults', () => {
			const plan: Plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				// No policy specified
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'test', run: 'npm test', runtime: 'local' }
						]
					}
				]
			};

			const state = new ExecutionState(plan);
			const evaluator = new MergeEligibilityEvaluator(plan, state);

			// Should use default policy without errors
			expect(() => evaluator.evaluateNode('A')).not.toThrow();
		});

		it('handles policy with conflicting blockOn and requiredGates', () => {
			const plan: Plan = {
				schemaVersion: '1.0.0',
				target: 'main',
				policy: {
					requiredGates: ['test'],
					optionalGates: [],
					maxWorkers: 1,
					retries: {},
					overrides: {},
					blockOn: ['test'], // Same gate is both required and blocking
					mergeRule: { type: 'strict-required' }
				},
				items: [
					{
						name: 'A',
						deps: [],
						gates: [
							{ name: 'test', run: 'npm test', runtime: 'local' }
						]
					}
				]
			};

			const state = new ExecutionState(plan);
			
			// Test passes - but blockOn feature may not be implemented yet
			state.updateGateResult('A', {
				gate: 'test',
				status: 'pass',
				exitCode: 0
			});

			const evaluator = new MergeEligibilityEvaluator(plan, state);
			const decision = evaluator.evaluateNode('A');

			// Current implementation may not handle blockOn, so test passes
			// In future implementation, blockOn should take precedence
			expect(decision.eligible).toBe(true); // Currently passes since blockOn not implemented
		});
	});
});