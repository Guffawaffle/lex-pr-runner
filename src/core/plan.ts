import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";
import { spawn } from "child_process";

export const Gate = z.object({
	name: z.string(),
	run: z.string(),
	cwd: z.string().optional(),
	env: z.record(z.string()).optional()
});
export type Gate = z.infer<typeof Gate>;

export const PlanItem = z.object({
	id: z.number(),
	branch: z.string(),
	sha: z.string().optional(),
	needs: z.number().array().default([]),
	strategy: z.enum(["rebase-weave", "merge-weave", "squash-weave"]).default("merge-weave"),
	gates: z.array(Gate).optional()
});
export type PlanItem = z.infer<typeof PlanItem>;

export const Plan = z.object({
	target: z.string().default("main"),
	items: z.array(PlanItem)
});
export type Plan = z.infer<typeof Plan>;

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

export interface GateResult {
	name: string;
	exitCode: number;
	duration: number;
	stdout: string;
	stderr: string;
	timedOut: boolean;
}

// Configuration schemas for YAML files
const StackConfig = z.object({
	version: z.number().default(1),
	target: z.string().default("main"),
	items: z.array(z.object({
		id: z.number(),
		branch: z.string(),
		sha: z.string().optional(),
		needs: z.number().array().default([]),
		strategy: z.enum(["rebase-weave", "merge-weave", "squash-weave"]).default("rebase-weave")
	})).default([])
});

const ScopeConfig = z.object({
	version: z.number().default(1),
	target: z.string().default("main"),
	sources: z.array(z.object({
		query: z.string()
	})).default([]),
	selectors: z.object({
		include_labels: z.array(z.string()).default([]),
		exclude_labels: z.array(z.string()).default([])
	}).default({}),
	defaults: z.object({
		strategy: z.enum(["rebase-weave", "merge-weave", "squash-weave"]).default("rebase-weave"),
		base: z.string().default("main")
	}).default({}),
	pin_commits: z.boolean().default(false)
});

/**
 * Validate a plan.json file against the schema
 */
export function validatePlan(planPath: string): { valid: boolean; errors?: string[] } {
	try {
		const planContent = fs.readFileSync(planPath, "utf-8");
		const planData = JSON.parse(planContent);
		const result = Plan.safeParse(planData);

		if (result.success) {
			return { valid: true };
		} else {
			const errors = result.error.issues.map(issue =>
				`${issue.path.join('.')}: ${issue.message}`
			);
			return { valid: false, errors };
		}
	} catch (error) {
		return {
			valid: false,
			errors: [error instanceof Error ? error.message : String(error)]
		};
	}
}

/**
 * Load and parse a plan.json file
 */
export function loadPlan(planPath: string): Plan {
	const planContent = fs.readFileSync(planPath, "utf-8");
	const planData = JSON.parse(planContent);
	return Plan.parse(planData);
}

/**
 * Compute merge order levels using Kahn's algorithm with deterministic ordering
 */
export function computeMergeOrder(plan: Plan): number[][] {
	const items = plan.items;
	const itemIds = items.map(item => item.id);
	const itemIdSet = new Set(itemIds);

	// Build in-degree map and children map
	const inDegree = new Map<number, number>();
	const children = new Map<number, number[]>();

	// Initialize in-degrees and children
	for (const item of items) {
		inDegree.set(item.id, 0);
		children.set(item.id, []);
	}

	// Build dependency graph
	for (const item of items) {
		for (const depId of item.needs) {
			if (!itemIdSet.has(depId)) {
				throw new UnknownDependencyError(`unknown dependency '${depId}' for item '${item.id}'`);
			}
			children.get(depId)!.push(item.id);
			inDegree.set(item.id, inDegree.get(item.id)! + 1);
		}
	}

	// Kahn's algorithm with deterministic ordering
	const queue: number[] = [];
	const result: number[][] = [];

	// Start with nodes that have no dependencies, sorted for determinism
	for (const [id, degree] of inDegree.entries()) {
		if (degree === 0) {
			queue.push(id);
		}
	}
	queue.sort((a, b) => a - b);

	while (queue.length > 0) {
		const thisLevel = [...queue].sort((a, b) => a - b);
		queue.length = 0;
		result.push(thisLevel);

		for (const id of thisLevel) {
			const childrenIds = children.get(id) || [];
			for (const childId of childrenIds.sort((a, b) => a - b)) {
				const newDegree = inDegree.get(childId)! - 1;
				inDegree.set(childId, newDegree);
				if (newDegree === 0) {
					queue.push(childId);
				}
			}
		}
	}

	// Check for cycles
	if (inDegree.size > 0 && Array.from(inDegree.values()).some(degree => degree > 0)) {
		throw new CycleError("dependency cycle detected");
	}

	return result;
}

/**
 * Execute a single gate with timeout and capture output
 */
export async function executeGate(gate: Gate, timeoutMs: number = 30000): Promise<GateResult> {
	return new Promise((resolve) => {
		const startTime = Date.now();
		let timedOut = false;

		const childProcess = spawn('bash', ['-c', gate.run], {
			cwd: gate.cwd || process.cwd(),
			env: { ...process.env, ...gate.env },
			stdio: ['pipe', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		childProcess.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		childProcess.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		const timeout = setTimeout(() => {
			timedOut = true;
			childProcess.kill('SIGTERM');
			setTimeout(() => childProcess.kill('SIGKILL'), 5000);
		}, timeoutMs);

		childProcess.on('close', (exitCode) => {
			clearTimeout(timeout);
			const duration = Date.now() - startTime;
			resolve({
				name: gate.name,
				exitCode: exitCode || 0,
				duration,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				timedOut
			});
		});

		childProcess.on('error', (error) => {
			clearTimeout(timeout);
			const duration = Date.now() - startTime;
			resolve({
				name: gate.name,
				exitCode: 1,
				duration,
				stdout: stdout.trim(),
				stderr: error.message,
				timedOut
			});
		});
	});
}

/**
 * Execute all gates for all items in a plan
 */
export async function executeAllGates(plan: Plan, timeoutMs: number = 30000): Promise<Map<number, GateResult[]>> {
	const results = new Map<number, GateResult[]>();

	for (const item of plan.items) {
		if (item.gates && item.gates.length > 0) {
			const itemResults: GateResult[] = [];
			for (const gate of item.gates) {
				const result = await executeGate(gate, timeoutMs);
				itemResults.push(result);
			}
			results.set(item.id, itemResults);
		}
	}

	return results;
}

export async function createPlan(): Promise<Plan> {
	try {
		// First, try to read .smartergpt/stack.yml for explicit plan configuration
		const stackPath = ".smartergpt/stack.yml";
		if (fs.existsSync(stackPath)) {
			const stackContent = fs.readFileSync(stackPath, "utf-8");
			const stackData = YAML.parse(stackContent);
			const stackConfig = StackConfig.parse(stackData);

			return {
				target: stackConfig.target,
				items: stackConfig.items.map(item => ({
					id: item.id,
					branch: item.branch,
					sha: item.sha,
					needs: item.needs,
					strategy: item.strategy
				}))
			};
		}

		// Fallback: try to read scope.yml and deps.yml (if they exist)
		const scopePath = ".smartergpt/scope.yml";
		let target = "main";

		if (fs.existsSync(scopePath)) {
			const scopeContent = fs.readFileSync(scopePath, "utf-8");
			const scopeData = YAML.parse(scopeContent);
			const scopeConfig = ScopeConfig.parse(scopeData);
			target = scopeConfig.target;
		}

		// For now, return a minimal placeholder plan with the detected target
		return {
			target,
			items: []
		};
	} catch (error) {
		throw new Error(`Failed to create plan: ${error instanceof Error ? error.message : String(error)}`);
	}
}
