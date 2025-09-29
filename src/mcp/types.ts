/**
 * MCP server types and configurations
 */

import { z } from "zod";

/**
 * Environment configuration for MCP server
 */
export interface MCPEnvironment {
	LEX_PROFILE_DIR: string;
	ALLOW_MUTATIONS: boolean;
}

/**
 * Get MCP environment configuration with defaults
 */
export function getMCPEnvironment(): MCPEnvironment {
	return {
		LEX_PROFILE_DIR: process.env.LEX_PROFILE_DIR || ".smartergpt",
		ALLOW_MUTATIONS: process.env.ALLOW_MUTATIONS === "true"
	};
}

/**
 * Validation schemas for MCP tool parameters
 */

export const PlanCreateArgs = z.object({
	json: z.boolean().optional(),
	outDir: z.string().optional()
});
export type PlanCreateArgs = z.infer<typeof PlanCreateArgs>;

export const GatesRunArgs = z.object({
	onlyItem: z.string().optional(),
	onlyGate: z.string().optional(),
	outDir: z.string().optional()
});
export type GatesRunArgs = z.infer<typeof GatesRunArgs>;

export const MergeApplyArgs = z.object({
	dryRun: z.boolean().optional()
});
export type MergeApplyArgs = z.infer<typeof MergeApplyArgs>;

/**
 * MCP tool result types
 */

export interface PlanCreateResult {
	plan: object;
	outDir: string;
}

export interface GatesRunResult {
	items: Array<{
		name: string;
		status: string;
		gates: Array<{
			name: string;
			status: string;
		}>;
	}>;
	allGreen: boolean;
}

export interface MergeApplyResult {
	allowed: boolean;
	message: string;
}