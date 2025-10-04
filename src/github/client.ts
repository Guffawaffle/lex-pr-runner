/**
 * GitHub API client for PR discovery and metadata extraction
 * Implements the GitHubClient interface with authentication and rate limiting
 */

import { Octokit } from "@octokit/rest";
import { createTokenAuth } from "@octokit/auth-token";
import type {
	PullRequest,
	PullRequestDetails,
	PRQueryOptions,
	RepositoryInfo
} from "./types.js";
import {
	GitHubAPIError,
	GitHubRateLimitError,
	GitHubAuthError
} from "./types.js";
import { parsePRDescription, normalizeDependencyRef } from "../planner/index.js";

export type { PullRequest, PullRequestDetails, PRQueryOptions, RepositoryInfo };
export { GitHubAPIError, GitHubRateLimitError, GitHubAuthError };

export interface GitHubClient {
	listOpenPRs(options?: PRQueryOptions): Promise<PullRequest[]>;
	getPRDetails(number: number): Promise<PullRequestDetails>;
	getPRDependencies(pr: PullRequest): Promise<string[]>;
	validateRepository(): Promise<RepositoryInfo>;
	// File analysis support
	getOctokit(): any; // Returns Octokit instance for advanced operations
	getOwner(): string;
	getRepo(): string;
}

export class GitHubClientImpl implements GitHubClient {
	private octokit: Octokit;
	private owner: string;
	private repo: string;

	constructor(options: {
		token?: string;
		owner: string;
		repo: string;
	}) {
		this.owner = options.owner;
		this.repo = options.repo;

		// Initialize Octokit with authentication if token provided
		if (options.token) {
			this.octokit = new Octokit({
				auth: options.token
			});
		} else {
			// Try to get token from environment
			const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
			if (token) {
				this.octokit = new Octokit({
					auth: token
				});
			} else {
				// Unauthenticated client (rate limited)
				this.octokit = new Octokit();
			}
		}
	}

	async validateRepository(): Promise<RepositoryInfo> {
		try {
			const response = await this.octokit.rest.repos.get({
				owner: this.owner,
				repo: this.repo
			});

			return {
				owner: this.owner,
				repo: this.repo,
				defaultBranch: response.data.default_branch,
				url: response.data.html_url
			};
		} catch (error: any) {
			if (error.status === 401) {
				throw new GitHubAuthError("GitHub authentication failed. Please provide a valid token.");
			}
			if (error.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
				const resetTime = new Date(parseInt(error.response.headers['x-ratelimit-reset']) * 1000);
				throw new GitHubRateLimitError("GitHub API rate limit exceeded", resetTime);
			}
			if (error.status === 404) {
				throw new GitHubAPIError(`Repository ${this.owner}/${this.repo} not found or not accessible`);
			}
			throw new GitHubAPIError(`Failed to validate repository: ${error.message}`, error.status);
		}
	}

	async listOpenPRs(options: PRQueryOptions = {}): Promise<PullRequest[]> {
		try {
			const params: any = {
				owner: this.owner,
				repo: this.repo,
				state: options.state || "open",
				sort: options.sort || "created",
				direction: options.direction || "desc",
				per_page: options.per_page || 30,
				page: options.page || 1
			};

			if (options.base) {
				params.base = options.base;
			}
			if (options.head) {
				params.head = options.head;
			}

			const response = await this.octokit.rest.pulls.list(params);

			// Filter by labels if specified
			let prs = response.data;
			if (options.labels && options.labels.length > 0) {
				prs = prs.filter(pr =>
					options.labels!.some(label =>
						pr.labels.some(prLabel => prLabel.name === label)
					)
				);
			}

			return prs.map(this.transformPR);
		} catch (error: any) {
			return this.handleAPIError(error);
		}
	}

	async getPRDetails(number: number): Promise<PullRequestDetails> {
		try {
			const response = await this.octokit.rest.pulls.get({
				owner: this.owner,
				repo: this.repo,
				pull_number: number
			});

			const pr = this.transformPR(response.data);
			const dependencies = await this.getPRDependencies(pr);
			const tags = this.extractTags(pr);
			const requiredGates = this.extractRequiredGates(pr);

			// Parse PR description for additional metadata and gate overrides
			const parsed = parsePRDescription(pr.number, pr.body, {
				repository: `${this.owner}/${this.repo}`,
				partialExtraction: true
			});

			return {
				...pr,
				dependencies,
				tags,
				requiredGates,
				...(parsed.metadata && Object.keys(parsed.metadata).length > 0 ? { metadata: parsed.metadata } : {}),
				...(parsed.gates ? { gateOverrides: parsed.gates } : {})
			};
		} catch (error: any) {
			return this.handleAPIError(error);
		}
	}

	async getPRDependencies(pr: PullRequest): Promise<string[]> {
		if (!pr.body) {
			return [];
		}

		// Use the new dependency parser for comprehensive parsing
		const parsed = parsePRDescription(pr.number, pr.body, {
			repository: `${this.owner}/${this.repo}`,
			partialExtraction: true
		});

		// Normalize all dependencies to full format (owner/repo#123)
		const normalizedDeps = parsed.dependencies.map(dep => 
			normalizeDependencyRef(dep, `${this.owner}/${this.repo}`)
		);

		// Remove duplicates and sort for deterministic output
		return [...new Set(normalizedDeps)].sort();
	}

	private transformPR(prData: any): PullRequest {
		return {
			number: prData.number,
			title: prData.title,
			body: prData.body,
			head: {
				ref: prData.head.ref,
				sha: prData.head.sha
			},
			base: {
				ref: prData.base.ref,
				sha: prData.base.sha
			},
			state: prData.state,
			labels: prData.labels.map((label: any) => ({
				name: label.name,
				color: label.color
			})),
			draft: prData.draft || false,
			mergeable: prData.mergeable,
			user: {
				login: prData.user.login
			},
			createdAt: prData.created_at,
			updatedAt: prData.updated_at
		};
	}

	private extractTags(pr: PullRequest): string[] {
		// Extract tags from labels, filtering for stack-related labels
		const tags = pr.labels
			.map(label => label.name)
			.filter(name => name.startsWith('stack:') || name.startsWith('tag:'))
			.map(name => name.replace(/^(stack:|tag:)/, ''));

		return [...new Set(tags)].sort();
	}

	private extractRequiredGates(pr: PullRequest): string[] {
		const gates: string[] = [];

		// Extract from labels like "gate:lint", "gate:test"
		const gateLabels = pr.labels
			.map(label => label.name)
			.filter(name => name.startsWith('gate:'))
			.map(name => name.replace(/^gate:/, ''));

		gates.push(...gateLabels);

		// Use the dependency parser to extract gate overrides from PR body
		if (pr.body) {
			const parsed = parsePRDescription(pr.number, pr.body, { partialExtraction: true });
			if (parsed.gates?.required) {
				gates.push(...parsed.gates.required);
			}
		}

		return [...new Set(gates)].sort();
	}

	private handleAPIError(error: any): never {
		if (error.status === 401) {
			throw new GitHubAuthError("GitHub authentication failed. Please provide a valid token.");
		}
		if (error.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
			const resetTime = new Date(parseInt(error.response.headers['x-ratelimit-reset']) * 1000);
			throw new GitHubRateLimitError("GitHub API rate limit exceeded", resetTime);
		}
		throw new GitHubAPIError(`GitHub API error: ${error.message}`, error.status);
	}

	// File analysis support methods
	getOctokit(): any {
		return this.octokit;
	}

	getOwner(): string {
		return this.owner;
	}

	getRepo(): string {
		return this.repo;
	}
}

/**
 * Factory function to create GitHub client with auto-detection of repository info
 */
export async function createGitHubClient(options: {
	token?: string;
	owner?: string;
	repo?: string;
} = {}): Promise<GitHubClient> {
	let owner = options.owner;
	let repo = options.repo;

	// Auto-detect repository info from git remote if not provided
	if (!owner || !repo) {
		try {
			const { execa } = await import("execa");
			const result = await execa("git", ["remote", "get-url", "origin"]);
			const remoteUrl = result.stdout.trim();

			// Parse GitHub URL formats
			// SSH: git@github.com:owner/repo.git
			// HTTPS: https://github.com/owner/repo.git
			const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^.]+)\.git$/);
			const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^/]+)\/([^.]+)\.git$/);

			if (sshMatch) {
				owner = owner || sshMatch[1];
				repo = repo || sshMatch[2];
			} else if (httpsMatch) {
				owner = owner || httpsMatch[1];
				repo = repo || httpsMatch[2];
			}
		} catch (error) {
			// Ignore git command errors - user will need to provide explicit values
		}
	}

	if (!owner || !repo) {
		throw new GitHubAPIError("Repository owner and name must be provided or detectable from git remote");
	}

	return new GitHubClientImpl({
		token: options.token,
		owner,
		repo
	});
}