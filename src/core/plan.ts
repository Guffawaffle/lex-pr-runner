import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

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

export const PlanSnapshot = z.object({
	timestamp: z.string(),
	plan: Plan,
	inputs: z.record(z.any()),
	environment: z.object({
		nodeVersion: z.string(),
		platform: z.string(),
		arch: z.string()
	})
});
export type PlanSnapshot = z.infer<typeof PlanSnapshot>;

export async function createPlan(inputsDir: string = ".smartergpt"): Promise<Plan> {
	// Read .smartergpt/stack.yml if present; otherwise combine scope.yml + deps.yml + PR metadata.
	const stackYmlPath = path.join(inputsDir, "stack.yml");
	const scopeYmlPath = path.join(inputsDir, "scope.yml");
	const depsYmlPath = path.join(inputsDir, "deps.yml");
	
	let plan: Plan = {
		target: "main",
		items: []
	};

	// Try to read stack.yml first (highest priority)
	if (fs.existsSync(stackYmlPath)) {
		const content = fs.readFileSync(stackYmlPath, "utf-8");
		const stackData = yaml.parse(content);
		
		if (stackData && stackData.target) {
			plan.target = stackData.target;
		}
		
		if (stackData && stackData.prs && Array.isArray(stackData.prs)) {
			plan.items = stackData.prs.map((pr: any, index: number) => ({
				id: index + 1,
				branch: pr.branch || `branch-${index + 1}`,
				sha: pr.sha,
				needs: pr.needs || [],
				strategy: pr.strategy || "rebase-weave"
			}));
		}
	} else {
		// Fallback to combining scope.yml and deps.yml
		let targetBranch = "main";
		let items: PlanItem[] = [];

		if (fs.existsSync(scopeYmlPath)) {
			const scopeContent = fs.readFileSync(scopeYmlPath, "utf-8");
			const scopeData = yaml.parse(scopeContent);
			if (scopeData && scopeData.target) {
				targetBranch = scopeData.target;
			}
		}

		if (fs.existsSync(depsYmlPath)) {
			const depsContent = fs.readFileSync(depsYmlPath, "utf-8");
			const depsData = yaml.parse(depsContent);
			// For now, create empty items array - real implementation would process deps
		}

		plan = {
			target: targetBranch,
			items: items
		};
	}

	return plan;
}

export async function createPlanSnapshot(inputsDir: string = ".smartergpt"): Promise<PlanSnapshot> {
	const plan = await createPlan(inputsDir);
	
	// Read all input files to capture the snapshot
	const inputs: Record<string, any> = {};
	
	const inputFiles = ["stack.yml", "scope.yml", "deps.yml", "gates.yml"];
	for (const file of inputFiles) {
		const filePath = path.join(inputsDir, file);
		if (fs.existsSync(filePath)) {
			const content = fs.readFileSync(filePath, "utf-8");
			try {
				inputs[file] = yaml.parse(content);
			} catch (e) {
				inputs[file] = content; // Keep as string if not valid YAML
			}
		}
	}

	// Create deterministic timestamp (for testing, we can override this)
	const timestamp = process.env.LEX_PR_DETERMINISTIC_TIME || new Date().toISOString();

	return {
		timestamp,
		plan,
		inputs,
		environment: {
			nodeVersion: process.version,
			platform: process.platform,
			arch: process.arch
		}
	};
}
