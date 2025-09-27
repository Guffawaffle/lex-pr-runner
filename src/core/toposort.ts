import { PlanItem } from "./plan.js";

export class CycleError extends Error {
	constructor(message: string = "dependency cycle detected") {
		super(message);
		this.name = "CycleError";
	}
}

function nameOf(item: PlanItem): string {
	return item.branch; // Using branch as the identifier for now
}

export function computeLevels(items: PlanItem[]): number[][] {
	/**
	 * Return deterministic topo levels of item indices.
	 * Throws CycleError if a cycle exists.
	 * Throws Error if a dependency references a missing item.
	 */
	const itemMap = new Map<number, PlanItem>();
	const nameToId = new Map<string, number>();
	
	// Build maps
	for (const item of items) {
		itemMap.set(item.id, item);
		nameToId.set(nameOf(item), item.id);
	}
	
	// Build graph using item IDs
	const inDegree = new Map<number, number>();
	const children = new Map<number, number[]>();
	
	// Initialize
	for (const item of items) {
		inDegree.set(item.id, 0);
		children.set(item.id, []);
	}
	
	// Build dependencies
	for (const item of items) {
		for (const depId of item.needs) {
			if (!itemMap.has(depId)) {
				throw new Error(`unknown dependency ${depId} for item ${item.id}`);
			}
			children.get(depId)!.push(item.id);
			inDegree.set(item.id, inDegree.get(item.id)! + 1);
		}
	}
	
	// Kahn's algorithm with deterministic ordering
	let queue = Array.from(inDegree.entries())
		.filter(([, deg]) => deg === 0)
		.map(([id]) => id)
		.sort();
	
	const result: number[][] = [];
	
	while (queue.length > 0) {
		const thisLevel = [...queue].sort();
		queue = [];
		result.push(thisLevel);
		
		for (const id of thisLevel) {
			const childList = children.get(id) || [];
			for (const childId of childList.sort()) {
				const newDegree = inDegree.get(childId)! - 1;
				inDegree.set(childId, newDegree);
				if (newDegree === 0) {
					queue.push(childId);
				}
			}
		}
	}
	
	// Check for cycles
	if (Array.from(inDegree.values()).some(deg => deg > 0)) {
		throw new CycleError();
	}
	
	return result;
}