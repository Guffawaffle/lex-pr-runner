import { z } from "zod";
import * as crypto from "crypto";
import { computeLevels } from "./toposort.js";

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
	items: z.array(PlanItem),
	levels: z.array(z.array(z.number())).optional(),
	contentHash: z.string().optional()
});
export type Plan = z.infer<typeof Plan>;

export async function createPlan(): Promise<Plan> {
	// TODO: read .smartergpt/stack.yml if present; otherwise combine scope.yml + deps.yml + PR metadata.
	// For now, return a minimal placeholder plan with sample data for testing.
	const items: PlanItem[] = [
		{ id: 1, branch: "feat/a", needs: [], strategy: "rebase-weave" },
		{ id: 2, branch: "feat/b", needs: [1], strategy: "rebase-weave" }
	];
	
	// Compute levels from topological sort
	let levels: number[][] = [];
	try {
		levels = computeLevels(items);
	} catch (error) {
		console.warn("Failed to compute levels:", error);
		levels = [];
	}
	
	// Create a deterministic content hash based on target and items
	const baseContent = {
		target: "main",
		items: items
	};
	const contentHash = crypto
		.createHash("sha256")
		.update(JSON.stringify(baseContent, null, 2))
		.digest("hex");
	
	return {
		target: "main",
		items,
		levels,
		contentHash
	};
}
