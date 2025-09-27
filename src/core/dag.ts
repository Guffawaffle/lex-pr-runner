/**
 * Dependency DAG builder and levelization using Kahn's algorithm
 * Works with PlanItem[] format where items have numeric IDs and needs[] references
 */

import { PlanItem } from "./plan.js";

export class CycleError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CycleError";
	}
}

export class MissingNodeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MissingNodeError";
	}
}

/**
 * Build dependency levels using Kahn's algorithm with deterministic tie-breaking
 * @param items Array of PlanItems with id and needs[] properties
 * @returns Array of levels, each containing sorted item IDs
 * @throws CycleError if a dependency cycle is detected
 * @throws MissingNodeError if a dependency references a missing item
 */
export function buildDependencyLevels(items: PlanItem[]): number[][] {
	// Create lookup maps
	const itemById = new Map<number, PlanItem>();
	const inDegree = new Map<number, number>();
	const children = new Map<number, number[]>();

	// Initialize data structures
	for (const item of items) {
		itemById.set(item.id, item);
		inDegree.set(item.id, 0);
		children.set(item.id, []);
	}

	// Build the dependency graph
	for (const item of items) {
		for (const neededId of item.needs) {
			// Check if the needed item exists
			if (!itemById.has(neededId)) {
				throw new MissingNodeError(
					`Item ${item.id} (branch: ${item.branch}) depends on missing item ${neededId}`
				);
			}

			// Add edge: neededId -> item.id
			children.get(neededId)!.push(item.id);
			inDegree.set(item.id, inDegree.get(item.id)! + 1);
		}
	}

	// Sort children arrays for deterministic ordering
	for (const childList of children.values()) {
		childList.sort((a, b) => a - b);
	}

	// Kahn's algorithm with deterministic tie-breaking
	const queue: number[] = [];
	const result: number[][] = [];

	// Find all nodes with no incoming edges (roots)
	for (const [id, degree] of inDegree.entries()) {
		if (degree === 0) {
			queue.push(id);
		}
	}

	// Sort initial queue for deterministic results
	queue.sort((a, b) => a - b);

	while (queue.length > 0) {
		// Process all nodes at current level
		const currentLevel = [...queue].sort((a, b) => a - b);
		queue.length = 0; // Clear queue
		result.push(currentLevel);

		// Process each node in current level
		for (const nodeId of currentLevel) {
			const nodeChildren = children.get(nodeId) || [];
			
			for (const childId of nodeChildren) {
				// Decrease in-degree
				inDegree.set(childId, inDegree.get(childId)! - 1);
				
				// If no more dependencies, add to queue
				if (inDegree.get(childId) === 0) {
					queue.push(childId);
				}
			}
		}
	}

	// Check for cycles
	const processedCount = result.flat().length;
	if (processedCount < items.length) {
		const unprocessedIds = items
			.map(item => item.id)
			.filter(id => !result.flat().includes(id))
			.sort((a, b) => a - b);
		
		throw new CycleError(
			`Dependency cycle detected. Unprocessed items: ${unprocessedIds.join(", ")}`
		);
	}

	return result;
}

/**
 * Convert dependency levels from numeric IDs to branch names for display
 * @param levels Array of levels with numeric IDs
 * @param items Original PlanItems for branch name lookup
 * @returns Array of levels with branch names
 */
export function levelsToNames(levels: number[][], items: PlanItem[]): string[][] {
	const itemById = new Map<number, PlanItem>();
	for (const item of items) {
		itemById.set(item.id, item);
	}

	return levels.map(level =>
		level.map(id => {
			const item = itemById.get(id);
			return item?.branch || `unknown-${id}`;
		}).sort() // Sort branch names alphabetically for deterministic display
	);
}