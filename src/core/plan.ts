import { z } from "zod";
import { buildDependencyLevels, levelsToNames } from "./dag.js";

export const PlanItem = z.object({
	id: z.number(),
	branch: z.string(),
	sha: z.string().optional(),
	needs: z.number().array().default([]),
	strategy: z.enum(["rebase-weave", "merge-weave", "squash-weave"]).default("rebase-weave")
});
export type PlanItem = z.infer<typeof PlanItem>;

export const Plan = z.object({
	target: z.string().default("main"),
	items: z.array(PlanItem)
});
export type Plan = z.infer<typeof Plan>;

export async function createPlan(): Promise<Plan> {
	// TODO: read .smartergpt/stack.yml if present; otherwise combine scope.yml + deps.yml + PR metadata.
	// For now, return a minimal placeholder plan.
	return {
		target: "main",
		items: []
	};
}

/**
 * Compute dependency levels for a plan using DAG algorithm
 * @param plan The plan to compute levels for
 * @returns Object containing numeric levels and named levels
 * @throws CycleError if dependency cycle detected
 * @throws MissingNodeError if missing dependencies
 */
export function computePlanLevels(plan: Plan) {
	const numericLevels = buildDependencyLevels(plan.items);
	const namedLevels = levelsToNames(numericLevels, plan.items);
	
	return {
		levels: numericLevels,
		namedLevels: namedLevels
	};
}
