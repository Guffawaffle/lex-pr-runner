#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createPlan, generateSnapshot } from "../core/plan.js";
import * as fs from "fs";
import * as path from "path";

/**
 * MCP server adapter for lex-pr-runner.
 * Expose tools:
 *  - plan.create
 * Expose resources:
 *  - .smartergpt/runner/plan.json
 *  - .smartergpt/runner/snapshot.md
 */

const server = new Server(
	{
		name: "lex-pr-runner",
		version: "0.1.0",
	},
	{
		capabilities: {
			resources: {},
			tools: {},
		},
	}
);

// Define the output directory for artifacts
const ARTIFACTS_DIR = ".smartergpt/runner";

server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			{
				name: "plan.create",
				description: "Compute merge pyramid and freeze plan artifacts",
				inputSchema: {
					type: "object",
					properties: {
						out: {
							type: "string",
							description: "Artifacts output directory",
							default: ARTIFACTS_DIR,
						},
					},
					additionalProperties: false,
				},
			},
		],
	};
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	switch (request.params.name) {
		case "plan.create": {
			const outDir = (request.params.arguments?.out as string) || ARTIFACTS_DIR;
			
			// Create plan and generate artifacts
			const plan = await createPlan();
			fs.mkdirSync(outDir, { recursive: true });
			
			// Write plan.json
			const planPath = path.join(outDir, "plan.json");
			fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
			
			// Write snapshot.md
			const snapshot = await generateSnapshot(plan);
			const snapshotPath = path.join(outDir, "snapshot.md");
			fs.writeFileSync(snapshotPath, snapshot);
			
			// Return plan metadata and URIs
			const planUri = `file://${path.resolve(planPath)}`;
			const snapshotUri = `file://${path.resolve(snapshotPath)}`;
			
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							success: true,
							plan: plan,
							artifacts: {
								"plan.json": {
									path: planPath,
									uri: planUri,
									size: fs.statSync(planPath).size,
								},
								"snapshot.md": {
									path: snapshotPath,
									uri: snapshotUri,
									size: fs.statSync(snapshotPath).size,
								},
							},
							message: `Generated plan with ${plan.items.length} items targeting ${plan.target}`,
						}, null, 2),
					},
				],
			};
		}
		
		default:
			throw new Error(`Unknown tool: ${request.params.name}`);
	}
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
	const resources = [];
	
	// Check if artifacts exist and add them as resources
	const planPath = path.join(ARTIFACTS_DIR, "plan.json");
	const snapshotPath = path.join(ARTIFACTS_DIR, "snapshot.md");
	
	if (fs.existsSync(planPath)) {
		resources.push({
			uri: `file://${path.resolve(planPath)}`,
			name: "plan.json",
			description: "Structured plan data with merge pyramid information",
			mimeType: "application/json",
		});
	}
	
	if (fs.existsSync(snapshotPath)) {
		resources.push({
			uri: `file://${path.resolve(snapshotPath)}`,
			name: "snapshot.md",
			description: "Human-readable plan summary and metadata",
			mimeType: "text/markdown",
		});
	}
	
	return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
	const uri = request.params.uri;
	
	if (!uri.startsWith("file://")) {
		throw new Error(`Unsupported URI scheme: ${uri}`);
	}
	
	const filePath = uri.replace("file://", "");
	
	// Security check: only allow reading from artifacts directory
	const resolvedPath = path.resolve(filePath);
	const artifactsPath = path.resolve(ARTIFACTS_DIR);
	
	if (!resolvedPath.startsWith(artifactsPath)) {
		throw new Error(`Access denied: ${uri}`);
	}
	
	if (!fs.existsSync(resolvedPath)) {
		throw new Error(`Resource not found: ${uri}`);
	}
	
	const content = fs.readFileSync(resolvedPath, "utf-8");
	const mimeType = resolvedPath.endsWith(".json") ? "application/json" : "text/markdown";
	
	return {
		contents: [
			{
				uri,
				mimeType,
				text: content,
			},
		],
	};
});

// Start the server
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("Lex-PR Runner MCP server running on stdio");
}

main().catch((error) => {
	console.error("Server error:", error);
	process.exit(1);
});
