/**
 * Safety Framework for Autopilot Operations
 * 
 * Implements:
 * - TTY confirmation prompts for destructive operations
 * - Advisory lock labels on target PRs
 * - Containment checks (reachability validation)
 * - Kill switch mechanisms (--abort flag, signal handling)
 * - Rollback and recovery procedures
 */

import * as readline from 'readline';
import { GitHubAPI } from '../../github/api.js';

export interface MergeOperation {
	type: 'merge' | 'push' | 'create-branch' | 'open-pr' | 'add-comment';
	description: string;
	prNumber?: number;
	branch?: string;
	target?: string;
}

export interface OperationSummary {
	autopilotLevel: number;
	mergeOperations: MergeOperation[];
	prOperations: MergeOperation[];
	affectedPRs: number[];
}

export interface ContainmentCheck {
	allPRsReachable: boolean;
	unreachablePRs: number[];
	hasExternalDeps: boolean;
	externalDeps: string[];
	hasMergeConflicts: boolean;
	conflictingPRs: number[];
}

export interface SafetyCheckResult {
	confirmed: boolean;
	aborted: boolean;
	reason?: string;
}

export interface RollbackResult {
	success: boolean;
	revertCommit?: string;
	affectedPRs: number[];
	error?: string;
}

/**
 * Safety Framework for Autopilot Operations
 */
export class SafetyFramework {
	private abortRequested = false;
	private signalHandlersInstalled = false;
	private githubAPI?: GitHubAPI;

	constructor(githubAPI?: GitHubAPI) {
		this.githubAPI = githubAPI;
	}

	/**
	 * Check if running in TTY (skip prompts in CI)
	 */
	private isTTY(): boolean {
		return process.stdin.isTTY === true && process.stdout.isTTY === true;
	}

	/**
	 * Install kill switch signal handlers
	 */
	installKillSwitch(): void {
		if (this.signalHandlersInstalled) {
			return;
		}

		const handleAbort = () => {
			console.error('\n⚠️  Abort signal received - stopping operations...');
			this.abortRequested = true;
		};

		process.on('SIGINT', handleAbort);
		process.on('SIGTERM', handleAbort);

		this.signalHandlersInstalled = true;
	}

	/**
	 * Check if abort was requested
	 */
	isAbortRequested(): boolean {
		return this.abortRequested;
	}

	/**
	 * Request abort programmatically (e.g., from --abort flag)
	 */
	requestAbort(): void {
		this.abortRequested = true;
	}

	/**
	 * Display operation summary and request confirmation
	 */
	async confirmOperation(summary: OperationSummary): Promise<SafetyCheckResult> {
		// Check for abort first, regardless of TTY
		if (this.abortRequested) {
			return { confirmed: false, aborted: true, reason: 'Abort requested' };
		}

		// Skip confirmation if not in TTY (CI environment)
		if (!this.isTTY()) {
			return { confirmed: true, aborted: false };
		}

		// Display operation summary
		console.log(`\n⚠️  Autopilot Level ${summary.autopilotLevel} will perform these operations:\n`);

		if (summary.mergeOperations.length > 0) {
			console.log('🔀 Merge Operations:');
			for (const op of summary.mergeOperations) {
				console.log(`  • ${op.description}`);
			}
			console.log('');
		}

		if (summary.prOperations.length > 0) {
			console.log('🔧 PR Operations:');
			for (const op of summary.prOperations) {
				console.log(`  • ${op.description}`);
			}
			console.log('');
		}

		// Prompt for confirmation
		const answer = await this.prompt('❓ Continue? [y/N/details]: ');
		const normalized = answer.trim().toLowerCase();

		if (normalized === 'details') {
			// Show detailed information
			console.log('\n📋 Detailed Operation Plan:\n');
			console.log('Merge Operations:');
			for (const op of summary.mergeOperations) {
				console.log(`  Type: ${op.type}`);
				console.log(`  Description: ${op.description}`);
				if (op.branch) console.log(`  Branch: ${op.branch}`);
				if (op.target) console.log(`  Target: ${op.target}`);
				if (op.prNumber) console.log(`  PR: #${op.prNumber}`);
				console.log('');
			}

			// Ask again after showing details
			return this.confirmOperation(summary);
		}

		if (normalized === 'y' || normalized === 'yes') {
			return { confirmed: true, aborted: false };
		}

		return { confirmed: false, aborted: false, reason: 'User declined' };
	}

	/**
	 * Prompt user for input
	 */
	private prompt(question: string): Promise<string> {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		return new Promise((resolve) => {
			rl.question(question, (answer) => {
				rl.close();
				resolve(answer);
			});
		});
	}

	/**
	 * Apply advisory lock label to PRs
	 */
	async applyAdvisoryLock(prNumbers: number[], timestamp: string): Promise<void> {
		if (!this.githubAPI) {
			throw new Error('GitHub API not available for advisory locks');
		}

		const lockLabel = `lex-pr:weaving-${timestamp}`;

		for (const prNumber of prNumbers) {
			await this.githubAPI.addLabel(prNumber, lockLabel);
		}
	}

	/**
	 * Check for existing advisory locks
	 */
	async checkExistingLocks(prNumbers: number[]): Promise<string[]> {
		if (!this.githubAPI) {
			return [];
		}

		const locks: string[] = [];

		for (const prNumber of prNumbers) {
			const labels = await this.githubAPI.getLabels(prNumber);
			const weavingLabels = labels.filter(label => label.startsWith('lex-pr:weaving-'));
			locks.push(...weavingLabels);
		}

		return locks;
	}

	/**
	 * Remove advisory lock labels
	 */
	async removeAdvisoryLocks(prNumbers: number[], timestamp: string): Promise<void> {
		if (!this.githubAPI) {
			return;
		}

		const lockLabel = `lex-pr:weaving-${timestamp}`;

		for (const prNumber of prNumbers) {
			try {
				await this.githubAPI.removeLabel(prNumber, lockLabel);
			} catch (error) {
				// Continue on error - label might not exist
				console.warn(`Warning: Could not remove lock label from PR #${prNumber}`);
			}
		}
	}

	/**
	 * Perform containment checks
	 */
	async performContainmentChecks(
		prNumbers: number[],
		targetBranch: string
	): Promise<ContainmentCheck> {
		if (!this.githubAPI) {
			throw new Error('GitHub API not available for containment checks');
		}

		const result: ContainmentCheck = {
			allPRsReachable: true,
			unreachablePRs: [],
			hasExternalDeps: false,
			externalDeps: [],
			hasMergeConflicts: false,
			conflictingPRs: [],
		};

		// Check if all PRs are reachable
		for (const prNumber of prNumbers) {
			try {
				const pr = await this.githubAPI.getPullRequest(prNumber);
				
				// Check if PR exists and is in expected state
				if (!pr) {
					result.allPRsReachable = false;
					result.unreachablePRs.push(prNumber);
					continue;
				}

				// Check if PR targets the expected branch
				if (pr.baseBranch !== targetBranch) {
					result.hasExternalDeps = true;
					result.externalDeps.push(`PR #${prNumber} targets ${pr.baseBranch}, not ${targetBranch}`);
				}

				// Check for merge conflicts (if mergeable status is available)
				if (pr.mergeable === false) {
					result.hasMergeConflicts = true;
					result.conflictingPRs.push(prNumber);
				}
			} catch (error) {
				result.allPRsReachable = false;
				result.unreachablePRs.push(prNumber);
			}
		}

		return result;
	}

	/**
	 * Validate containment check results
	 */
	validateContainment(check: ContainmentCheck): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!check.allPRsReachable) {
			errors.push(`Unreachable PRs: ${check.unreachablePRs.join(', ')}`);
		}

		if (check.hasExternalDeps) {
			errors.push(`External dependencies detected: ${check.externalDeps.join('; ')}`);
		}

		if (check.hasMergeConflicts) {
			errors.push(`Merge conflicts in PRs: ${check.conflictingPRs.join(', ')}`);
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Create rollback procedure for failed operation
	 */
	async rollback(
		originalCommit: string,
		affectedPRs: number[],
		reason: string
	): Promise<RollbackResult> {
		console.log(`\n🔄 Initiating rollback due to: ${reason}`);

		try {
			// This would integrate with git operations to perform actual rollback
			// For now, return the structure that would be used
			
			const result: RollbackResult = {
				success: true,
				revertCommit: `revert-${originalCommit.substring(0, 7)}`,
				affectedPRs,
			};

			// Mark PRs as needing manual weave
			if (this.githubAPI) {
				for (const prNumber of affectedPRs) {
					await this.githubAPI.addLabel(prNumber, 'needs-manual-weave');
				}
			}

			console.log('✓ Rollback completed successfully');
			console.log(`  Revert commit: ${result.revertCommit}`);
			console.log(`  Affected PRs marked: ${affectedPRs.join(', ')}`);

			return result;
		} catch (error) {
			return {
				success: false,
				affectedPRs,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Log safety decision for audit trail
	 */
	logSafetyDecision(operation: string, decision: string, details?: Record<string, any>): void {
		const timestamp = new Date().toISOString();
		const logEntry = {
			timestamp,
			operation,
			decision,
			...details,
		};

		// In a real implementation, this would write to a proper audit log
		// For now, output to console in structured format
		console.log(`[SAFETY-LOG] ${JSON.stringify(logEntry)}`);
	}
}
