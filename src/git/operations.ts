/**
 * Git operations for merge pyramid execution
 * Implements weave strategy and conflict detection
 */

import { simpleGit, SimpleGit, MergeResult as GitMergeResult } from "simple-git";
import { Plan, PlanItem } from "../schema.js";

export interface MergeOperation {
	item: PlanItem;
	targetBranch: string;
	strategy: "rebase-weave" | "merge-weave" | "squash-weave";
}

export interface WeaveResult {
	success: boolean;
	item: PlanItem;
	conflicts?: string[];
	sha?: string;
	message?: string;
}

export interface WeaveExecutionResult {
	operations: WeaveResult[];
	successful: number;
	failed: number;
	conflicts: number;
	totalOperations: number;
}

/**
 * Git operations manager for merge pyramid execution
 */
export class GitOperations {
	private git: SimpleGit;
	private workingDir: string;

	constructor(workingDir: string = process.cwd()) {
		this.workingDir = workingDir;
		this.git = simpleGit(workingDir);
	}

	/**
	 * Check if git repository is in a clean state
	 */
	async isClean(): Promise<boolean> {
		try {
			const status = await this.git.status();
			return status.files.length === 0;
		} catch (error) {
			throw new GitOperationError(`Failed to check git status: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Get current branch name
	 */
	async getCurrentBranch(): Promise<string> {
		try {
			const status = await this.git.status();
			return status.current || 'HEAD';
		} catch (error) {
			throw new GitOperationError(`Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Create and checkout a new branch for weave operations
	 */
	async createWeaveBranch(baseBranch: string = 'main'): Promise<string> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const branchName = `weave/integration-${timestamp}`;

		try {
			// Ensure we're on the base branch and it's up to date
			await this.git.checkout(baseBranch);
			await this.git.pull('origin', baseBranch);

			// Create new branch
			await this.git.checkoutLocalBranch(branchName);

			return branchName;
		} catch (error) {
			throw new GitOperationError(`Failed to create weave branch: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Execute a single merge operation with conflict detection
	 */
	async executeMergeOperation(operation: MergeOperation): Promise<WeaveResult> {
		try {
			const { item, strategy } = operation;
			const branchName = item.name; // Assuming item.name is the branch name

			// Check if branch exists
			const branches = await this.git.branch(['-a']);
			const branchExists = branches.all.some(branch => 
				branch.includes(branchName) || branch.includes(`origin/${branchName}`)
			);

			if (!branchExists) {
				return {
					success: false,
					item,
					message: `Branch ${branchName} not found`,
				};
			}

			// Fetch latest changes
			await this.git.fetch('origin', branchName);

			let gitMergeResult: any;
			let sha: string | undefined;

			switch (strategy) {
				case "merge-weave":
					gitMergeResult = await this.git.merge([`origin/${branchName}`, '--no-ff']);
					break;
				
				case "squash-weave":
					gitMergeResult = await this.git.merge([`origin/${branchName}`, '--squash']);
					if (gitMergeResult && !gitMergeResult.failed) {
						// For squash merges, we need to commit manually
						await this.git.commit(`Squash merge: ${item.name}`);
					}
					break;
				
				case "rebase-weave":
					// For rebase weave, we actually merge with --ff-only after rebasing
					try {
						await this.git.rebase([`origin/${branchName}`]);
						gitMergeResult = await this.git.merge([`origin/${branchName}`, '--ff-only']);
					} catch (rebaseError) {
						return {
							success: false,
							item,
							conflicts: ['Rebase conflicts detected'],
							message: `Rebase failed: ${rebaseError instanceof Error ? rebaseError.message : String(rebaseError)}`,
						};
					}
					break;
			}

			// Get the current commit SHA after merge
			const log = await this.git.log(['-1']);
			sha = log.latest?.hash;

			// Check if merge was successful
			if (gitMergeResult?.failed) {
				const status = await this.git.status();
				const conflictedFiles = status.conflicted || [];

				return {
					success: false,
					item,
					conflicts: conflictedFiles,
					message: 'Merge conflicts detected',
				};
			}

			return {
				success: true,
				item,
				sha,
				message: `Successfully merged ${branchName} using ${strategy}`,
			};

		} catch (error) {
			return {
				success: false,
				item: operation.item,
				message: `Merge operation failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/**
	 * Execute merge pyramid with dependency ordering
	 */
	async executeWeave(plan: Plan, levels: string[][]): Promise<WeaveExecutionResult> {
		const results: WeaveResult[] = [];
		let successful = 0;
		let failed = 0;
		let conflicts = 0;

		try {
			// Create integration branch
			const integrationBranch = await this.createWeaveBranch(plan.target);
			console.log(`Created integration branch: ${integrationBranch}`);

			// Process each level in dependency order
			for (const [levelIndex, level] of levels.entries()) {
				console.log(`Processing level ${levelIndex + 1}: [${level.join(', ')}]`);

				// Process items in parallel within each level
				const levelPromises = level.map(async (itemName) => {
					const item = plan.items.find(i => i.name === itemName);
					if (!item) {
						const result: WeaveResult = {
							success: false,
							item: { name: itemName, deps: [], gates: [] },
							message: `Item ${itemName} not found in plan`,
						};
						return result;
					}

					const operation: MergeOperation = {
						item,
						targetBranch: integrationBranch,
						strategy: "merge-weave", // Default strategy, could be configurable
					};

					return this.executeMergeOperation(operation);
				});

				const levelResults = await Promise.all(levelPromises);
				results.push(...levelResults);

				// Count results
				for (const result of levelResults) {
					if (result.success) {
						successful++;
					} else {
						failed++;
						if (result.conflicts && result.conflicts.length > 0) {
							conflicts++;
						}
					}
				}

				// Stop if any item in this level failed (dependency-aware execution)
				const levelFailed = levelResults.some(result => !result.success);
				if (levelFailed) {
					console.log(`Level ${levelIndex + 1} failed, stopping execution`);
					break;
				}
			}

			return {
				operations: results,
				successful,
				failed,
				conflicts,
				totalOperations: results.length,
			};

		} catch (error) {
			throw new GitOperationError(`Weave execution failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Rollback to previous state
	 */
	async rollback(targetBranch: string): Promise<void> {
		try {
			await this.git.checkout(targetBranch);
			// The integration branch will be left for inspection
		} catch (error) {
			throw new GitOperationError(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Clean up integration branches
	 */
	async cleanup(branchPattern: string = 'weave/integration-*'): Promise<void> {
		try {
			const branches = await this.git.branch(['-l']);
			const weaveBranches = branches.all.filter(branch => 
				branch.startsWith('weave/integration-')
			);

			for (const branch of weaveBranches) {
				try {
					await this.git.deleteLocalBranch(branch, true); // Force delete
				} catch (error) {
					// Ignore errors for individual branch deletions
					console.warn(`Could not delete branch ${branch}: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		} catch (error) {
			throw new GitOperationError(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}

export class GitOperationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitOperationError";
	}
}

/**
 * Create git operations manager
 */
export function createGitOperations(workingDir?: string): GitOperations {
	return new GitOperations(workingDir);
}