#!/usr/bin/env node

/**
 * MCP server adapter for lex-pr-runner
 * Exposes read-only tools for plan creation, gate execution, and merge operations
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ErrorCode,
	ListToolsRequestSchema,
	McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { loadInputs } from "../core/inputs.js";
import { generatePlan } from "../core/plan.js";
import { generateSnapshot } from "../core/snapshot.js";
import { canonicalJSONStringify } from "../util/canonicalJson.js";
import { executeGatesWithPolicy } from "../gates.js";
import { ExecutionState } from "../executionState.js";
import { MergeEligibilityEvaluator } from "../mergeEligibility.js";
import { loadPlan, validatePlan } from "../schema.js";
import { initLocalOverlay } from "../config/localOverlay.js";
import {
	getMCPEnvironment,
	PlanCreateArgs,
	GatesRunArgs,
	MergeApplyArgs,
	InitLocalArgs,
	ProfileResolveArgs,
	PlanCreateResult,
	GatesRunResult,
	MergeApplyResult,
	InitLocalResult,
	ProfileResolveResult,
} from "./types.js";
import { resolveProfile, validateWriteOperation, WriteProtectionError } from "../config/profileResolver.js";

import * as fs from "fs";
import * as path from "path";

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
	const server = new Server(
		{
			name: "lex-pr-runner",
			version: "0.1.0",
		},
		{
			capabilities: {
				tools: {},
			},
		}
	);

	// List available tools
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return {
			tools: [
				{
					name: "plan.create",
					description: "Create a plan from configuration files",
					inputSchema: {
						type: "object",
						properties: {
							json: {
								type: "boolean",
								description: "Output plan as JSON to stdout",
								default: false,
							},
							outDir: {
								type: "string",
								description: "Output directory for plan artifacts",
							},
						},
					},
				},
				{
					name: "gates.run",
					description: "Execute gates for plan items",
					inputSchema: {
						type: "object",
						properties: {
							onlyItem: {
								type: "string",
								description: "Run gates for specific item only",
							},
							onlyGate: {
								type: "string",
								description: "Run specific gate only",
							},
							outDir: {
								type: "string",
								description: "Output directory for gate results",
							},
						},
					},
				},
				{
					name: "merge.apply",
					description: "Apply merge operations (requires ALLOW_MUTATIONS=true)",
					inputSchema: {
						type: "object",
						properties: {
							dryRun: {
								type: "boolean",
								description: "Simulate merge without making changes",
								default: true,
							},
						},
					},
				},
				{
					name: "local.init",
					description: "Initialize local overlay directory with auto-detected project configuration",
					inputSchema: {
						type: "object",
						properties: {
							force: {
								type: "boolean",
								description: "Force recreation even if local overlay exists",
								default: false,
							},
						},
					},
				},
				{
					name: "profile.resolve",
					description: "Resolve profile directory using precedence chain (--profile-dir → LEX_PR_PROFILE_DIR → .smartergpt.local/ → .smartergpt/)",
					inputSchema: {
						type: "object",
						properties: {
							profileDir: {
								type: "string",
								description: "Optional profile directory override",
							},
						},
					},
				},
			],
		};
	});

	// Handle tool calls
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;

		switch (name) {
			case "plan.create":
				return await handlePlanCreate(args as PlanCreateArgs);

			case "gates.run":
				return await handleGatesRun(args as GatesRunArgs);

			case "merge.apply":
				return await handleMergeApply(args as MergeApplyArgs);

			case "local.init":
				return await handleLocalInit(args as InitLocalArgs);

			case "profile.resolve":
				return await handleProfileResolve(args as ProfileResolveArgs);

			default:
				throw new McpError(
					ErrorCode.MethodNotFound,
					`Unknown tool: ${name}`
				);
		}
	});

	return server;
}

/**
 * Handle plan.create tool
 */
async function handlePlanCreate(args: PlanCreateArgs): Promise<{ content: [{ type: "text", text: string }] }> {
	try {
		const env = getMCPEnvironment();

		// Resolve profile and validate write permissions
		const resolved = resolveProfile(undefined, process.cwd());
		const profilePath = resolved.path;
		const role = resolved.manifest.role;

		// Load inputs from the profile directory
		const inputs = loadInputs(profilePath);

		// Generate plan
		const plan = generatePlan(inputs);

		// Determine output directory
		const outDir = args.outDir || path.join(profilePath, "runner");

		// Validate write operation is allowed
		validateWriteOperation(profilePath, role, "write plan artifacts");

		// Ensure output directory exists
		if (!fs.existsSync(outDir)) {
			fs.mkdirSync(outDir, { recursive: true });
		}

		// Write plan.json
		const planPath = path.join(outDir, "plan.json");
		const planJson = canonicalJSONStringify(plan);
		fs.writeFileSync(planPath, planJson + "\n");

		// Generate snapshot
		const snapshot = generateSnapshot(plan, inputs);
		const snapshotPath = path.join(outDir, "snapshot.md");
		fs.writeFileSync(snapshotPath, snapshot);

		const result: PlanCreateResult = {
			plan: plan,
			outDir: outDir
		};

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2)
				}
			]
		};

	} catch (error) {
		if (error instanceof WriteProtectionError) {
			throw new McpError(
				ErrorCode.InvalidRequest,
				error.message
			);
		}
		throw new McpError(
			ErrorCode.InternalError,
			`Failed to create plan: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Handle gates.run tool
 */
async function handleGatesRun(args: GatesRunArgs): Promise<{ content: [{ type: "text", text: string }] }> {
	try {
		const env = getMCPEnvironment();

		// Resolve profile directory
		const resolved = resolveProfile(env.LEX_PR_PROFILE_DIR, process.cwd());

		// Load plan from resolved profile directory
		const planPath = path.join(resolved.path, "runner", "plan.json");
		if (!fs.existsSync(planPath)) {
			throw new Error("No plan found. Run plan.create first.");
		}

		const planContent = fs.readFileSync(planPath, "utf-8");
		const plan = loadPlan(planContent);

		// Create execution state
		const executionState = new ExecutionState(plan);

		// Determine output directory
		const outDir = args.outDir || path.join(resolved.path, "runner", "gates");

		// Execute gates (this modifies executionState in place)
		await executeGatesWithPolicy(
			plan,
			executionState,
			outDir
		);

		// Get results from execution state
		const results = executionState.getResults();

		// Transform results to expected format
		const items = [];
		let allGreen = true;

		for (const [itemName, nodeResult] of results) {
			// Filter by onlyItem if specified
			if (args.onlyItem && itemName !== args.onlyItem) {
				continue;
			}

			// Filter gates by onlyGate if specified
			const gates = nodeResult.gates?.filter(gate =>
				!args.onlyGate || gate.gate === args.onlyGate
			).map((gate: any) => ({
				name: gate.gate,
				status: gate.status
			})) || [];

			const itemResult = {
				name: itemName,
				status: nodeResult.status || "unknown",
				gates: gates
			};

			items.push(itemResult);

			if (nodeResult.status !== "pass") {
				allGreen = false;
			}
		}

		const result: GatesRunResult = {
			items,
			allGreen
		};

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2)
				}
			]
		};

	} catch (error) {
		throw new McpError(
			ErrorCode.InternalError,
			`Failed to run gates: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Handle merge.apply tool
 */
async function handleMergeApply(args: MergeApplyArgs): Promise<{ content: [{ type: "text", text: string }] }> {
	try {
		const env = getMCPEnvironment();

		// Check if mutations are allowed
		if (!env.ALLOW_MUTATIONS && !args.dryRun) {
			const result: MergeApplyResult = {
				allowed: false,
				message: "Mutations not allowed. Set ALLOW_MUTATIONS=true or use dryRun=true."
			};

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2)
					}
				]
			};
		}

		// Resolve profile directory
		const resolved = resolveProfile(env.LEX_PR_PROFILE_DIR, process.cwd());

		// Load plan and execution state
		const planPath = path.join(resolved.path, "runner", "plan.json");
		if (!fs.existsSync(planPath)) {
			throw new Error("No plan found. Run plan.create first.");
		}

		const planContent = fs.readFileSync(planPath, "utf-8");
		const plan = loadPlan(planContent);

		const executionState = new ExecutionState(plan);

		// TODO: Load actual execution results if available
		// For now, assume we're in read-only mode

		const evaluator = new MergeEligibilityEvaluator(plan, executionState);
		const decisions = evaluator.evaluateAllNodes();

		const summary = evaluator.getMergeSummary();

		const result: MergeApplyResult = {
			allowed: env.ALLOW_MUTATIONS && !args.dryRun,
			message: args.dryRun
				? `Dry run: ${summary.eligible.length} items eligible, ${summary.failed.length} failed`
				: env.ALLOW_MUTATIONS
					? `Ready to merge ${summary.eligible.length} eligible items`
					: "Mutations disabled. Set ALLOW_MUTATIONS=true to enable merging."
		};

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2)
				}
			]
		};

	} catch (error) {
		throw new McpError(
			ErrorCode.InternalError,
			`Failed to apply merge: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Handle local.init tool
 */
async function handleLocalInit(args: InitLocalArgs): Promise<{ content: [{ type: "text", text: string }] }> {
	try {
		const force = args.force ?? false;
		const result = initLocalOverlay(process.cwd(), force);

		const output: InitLocalResult = {
			created: result.created,
			path: result.path,
			config: result.config,
			copiedFiles: result.copiedFiles
		};

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(output, null, 2)
				}
			]
		};

	} catch (error) {
		throw new McpError(
			ErrorCode.InternalError,
			`Failed to initialize local overlay: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Handle profile.resolve tool
 */
async function handleProfileResolve(args: ProfileResolveArgs): Promise<{ content: [{ type: "text", text: string }] }> {
	try {
		const env = getMCPEnvironment();

		// Use profile directory from args, or fall back to env, or use resolveProfile default logic
		const profileDirOverride = args.profileDir || env.LEX_PR_PROFILE_DIR;
		const resolved = resolveProfile(profileDirOverride, process.cwd());

		const output: ProfileResolveResult = {
			path: resolved.path,
			source: resolved.source,
			manifest: {
				role: resolved.manifest.role,
				name: resolved.manifest.name,
				version: resolved.manifest.version
			}
		};

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(output, null, 2)
				}
			]
		};

	} catch (error) {
		throw new McpError(
			ErrorCode.InternalError,
			`Failed to resolve profile: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Main server startup
 */
async function main() {
	const server = createServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);

	// Log to stderr so it doesn't interfere with MCP protocol
	console.error("MCP server started for lex-pr-runner");
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
	console.error("Uncaught exception:", error);
	process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled rejection at:", promise, "reason:", reason);
	process.exit(1);
});

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error("Failed to start MCP server:", error);
		process.exit(1);
	});
}

export { createServer };
