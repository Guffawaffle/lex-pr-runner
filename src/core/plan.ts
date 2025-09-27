import { z } from "zod";
import { loadScopeConfig, loadStackConfig, hasStackPRs } from "./config.js";
import { listPRsWithQuery, validateGitHubCLI } from "./github.js";

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
	// Load configuration files
	const stackConfig = await loadStackConfig();
	const scopeConfig = await loadScopeConfig();
	
	// Use target from stack.yml if available, otherwise scope.yml, otherwise default to "main"
	const target = stackConfig?.target || scopeConfig?.target || "main";
	
	// If stack.yml has PRs configured, use them (not implemented in this issue)
	if (hasStackPRs(stackConfig)) {
		// TODO: implement stack.yml PR handling in future issue
		return {
			target,
			items: []
		};
	}
	
	// Fallback to GitHub query using scope.yml
	if (scopeConfig && scopeConfig.sources.length > 0) {
		const query = scopeConfig.sources[0].query;
		const repo = scopeConfig.repo;
		
		try {
			// Validate GitHub CLI is available
			const hasGitHubCLI = await validateGitHubCLI();
			if (!hasGitHubCLI) {
				throw new Error("GitHub CLI (gh) is not available. Please install it to use GitHub query fallback.");
			}
			
			// Fetch PRs from GitHub
			const prs = await listPRsWithQuery(query, repo);
			
			// Map GitHub PRs to PlanItems
			const items: PlanItem[] = prs.map((pr, index) => ({
				id: pr.number,
				branch: pr.headRefName,
				sha: scopeConfig.pin_commits ? pr.headRefOid : undefined,
				needs: [],
				strategy: scopeConfig.defaults?.strategy || "rebase-weave"
			}));
			
			return {
				target,
				items
			};
		} catch (error) {
			console.warn(`GitHub query fallback failed: ${error}`);
			return {
				target,
				items: []
			};
		}
	}
	
	// Return empty plan if no configuration is available
	return {
		target,
		items: []
	};
}
