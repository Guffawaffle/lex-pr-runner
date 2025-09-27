import { Plan, PlanItem } from "./schema.js";

/**
 * Merge order computation using Kahn's algorithm with deterministic tie-breaking
 */

export class CycleError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CycleError";
	}
}

export class UnknownDependencyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UnknownDependencyError";
	}
}

/**
 * Compute merge order levels using Kahn's algorithm with deterministic ordering
 * Returns array of levels, where each level contains item names that can be processed in parallel
 */
export function computeMergeOrder(plan: Plan): string[][] {
	const items = plan.items;
	const itemNames = items.map(item => item.name);
	const itemNameSet = new Set(itemNames);

	// Build in-degree map and children map
	const inDegree = new Map<string, number>();
	const children = new Map<string, string[]>();

	// Initialize in-degrees and children
	for (const item of items) {
		inDegree.set(item.name, 0);
		children.set(item.name, []);
	}

	// Build dependency graph
	for (const item of items) {
		for (const depName of item.deps) {
			if (!itemNameSet.has(depName)) {
				throw new UnknownDependencyError(`unknown dependency '${depName}' for item '${item.name}'`);
			}
			children.get(depName)!.push(item.name);
			inDegree.set(item.name, inDegree.get(item.name)! + 1);
		}
	}

	// Kahn's algorithm with deterministic ordering
	const queue: string[] = [];
	const result: string[][] = [];

	// Start with nodes that have no dependencies, sorted for determinism
	for (const [name, degree] of inDegree.entries()) {
		if (degree === 0) {
			queue.push(name);
		}
	}
	queue.sort();

	while (queue.length > 0) {
		const thisLevel = [...queue].sort();
		queue.length = 0;
		result.push(thisLevel);

		for (const name of thisLevel) {
			const childrenNames = children.get(name) || [];
			for (const childName of childrenNames.sort()) {
				const newDegree = inDegree.get(childName)! - 1;
				inDegree.set(childName, newDegree);
				if (newDegree === 0) {
					queue.push(childName);
				}
			}
		}
	}

	// Check for cycles
	if (inDegree.size > 0 && Array.from(inDegree.values()).some(degree => degree > 0)) {
		const cycleNodes = Array.from(inDegree.entries())
			.filter(([, degree]) => degree > 0)
			.map(([name]) => name);
		throw new CycleError(`dependency cycle detected involving: ${cycleNodes.join(', ')}`);
	}

	return result;
}
