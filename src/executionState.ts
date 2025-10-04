/**
 * Execution state management for the lex-pr-runner
 * Handles status tracking, propagation, and merge eligibility
 * Includes error diagnostics and recovery tracking
 */

import { Plan, PlanItem, Policy, NodeResult, GateResult, NodeStatus, GateStatus } from './schema.js';
import { classifyError, ClassifiedError } from './core/errorRecovery.js';

/**
 * Error diagnostic information
 */
export interface ErrorDiagnostic {
	nodeName: string;
	gateName: string;
	classified: ClassifiedError;
	timestamp: string;
	attemptNumber: number;
}

/**
 * Execution state manager with error tracking
 */
export class ExecutionState {
	private results: Map<string, NodeResult> = new Map();
	private plan: Plan;
	private policy: Policy;
	private errorDiagnostics: ErrorDiagnostic[] = [];

	constructor(plan: Plan) {
		this.plan = plan;
		// Use default policy values if not provided
		this.policy = plan.policy || {
			requiredGates: [],
			optionalGates: [],
			maxWorkers: 1,
			retries: {},
			overrides: {},
			blockOn: [],
			mergeRule: { type: "strict-required" }
		};

		// Initialize node results
		for (const item of plan.items) {
			this.results.set(item.name, {
				name: item.name,
				status: "skipped", // Start with skipped, will be updated during execution
				gates: [],
				eligibleForMerge: false
			});
		}
	}

	/**
	 * Record error diagnostic for troubleshooting
	 */
	recordErrorDiagnostic(nodeName: string, gateName: string, error: Error, attemptNumber: number): void {
		const classified = classifyError(error, `Gate '${gateName}' in node '${nodeName}'`);
		this.errorDiagnostics.push({
			nodeName,
			gateName,
			classified,
			timestamp: new Date().toISOString(),
			attemptNumber
		});
	}

	/**
	 * Get error diagnostics
	 */
	getErrorDiagnostics(): ErrorDiagnostic[] {
		return [...this.errorDiagnostics];
	}

	/**
	 * Get summary of errors by type
	 */
	getErrorSummary(): { transient: number; permanent: number; unknown: number } {
		const summary = { transient: 0, permanent: 0, unknown: 0 };
		for (const diagnostic of this.errorDiagnostics) {
			switch (diagnostic.classified.type) {
				case 'transient':
					summary.transient++;
					break;
				case 'permanent':
					summary.permanent++;
					break;
				case 'unknown':
					summary.unknown++;
					break;
			}
		}
		return summary;
	}

	/**
	 * Update gate result for a node
	 */
	updateGateResult(nodeName: string, gateResult: GateResult): void {
		const nodeResult = this.results.get(nodeName);
		if (!nodeResult) {
			throw new Error(`Node not found: ${nodeName}`);
		}

		// Update or add gate result
		const existingIndex = nodeResult.gates.findIndex(g => g.gate === gateResult.gate);
		if (existingIndex >= 0) {
			nodeResult.gates[existingIndex] = gateResult;
		} else {
			nodeResult.gates.push(gateResult);
		}

		// Update node status based on gate results
		this.updateNodeStatus(nodeName);
	}

	/**
	 * Update node status based on its gate results and policy
	 */
	private updateNodeStatus(nodeName: string): void {
		const nodeResult = this.results.get(nodeName)!;
		const item = this.plan.items.find(i => i.name === nodeName)!;

		// Get required gates for this node (from policy or item)
		const requiredGates = this.getRequiredGatesForNode(item);

		if (requiredGates.length === 0) {
			// No gates required, node passes
			nodeResult.status = "pass";
			nodeResult.eligibleForMerge = true;
			return;
		}

		// Check gate results
		const gateResults = new Map(nodeResult.gates.map(g => [g.gate, g]));
		let hasFailedGate = false;
		let hasRetryingGate = false;
		let allRequiredGatesPassed = true;

		for (const gateName of requiredGates) {
			const result = gateResults.get(gateName);
			if (!result) {
				// Gate hasn't been executed yet
				allRequiredGatesPassed = false;
				continue;
			}

			switch (result.status) {
				case "fail":
					hasFailedGate = true;
					allRequiredGatesPassed = false;
					break;
				case "retrying":
					hasRetryingGate = true;
					allRequiredGatesPassed = false;
					break;
				case "blocked":
				case "skipped":
					allRequiredGatesPassed = false;
					break;
				case "pass":
					// Continue checking other gates
					break;
			}
		}

		// Update status based on gate results
		if (hasFailedGate) {
			nodeResult.status = "fail";
			nodeResult.eligibleForMerge = false;
		} else if (hasRetryingGate) {
			nodeResult.status = "retrying";
			nodeResult.eligibleForMerge = false;
		} else if (allRequiredGatesPassed) {
			nodeResult.status = "pass";
			nodeResult.eligibleForMerge = true;
		} else {
			// Some gates still pending
			nodeResult.status = "skipped";
			nodeResult.eligibleForMerge = false;
		}
	}

	/**
	 * Propagate blocked status to dependent nodes
	 */
	propagateBlockedStatus(): void {
		const dependencyMap = this.buildDependencyMap();

		for (const [nodeName, nodeResult] of this.results) {
			const item = this.plan.items.find(i => i.name === nodeName)!;

			// Check if any dependencies are blocked or failed
			const blockedBy: string[] = [];
			for (const depName of item.deps) {
				const depResult = this.results.get(depName);
				if (depResult && (depResult.status === "fail" || depResult.status === "blocked")) {
					blockedBy.push(depName);
				}
			}

			if (blockedBy.length > 0) {
				nodeResult.status = "blocked";
				nodeResult.blockedBy = blockedBy;
				nodeResult.eligibleForMerge = false;

				// Mark all gates as blocked
				for (const gate of nodeResult.gates) {
					if (gate.status !== "pass" && gate.status !== "fail") {
						gate.status = "blocked";
					}
				}
			}
		}
	}

	/**
	 * Get required gates for a node based on policy and node configuration
	 */
	private getRequiredGatesForNode(item: PlanItem): string[] {
		// Start with policy-defined required gates
		const required = [...(this.policy.requiredGates || [])];

		// Add node-specific gates if defined
		if (item.gates) {
			for (const gate of item.gates) {
				if (!required.includes(gate.name)) {
					required.push(gate.name);
				}
			}
		}

		return required;
	}

	/**
	 * Build dependency map for the plan
	 */
	private buildDependencyMap(): Map<string, string[]> {
		const dependencyMap = new Map<string, string[]>();

		for (const item of this.plan.items) {
			dependencyMap.set(item.name, [...item.deps]);
		}

		return dependencyMap;
	}

	/**
	 * Get current results
	 */
	getResults(): Map<string, NodeResult> {
		return new Map(this.results);
	}

	/**
	 * Get result for specific node
	 */
	getNodeResult(nodeName: string): NodeResult | undefined {
		return this.results.get(nodeName);
	}

	/**
	 * Get nodes eligible for merge
	 */
	getEligibleNodes(): string[] {
		const eligible: string[] = [];
		for (const [name, result] of this.results) {
			if (result.eligibleForMerge) {
				eligible.push(name);
			}
		}
		return eligible;
	}

	/**
	 * Check if all nodes are complete (passed, failed, or blocked)
	 */
	isExecutionComplete(): boolean {
		for (const result of this.results.values()) {
			if (result.status === "skipped" || result.status === "retrying") {
				return false;
			}
		}
		return true;
	}
}
