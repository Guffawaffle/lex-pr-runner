import { z } from "zod";

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
