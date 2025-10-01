/**
 * GitHub-powered plan generation
 * Auto-discovers PRs and generates plan.json from GitHub metadata
 */

import { Plan, PlanItem, Gate } from "../schema.js";
import { GitHubClient, PullRequestDetails } from "../github/index.js";
import { stableSort } from "../util/canonicalJson.js";

export interface GitHubPlanOptions {
	query?: string; // GitHub search query
	labels?: string[]; // Filter by specific labels
	includeDrafts?: boolean; // Include draft PRs
	target?: string; // Target branch (defaults to repo default)
	policy?: {
		requiredGates?: string[];
		maxWorkers?: number;
	};
}

/**
 * Generate plan from GitHub PRs with automatic dependency resolution
 */
export async function generatePlanFromGitHub(
	client: GitHubClient,
	options: GitHubPlanOptions = {}
): Promise<Plan> {
	// Validate repository access
	const repoInfo = await client.validateRepository();
	const target = options.target || repoInfo.defaultBranch;

	// Discover PRs based on query/filters
	const prs = await client.listOpenPRs({
		state: "open",
		labels: options.labels,
		// If no specific query, find PRs with stack labels or open PRs
		...(options.query ? { query: options.query } : {})
	});

	// Filter out drafts if not included
	const filteredPRs = options.includeDrafts 
		? prs 
		: prs.filter(pr => !pr.draft);

	if (filteredPRs.length === 0) {
		// Return empty plan if no PRs found
		return {
			schemaVersion: "1.0.0",
			target,
			items: []
		};
	}

	// Get detailed information for each PR
	const prDetails = await Promise.all(
		filteredPRs.map(pr => client.getPRDetails(pr.number))
	);

	// Transform PRs to plan items
	const planItems = prDetails.map(pr => transformPRToPlanItem(pr, options));

	// Sort items by name for deterministic ordering
	planItems.sort((a, b) => a.name.localeCompare(b.name));

	// Validate dependencies exist within the PR set
	validateGitHubDependencies(planItems, prDetails);

	// Build the plan
	const plan: Plan = {
		schemaVersion: "1.0.0",
		target,
		items: planItems
	};

	// Add policy if specified
	if (options.policy) {
		plan.policy = {
			requiredGates: options.policy.requiredGates || [],
			optionalGates: [],
			maxWorkers: options.policy.maxWorkers || 1,
			retries: {},
			overrides: {},
			blockOn: [],
			mergeRule: { type: "strict-required" }
		};
	}

	return plan;
}

/**
 * Transform GitHub PR to plan item
 */
function transformPRToPlanItem(pr: PullRequestDetails, options: GitHubPlanOptions): PlanItem {
	// Generate item name from PR - use PR number as identifier
	const name = `PR-${pr.number}`;

	// Extract dependencies from GitHub dependencies
	// Filter to only include dependencies that are PRs in the same repo
	const deps = pr.dependencies
		.filter((dep: string) => {
			// Only include same-repo dependencies for now
			// Dependencies like "testowner/testrepo#123" or just "#123" 
			return dep.includes('#');
		})
		.map((dep: string) => {
			// Convert dependency references to plan item names
			const prNumber = dep.includes('#') ? dep.split('#')[1] : dep;
			return `PR-${prNumber}`;
		});

	// Generate gates from PR metadata
	const gates = generateGatesFromPR(pr, options);

	return {
		name,
		deps: stableSort(deps),
		gates
	};
}

/**
 * Generate gates configuration from PR metadata
 */
function generateGatesFromPR(pr: PullRequestDetails, options: GitHubPlanOptions): Gate[] {
	const gates: Gate[] = [];

	// Use required gates from PR if specified, otherwise use policy defaults
	const requiredGates = pr.requiredGates.length > 0 
		? pr.requiredGates 
		: options.policy?.requiredGates || ["lint", "test"];

	// Generate standard gates
	for (const gateName of requiredGates) {
		gates.push(createStandardGate(gateName, pr));
	}

	// Sort gates by name for deterministic output
	gates.sort((a, b) => a.name.localeCompare(b.name));

	return gates;
}

/**
 * Create standard gate configuration
 */
function createStandardGate(gateName: string, pr: PullRequestDetails): Gate {
	const baseGate: Gate = {
		name: gateName,
		run: getStandardGateCommand(gateName),
		env: {
			PR_NUMBER: pr.number.toString(),
			PR_BRANCH: pr.head.ref,
			PR_SHA: pr.head.sha
		},
		runtime: "local",
		artifacts: []
	};

	// Add specific configurations for common gates
	switch (gateName) {
		case "lint":
			return {
				...baseGate,
				run: "npm run lint",
				artifacts: ["lint-results.txt"]
			};
		case "test":
		case "unit":
			return {
				...baseGate,
				run: "npm test",
				artifacts: ["test-results.xml", "coverage/"]
			};
		case "typecheck":
			return {
				...baseGate,
				run: "npm run typecheck",
				artifacts: ["typecheck-results.txt"]
			};
		case "build":
			return {
				...baseGate,
				run: "npm run build",
				artifacts: ["dist/", "build-log.txt"]
			};
		default:
			return baseGate;
	}
}

/**
 * Get default command for standard gate types
 */
function getStandardGateCommand(gateName: string): string {
	const standardCommands: Record<string, string> = {
		lint: "npm run lint",
		test: "npm test",
		unit: "npm test",
		typecheck: "npm run typecheck",
		build: "npm run build",
		format: "npm run format"
	};

	return standardCommands[gateName] || `echo "Running ${gateName} gate"`;
}

/**
 * Validate that GitHub dependencies reference PRs that exist in the plan
 */
function validateGitHubDependencies(planItems: PlanItem[], prDetails: PullRequestDetails[]): void {
	const itemNames = new Set(planItems.map(item => item.name));
	const prNumbers = new Set(prDetails.map(pr => `PR-${pr.number}`));

	for (const item of planItems) {
		for (const dep of item.deps) {
			if (!itemNames.has(dep)) {
				// Check if it's a PR reference that might exist but not in our current set
				if (dep.startsWith('PR-')) {
					const prNumber = dep.substring(3);
					console.warn(`Warning: Dependency ${dep} not found in current PR set. PR #${prNumber} may be closed or not match filters.`);
				} else {
					throw new Error(`Unknown dependency '${dep}' for item '${item.name}'`);
				}
			}
		}
	}
}