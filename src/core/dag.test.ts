/**
 * Tests for dependency DAG builder and levelization
 */

import { buildDependencyLevels, levelsToNames, CycleError, MissingNodeError } from "./dag.js";
import { PlanItem } from "./plan.js";

describe("buildDependencyLevels", () => {
	test("handles simple linear dependency A→B→C", () => {
		const items: PlanItem[] = [
			{ id: 1, branch: "feat/a", needs: [], strategy: "rebase-weave" },
			{ id: 2, branch: "feat/b", needs: [1], strategy: "rebase-weave" },
			{ id: 3, branch: "feat/c", needs: [2], strategy: "rebase-weave" }
		];

		const levels = buildDependencyLevels(items);
		expect(levels).toEqual([
			[1], // A has no dependencies
			[2], // B depends on A  
			[3]  // C depends on B
		]);
	});

	test("handles parallel dependencies A→B and A→D", () => {
		const items: PlanItem[] = [
			{ id: 1, branch: "feat/a", needs: [], strategy: "rebase-weave" },
			{ id: 2, branch: "feat/b", needs: [1], strategy: "rebase-weave" },
			{ id: 4, branch: "feat/d", needs: [1], strategy: "rebase-weave" }
		];

		const levels = buildDependencyLevels(items);
		expect(levels).toEqual([
			[1],    // A has no dependencies
			[2, 4]  // B and D both depend on A (sorted by ID)
		]);
	});

	test("handles acceptance criteria example: A→B→C and A→D", () => {
		const items: PlanItem[] = [
			{ id: 1, branch: "feat/a", needs: [], strategy: "rebase-weave" },
			{ id: 2, branch: "feat/b", needs: [1], strategy: "rebase-weave" },
			{ id: 3, branch: "feat/c", needs: [2], strategy: "rebase-weave" },
			{ id: 4, branch: "feat/d", needs: [1], strategy: "rebase-weave" }
		];

		const levels = buildDependencyLevels(items);
		expect(levels).toEqual([
			[1],    // Level 0: A
			[2, 4], // Level 1: B, D (both depend on A)
			[3]     // Level 2: C (depends on B)
		]);

		// Test deterministic ordering by running multiple times
		for (let i = 0; i < 5; i++) {
			const levels2 = buildDependencyLevels(items);
			expect(levels2).toEqual(levels);
		}
	});

	test("handles multiple root nodes", () => {
		const items: PlanItem[] = [
			{ id: 1, branch: "feat/a", needs: [], strategy: "rebase-weave" },
			{ id: 2, branch: "feat/b", needs: [], strategy: "rebase-weave" },
			{ id: 3, branch: "feat/c", needs: [1, 2], strategy: "rebase-weave" }
		];

		const levels = buildDependencyLevels(items);
		expect(levels).toEqual([
			[1, 2], // A and B have no dependencies
			[3]     // C depends on both A and B
		]);
	});

	test("detects cycles", () => {
		const items: PlanItem[] = [
			{ id: 1, branch: "feat/a", needs: [2], strategy: "rebase-weave" },
			{ id: 2, branch: "feat/b", needs: [1], strategy: "rebase-weave" }
		];

		expect(() => buildDependencyLevels(items)).toThrow(CycleError);
		expect(() => buildDependencyLevels(items)).toThrow("Dependency cycle detected");
	});

	test("detects missing dependencies", () => {
		const items: PlanItem[] = [
			{ id: 1, branch: "feat/a", needs: [], strategy: "rebase-weave" },
			{ id: 2, branch: "feat/b", needs: [99], strategy: "rebase-weave" } // 99 doesn't exist
		];

		expect(() => buildDependencyLevels(items)).toThrow(MissingNodeError);
		expect(() => buildDependencyLevels(items)).toThrow("depends on missing item 99");
	});

	test("handles empty input", () => {
		const levels = buildDependencyLevels([]);
		expect(levels).toEqual([]);
	});

	test("handles single item with no dependencies", () => {
		const items: PlanItem[] = [
			{ id: 1, branch: "feat/a", needs: [], strategy: "rebase-weave" }
		];

		const levels = buildDependencyLevels(items);
		expect(levels).toEqual([[1]]);
	});
});

describe("levelsToNames", () => {
	test("converts numeric levels to branch names", () => {
		const items: PlanItem[] = [
			{ id: 1, branch: "feat/a", needs: [], strategy: "rebase-weave" },
			{ id: 2, branch: "feat/b", needs: [1], strategy: "rebase-weave" },
			{ id: 4, branch: "feat/d", needs: [1], strategy: "rebase-weave" }
		];

		const numericLevels = [[1], [2, 4]];
		const nameLevels = levelsToNames(numericLevels, items);
		
		expect(nameLevels).toEqual([
			["feat/a"],
			["feat/b", "feat/d"] // Sorted alphabetically
		]);
	});

	test("handles missing items gracefully", () => {
		const items: PlanItem[] = [
			{ id: 1, branch: "feat/a", needs: [], strategy: "rebase-weave" }
		];

		const numericLevels = [[1], [99]]; // 99 doesn't exist
		const nameLevels = levelsToNames(numericLevels, items);
		
		expect(nameLevels).toEqual([
			["feat/a"],
			["unknown-99"]
		]);
	});
});