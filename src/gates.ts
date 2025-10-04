import { spawn } from "child_process";
import { Plan, Gate, PlanItem, Policy, GateResult, GateStatus, RetryConfig } from "./schema.js";
import { ExecutionState } from "./executionState.js";
import path from "path";
import fs from "fs";
<<<<<<< HEAD
import { classifyError, formatErrorForUser, ErrorType } from "./core/errorRecovery.js";
||||||| eb067ce
=======
import { MemoryMonitor, OperationCache } from "./performance.js";
import { metrics, METRICS } from "./monitoring/metrics.js";
>>>>>>> origin/copilot/fix-e5c8d1fa-1689-4596-b747-e58071cfe83e

/**
 * Gate execution with local command running, retry logic, and policy-aware execution
 */

/**
 * Execute a single gate with retry logic and artifact collection
 */
export async function executeGate(
	gate: Gate,
	policy: Policy,
	artifactDir: string,
	timeoutMs: number = 30000
): Promise<GateResult> {
	const retryConfig = policy.retries[gate.name] || { maxAttempts: 1, backoffSeconds: 0 };
	let lastResult: GateResult | null = null;

	for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
		// Add backoff delay for retries
		if (attempt > 1 && retryConfig.backoffSeconds > 0) {
			const delayMs = retryConfig.backoffSeconds * 1000;
			console.log(`⏳ Retrying gate '${gate.name}' (attempt ${attempt}/${retryConfig.maxAttempts}) after ${retryConfig.backoffSeconds}s delay...`);
			await new Promise(resolve => setTimeout(resolve, delayMs));
		}

		const result = await executeGateAttempt(gate, artifactDir, attempt, timeoutMs);
		lastResult = result;

		// If successful, return immediately
		if (result.status === "pass") {
			if (attempt > 1) {
				console.log(`✅ Gate '${gate.name}' succeeded on attempt ${attempt}`);
			}
			return result;
		}

		// Classify the error to determine if we should retry
		if (result.stderr) {
			const error = new Error(result.stderr);
			const classified = classifyError(error, `Gate '${gate.name}' execution`);
			
			// Log error classification for diagnostics
			if (classified.type === ErrorType.Permanent) {
				console.error(`❌ Gate '${gate.name}' failed with permanent error - not retrying`);
				console.error(formatErrorForUser(classified));
				return result;
			} else if (classified.type === ErrorType.Transient && attempt < retryConfig.maxAttempts) {
				console.warn(`⚠️  Gate '${gate.name}' failed with transient error - will retry`);
			}
		}

		// If this is the last attempt, return the result
		if (attempt === retryConfig.maxAttempts) {
			if (attempt > 1) {
				console.error(`❌ Gate '${gate.name}' failed after ${attempt} attempts`);
			}
			return result;
		}

		// Mark as retrying for intermediate attempts
		result.status = "retrying";
	}

	return lastResult!;
}

/**
 * Execute a single gate attempt
 */
async function executeGateAttempt(
	gate: Gate,
	artifactDir: string,
	attempt: number,
	timeoutMs: number
): Promise<GateResult> {
	const startedAt = new Date().toISOString();
	const startTime = Date.now();

	// Handle different runtime modes
	switch (gate.runtime) {
		case "container":
			return executeContainerGate(gate, artifactDir, attempt, startedAt, startTime, timeoutMs);
		case "ci-service":
			return executeCiServiceGate(gate, artifactDir, attempt, startedAt, startTime);
		case "local":
		default:
			return executeLocalGate(gate, artifactDir, attempt, startedAt, startTime, timeoutMs);
	}
}

/**
 * Execute gate locally
 */
async function executeLocalGate(
	gate: Gate,
	artifactDir: string,
	attempt: number,
	startedAt: string,
	startTime: number,
	timeoutMs: number
): Promise<GateResult> {
	return new Promise((resolve) => {
		let timedOut = false;

		const childProcess = spawn('bash', ['-c', gate.run], {
			cwd: gate.cwd || process.cwd(),
			env: { ...process.env, ...gate.env },
			stdio: ['pipe', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		childProcess.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		childProcess.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		const timeout = setTimeout(() => {
			timedOut = true;
			childProcess.kill('SIGTERM');
			setTimeout(() => childProcess.kill('SIGKILL'), 5000);
		}, timeoutMs);

		childProcess.on('close', (exitCode) => {
			clearTimeout(timeout);
			const duration = Date.now() - startTime;

			// Collect artifacts if specified
			const artifacts = collectArtifacts(gate, artifactDir);

			resolve({
				gate: gate.name,
				status: (exitCode === 0 && !timedOut) ? "pass" : "fail",
				exitCode: exitCode || 0,
				duration,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				artifacts,
				attempts: attempt,
				lastAttempt: startedAt
			});
		});

		childProcess.on('error', (error) => {
			clearTimeout(timeout);
			const duration = Date.now() - startTime;

			// Classify the error for better diagnostics
			const classified = classifyError(error, `Gate '${gate.name}' process error`);
			console.error(formatErrorForUser(classified));

			resolve({
				gate: gate.name,
				status: "fail",
				exitCode: 1,
				duration,
				stdout: stdout.trim(),
				stderr: `${classified.context}: ${error.message}`,
				artifacts: [],
				attempts: attempt,
				lastAttempt: startedAt
			});
		});
	});
}

/**
 * Execute gate in container (placeholder for future implementation)
 */
async function executeContainerGate(
	gate: Gate,
	artifactDir: string,
	attempt: number,
	startedAt: string,
	startTime: number,
	timeoutMs: number
): Promise<GateResult> {
	// TODO: Implement container execution using Docker/Podman
	// For now, fall back to local execution with warning
	console.warn(`⚠️  Container runtime for gate '${gate.name}' not yet implemented, falling back to local execution`);
	return executeLocalGate(gate, artifactDir, attempt, startedAt, startTime, timeoutMs);
}

/**
 * Execute gate as CI service (placeholder for future implementation)
 */
async function executeCiServiceGate(
	gate: Gate,
	artifactDir: string,
	attempt: number,
	startedAt: string,
	startTime: number
): Promise<GateResult> {
	// TODO: Implement CI service execution (e.g., GitHub Actions API)
	// For now, mark as skipped with informative message
	console.warn(`⚠️  CI service runtime for gate '${gate.name}' not yet implemented, marking as skipped`);
	return {
		gate: gate.name,
		status: "skipped",
		duration: Date.now() - startTime,
		stdout: "CI service execution not yet implemented - graceful degradation",
		stderr: "This gate requires CI service integration which is not available",
		artifacts: [],
		attempts: attempt,
		lastAttempt: startedAt
	};
}

/**
 * Collect artifacts from gate execution
 */
function collectArtifacts(gate: Gate, artifactDir: string): string[] {
	if (!gate.artifacts || gate.artifacts.length === 0) {
		return [];
	}

	const collected: string[] = [];
	const gateArtifactDir = path.join(artifactDir, gate.name);

	// Ensure artifact directory exists
	if (!fs.existsSync(gateArtifactDir)) {
		fs.mkdirSync(gateArtifactDir, { recursive: true });
	}

	for (const artifactPath of gate.artifacts) {
		try {
			if (fs.existsSync(artifactPath)) {
				const destPath = path.join(gateArtifactDir, path.basename(artifactPath));
				fs.copyFileSync(artifactPath, destPath);
				collected.push(destPath);
			}
		} catch (error) {
			console.warn(`Failed to collect artifact ${artifactPath}:`, error);
		}
	}

	return collected;
}

/**
 * Execute all gates for a specific item with policy-aware execution
 */
export async function executeItemGates(
	item: PlanItem,
	policy: Policy,
	executionState: ExecutionState,
	artifactDir: string,
	timeoutMs: number = 30000
): Promise<GateResult[]> {
	if (!item.gates || item.gates.length === 0) {
		return [];
	}

	const results: GateResult[] = [];
	const itemArtifactDir = path.join(artifactDir, item.name);

	// Ensure item artifact directory exists
	if (!fs.existsSync(itemArtifactDir)) {
		fs.mkdirSync(itemArtifactDir, { recursive: true });
	}

	for (const gate of item.gates) {
		// Check if gate should be blocked based on policy
		if (shouldBlockGate(gate, policy)) {
			const blockedResult: GateResult = {
				gate: gate.name,
				status: "blocked",
				duration: 0,
				stdout: "",
				stderr: "Gate blocked by policy",
				artifacts: [],
				attempts: 0,
				lastAttempt: new Date().toISOString()
			};
			results.push(blockedResult);
			executionState.updateGateResult(item.name, blockedResult);
			continue;
		}

		const result = await executeGate(gate, policy, itemArtifactDir, timeoutMs);
		results.push(result);

		// Update execution state
		executionState.updateGateResult(item.name, result);
	}

	return results;
}

/**
 * Check if a gate should be blocked based on policy
 */
function shouldBlockGate(gate: Gate, policy: Policy): boolean {
	// Check if gate name matches any blocked patterns
	for (const blockPattern of policy.blockOn) {
		if (gate.name.includes(blockPattern)) {
			return true;
		}
	}
	return false;
}

/**
 * Execute gates for multiple items with concurrency control and dependency ordering
 */
export async function executeGatesWithPolicy(
	plan: Plan,
	executionState: ExecutionState,
	artifactDir: string,
	timeoutMs: number = 30000
): Promise<void> {
	const policy = plan.policy || {
		requiredGates: [],
		optionalGates: [],
		maxWorkers: 1,
		retries: {},
		overrides: {},
		blockOn: [],
		mergeRule: { type: "strict-required" }
	};

	// Initialize performance monitoring
	const perfConfig = policy.performance || {};
	const memoryMonitor = new MemoryMonitor(perfConfig);

	// Ensure base artifact directory exists
	if (!fs.existsSync(artifactDir)) {
		fs.mkdirSync(artifactDir, { recursive: true });
	}

	// Build execution order based on dependencies
	const executionOrder = buildExecutionOrder(plan);

	// Execute gates in dependency order with concurrency control
	const maxWorkers = policy.maxWorkers;
	const pendingNodes = [...executionOrder];
	const executing = new Set<string>();
	const completedNodes = new Set<string>();

	while (completedNodes.size < executionOrder.length) {
		// Check memory and throttle if needed
		await memoryMonitor.throttleIfNeeded();

		// Find all eligible nodes that can start now
		const eligible: string[] = [];
		for (const node of pendingNodes) {
			if (executing.size >= maxWorkers) {
				break; // Hit worker limit
			}
			if (findNextEligibleNode([node], executing, executionState) === node) {
				eligible.push(node);
			}
		}

		// Start all eligible nodes
		const promises: Promise<void>[] = [];
		for (const node of eligible) {
			const nodeIndex = pendingNodes.indexOf(node);
			pendingNodes.splice(nodeIndex, 1);
			executing.add(node);
			
			// Update active workers metric
			metrics.setGauge(METRICS.ACTIVE_WORKERS, executing.size);

			const item = plan.items.find(i => i.name === node)!;
			const promise = executeItemGates(item, policy, executionState, artifactDir, timeoutMs)
				.then(() => {
					executing.delete(node);
					completedNodes.add(node);
					metrics.setGauge(METRICS.ACTIVE_WORKERS, executing.size);
					executionState.propagateBlockedStatus();
				})
				.catch((error) => {
					console.error(`Error executing gates for ${node}:`, error);
					executing.delete(node);
					completedNodes.add(node);
					metrics.setGauge(METRICS.ACTIVE_WORKERS, executing.size);
				});

			promises.push(promise);
		}

		// Wait for at least one to complete before checking for more work
		if (promises.length > 0) {
			await Promise.race(promises);
		} else if (executing.size > 0) {
			// No new eligible nodes, but some are still executing
			await new Promise(resolve => setTimeout(resolve, 50));
		} else {
			// No executing and no eligible - should not happen if graph is valid
			break;
		}
	}

	// Final wait for any remaining workers
	while (executing.size > 0) {
		await new Promise(resolve => setTimeout(resolve, 50));
	}
}

/**
 * Build execution order based on topological sort
 */
function buildExecutionOrder(plan: Plan): string[] {
	const visited = new Set<string>();
	const visiting = new Set<string>();
	const order: string[] = [];

	function visit(nodeName: string): void {
		if (visited.has(nodeName)) return;
		if (visiting.has(nodeName)) {
			throw new Error(`Dependency cycle detected involving node: ${nodeName}`);
		}

		visiting.add(nodeName);
		const node = plan.items.find(item => item.name === nodeName);
		if (node) {
			for (const dep of node.deps) {
				visit(dep);
			}
		}
		visiting.delete(nodeName);
		visited.add(nodeName);
		order.push(nodeName);
	}

	for (const item of plan.items) {
		visit(item.name);
	}

	return order;
}

/**
 * Find the next eligible node for execution
 */
function findNextEligibleNode(
	pending: string[],
	executing: Set<string>,
	executionState: ExecutionState
): string | null {
	for (const nodeName of pending) {
		if (executing.has(nodeName)) continue;

		const nodeResult = executionState.getNodeResult(nodeName);
		if (!nodeResult) continue;

		// Check if node is blocked
		if (nodeResult.status === "blocked" || nodeResult.status === "fail") {
			continue;
		}

		// Node is eligible if not blocked and not already executing
		return nodeName;
	}

	return null;
}
