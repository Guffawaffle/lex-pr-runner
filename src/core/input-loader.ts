import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import * as YAML from "yaml";
import { Plan, PlanItem } from "./plan.js";

// Input format schemas
export const StackYml = z.object({
	version: z.number().int().min(1),
	target: z.string().min(1),
	prs: z.array(z.object({
		id: z.number().int().positive(),
		branch: z.string().min(1),
		sha: z.string().optional(),
		needs: z.array(z.number().int().positive()).optional(),
		strategy: z.enum(["rebase-weave", "merge-weave", "squash-weave"]).optional()
	}))
});
export type StackYml = z.infer<typeof StackYml>;

export const ScopeYml = z.object({
	version: z.number().int().min(1),
	target: z.string().min(1),
	sources: z.array(z.object({
		query: z.string()
	})).optional(),
	selectors: z.object({
		include_labels: z.array(z.string()).optional(),
		exclude_labels: z.array(z.string()).optional()
	}).optional(),
	defaults: z.object({
		strategy: z.enum(["rebase-weave", "merge-weave", "squash-weave"]).optional(),
		base: z.string().optional()
	}).optional(),
	pin_commits: z.boolean().optional()
});
export type ScopeYml = z.infer<typeof ScopeYml>;

export const DepsYml = z.object({
	version: z.number().int().min(1),
	depends_on: z.array(z.string()).optional(),
	strategies: z.record(z.string()).optional()
});
export type DepsYml = z.infer<typeof DepsYml>;

export interface LoaderError extends Error {
	path?: string;
	cause?: string;
}

export class CanonicalInputLoader {
	private basePath: string;

	constructor(basePath: string = ".smartergpt") {
		this.basePath = basePath;
	}

	/**
	 * Load and parse a YAML file with validation
	 */
	private loadYaml<T>(fileName: string, schema: z.ZodSchema<T>): T | null {
		const filePath = join(this.basePath, fileName);
		
		if (!existsSync(filePath)) {
			return null;
		}

		try {
			const content = readFileSync(filePath, "utf-8");
			const data = YAML.parse(content);
			
			const result = schema.safeParse(data);
			if (!result.success) {
				const error = new Error(`Invalid ${fileName} format: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`) as LoaderError;
				error.path = filePath;
				error.cause = result.error.message;
				throw error;
			}

			return result.data;
		} catch (err) {
			if (err instanceof Error && (err as LoaderError).path) {
				throw err; // Re-throw validation errors
			}
			const error = new Error(`Failed to parse ${fileName}: ${err instanceof Error ? err.message : String(err)}`) as LoaderError;
			error.path = filePath;
			throw error;
		}
	}

	/**
	 * Load plan using precedence: stack.yml > scope.yml+deps.yml > PR metadata > heuristics
	 */
	async loadPlan(): Promise<Plan> {
		// Try stack.yml first (highest precedence)
		const stackYml = this.loadYaml("stack.yml", StackYml);
		if (stackYml) {
			return this.fromStackYml(stackYml);
		}

		// Try scope.yml + deps.yml combination
		const scopeYml = this.loadYaml("scope.yml", ScopeYml);
		const depsYml = this.loadYaml("deps.yml", DepsYml);
		
		if (scopeYml || depsYml) {
			return this.fromScopeAndDeps(scopeYml, depsYml);
		}

		// TODO: Fall back to PR metadata extraction
		// TODO: Fall back to heuristics
		
		// For now, return empty plan as final fallback
		return {
			target: "main",
			items: []
		};
	}

	/**
	 * Convert stack.yml format to internal Plan
	 */
	private fromStackYml(stack: StackYml): Plan {
		const items: PlanItem[] = stack.prs.map(pr => ({
			id: pr.id,
			branch: pr.branch,
			sha: pr.sha,
			needs: pr.needs || [],
			strategy: pr.strategy || "rebase-weave"
		}));

		return {
			target: stack.target,
			items
		};
	}

	/**
	 * Convert scope.yml + deps.yml combination to internal Plan
	 * This is a simplified implementation that would normally query GitHub API
	 */
	private fromScopeAndDeps(scope: ScopeYml | null, deps: DepsYml | null): Plan {
		const target = scope?.target || "main";
		
		// For now, return empty items since we don't have GitHub API integration
		// In a full implementation, this would:
		// 1. Use scope.sources queries to find PRs
		// 2. Apply scope.selectors filters
		// 3. Apply deps.depends_on relationships
		// 4. Use scope.defaults for missing strategies
		
		return {
			target,
			items: []
		};
	}
}