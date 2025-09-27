/**
 * Core plan generation - transforms inputs to normalized plan
 * Maintains deterministic ordering and canonical structure
 */

import { Plan, PlanItem, Gate } from "../schema.js";
import { InputConfig, InputItem, InputGate } from "./inputs.js";
import { stableSort } from "../util/canonicalJson.js";
import { UnknownDependencyError } from "../mergeOrder.js";

/**
 * Generate normalized plan from input configuration
 * Ensures deterministic output with stable ordering
 */
export function generatePlan(inputs: InputConfig): Plan {
	// Convert input items to plan items with normalization
	const planItems: PlanItem[] = inputs.items.map(transformInputToPlanItem);

	// Sort items by name for deterministic ordering
	planItems.sort((a, b) => a.name.localeCompare(b.name));

	// Validate dependencies exist
	validateDependencies(planItems);

	return {
		schemaVersion: "1.0.0", // Current schema version
		target: inputs.target,
		items: planItems,
		// Policy will be added later if needed
	};
}

/**
 * Transform input item to plan item with normalization
 */
function transformInputToPlanItem(inputItem: InputItem): PlanItem {
	return {
		name: inputItem.name || inputItem.id || inputItem.branch || `item-${inputItem.id}`,
		deps: stableSort(inputItem.deps || []),
		gates: inputItem.gates?.map(transformInputGate) || []
	};
}

/**
 * Transform input gate to plan gate with defaults
 */
function transformInputGate(inputGate: InputGate): Gate {
	return {
		name: inputGate.name,
		run: inputGate.run,
		cwd: inputGate.cwd,
		env: sortEnvRecord(inputGate.env || {}),
		runtime: inputGate.runtime || "local",
		artifacts: stableSort(inputGate.artifacts || [])
	};
}

/**
 * Sort environment record for deterministic output
 */
function sortEnvRecord(env: Record<string, string>): Record<string, string> {
	const sorted: Record<string, string> = {};
	for (const key of Object.keys(env).sort()) {
		sorted[key] = env[key];
	}
	return sorted;
}

/**
 * Validate that all dependencies reference existing items
 */
function validateDependencies(items: PlanItem[]): void {
	const itemNames = new Set(items.map(item => item.name));

	for (const item of items) {
		for (const dep of item.deps) {
			if (!itemNames.has(dep)) {
				throw new UnknownDependencyError(`Unknown dependency '${dep}' for item '${item.name}'`);
			}
		}
	}
}

/**
 * Generate minimal empty plan for cases with no configuration
 */
export function generateEmptyPlan(target: string = "main"): Plan {
	return {
		schemaVersion: "1.0.0",
		target,
		items: []
	};
}
