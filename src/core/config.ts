import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

// Schema for scope.yml configuration
export const ScopeConfig = z.object({
	version: z.number(),
	target: z.string(),
	repo: z.string().optional(),
	sources: z.array(z.object({
		query: z.string()
	})),
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
export type ScopeConfig = z.infer<typeof ScopeConfig>;

// Schema for stack.yml configuration
export const StackConfig = z.object({
	version: z.number(),
	target: z.string(),
	prs: z.array(z.number())
});
export type StackConfig = z.infer<typeof StackConfig>;

// Load and parse scope.yml
export async function loadScopeConfig(configDir: string = ".smartergpt"): Promise<ScopeConfig | null> {
	const scopePath = path.join(configDir, "scope.yml");
	try {
		const content = fs.readFileSync(scopePath, "utf-8");
		const parsed = yaml.parse(content);
		return ScopeConfig.parse(parsed);
	} catch (error) {
		console.warn(`Could not load scope.yml: ${error}`);
		return null;
	}
}

// Load and parse stack.yml
export async function loadStackConfig(configDir: string = ".smartergpt"): Promise<StackConfig | null> {
	const stackPath = path.join(configDir, "stack.yml");
	try {
		const content = fs.readFileSync(stackPath, "utf-8");
		const parsed = yaml.parse(content);
		return StackConfig.parse(parsed);
	} catch (error) {
		console.warn(`Could not load stack.yml: ${error}`);
		return null;
	}
}

// Check if stack.yml has PRs configured
export function hasStackPRs(stack: StackConfig | null): boolean {
	return stack !== null && stack.prs.length > 0;
}