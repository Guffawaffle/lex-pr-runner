import { createPlan, generateSnapshot } from "../core/plan.js";
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Plan functionality', () => {
	it('should create a plan with default values', async () => {
		const plan = await createPlan();
		assert.strictEqual(plan.target, 'main');
		assert.strictEqual(Array.isArray(plan.items), true);
		assert.strictEqual(plan.items.length, 0);
	});
	
	it('should generate deterministic snapshot', async () => {
		const plan = await createPlan();
		const snapshot1 = await generateSnapshot(plan);
		const snapshot2 = await generateSnapshot(plan);
		
		assert.strictEqual(snapshot1, snapshot2);
		assert.ok(snapshot1.includes('# Plan Snapshot'));
		assert.ok(snapshot1.includes('**Target Branch:** main'));
		assert.ok(snapshot1.includes('**Items Count:** 0'));
	});
});