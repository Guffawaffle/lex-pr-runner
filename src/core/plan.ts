import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";

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
