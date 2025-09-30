/**
 * GitHub API integration for PR discovery and metadata extraction
 * Maintains deterministic ordering and stable output
 */

import { Octokit } from "@octokit/rest";
import { simpleGit } from "simple-git";
import { stableSort } from "../util/canonicalJson.js";

export interface GitHubPullRequest {
	number: number;
	title: string;
	branch: string;
	sha: string;
	state: "open" | "closed" | "merged";
	labels: string[];
	author: string;
	baseBranch: string;
	createdAt: string;
	updatedAt: string;
}

export interface GitHubConfig {
	token?: string;
	owner: string;
	repo: string;
}

/**
 * GitHub API client for PR operations
 */
export class GitHubAPI {
	private octokit: Octokit;
	private config: GitHubConfig;

	constructor(config: GitHubConfig) {
		this.config = config;
		this.octokit = new Octokit({
			auth: config.token || process.env.GITHUB_TOKEN,
		});
	}

	/**
	 * Discover open pull requests with stable ordering
	 */
	async discoverPullRequests(state: "open" | "closed" | "all" = "open"): Promise<GitHubPullRequest[]> {
		try {
			const { data: pulls } = await this.octokit.rest.pulls.list({
				owner: this.config.owner,
				repo: this.config.repo,
				state,
				sort: "updated",
				direction: "desc",
				per_page: 100,
			});

			// Transform to our interface and sort for deterministic output
			// Helper to normalize label entries which may be strings or objects
			const extractLabelName = (label: any): string => {
				if (!label) return '';
				if (typeof label === 'string') return label;
				if (typeof label.name === 'string') return label.name;
				return '';
			};

			const pullRequests: GitHubPullRequest[] = pulls.map(pull => ({
				number: pull.number,
				title: pull.title,
				branch: pull.head.ref,
				sha: pull.head.sha,
				state: pull.state as "open" | "closed" | "merged",
				labels: stableSort(pull.labels.map(extractLabelName)) ,
				author: pull.user?.login || 'unknown',
				baseBranch: pull.base.ref,
				createdAt: pull.created_at,
				updatedAt: pull.updated_at,
			}));

			// Sort by PR number for deterministic ordering
			pullRequests.sort((a, b) => a.number - b.number);
			return pullRequests;
		} catch (error) {
			throw new GitHubAPIError(`Failed to fetch pull requests: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Get repository information
	 */
	async getRepositoryInfo() {
		try {
			const { data: repo } = await this.octokit.rest.repos.get({
				owner: this.config.owner,
				repo: this.config.repo,
			});

			return {
				name: repo.name,
				fullName: repo.full_name,
				defaultBranch: repo.default_branch,
				private: repo.private,
			};
		} catch (error) {
			throw new GitHubAPIError(`Failed to fetch repository info: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Check if authentication is working
	 */
	async checkAuth(): Promise<{ authenticated: boolean; user?: string }> {
		try {
			const { data: user } = await this.octokit.rest.users.getAuthenticated();
			return {
				authenticated: true,
				user: user.login,
			};
		} catch (error) {
			return {
				authenticated: false,
			};
		}
	}
}

export class GitHubAPIError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitHubAPIError";
	}
}

/**
 * Create GitHub API client from environment and config
 */
export async function createGitHubAPI(): Promise<GitHubAPI | null> {
	// Try to detect GitHub repository from current directory
	const repoInfo = await detectGitHubRepository();
	if (!repoInfo) {
		return null;
	}

	return new GitHubAPI({
		owner: repoInfo.owner,
		repo: repoInfo.repo,
		token: process.env.GITHUB_TOKEN,
	});
}

/**
 * Detect GitHub repository information from git remote
 */
async function detectGitHubRepository(): Promise<{ owner: string; repo: string } | null> {
	try {
		const git = simpleGit();
		const remotes = await git.getRemotes(true);

		// Look for origin remote first, then any GitHub remote
		const githubRemote = remotes.find(remote => remote.name === "origin" && remote.refs.fetch.includes("github.com"))
			|| remotes.find(remote => remote.refs.fetch.includes("github.com"));

		if (!githubRemote) {
			return null;
		}

		// Parse GitHub URL (supports both HTTPS and SSH formats)
		const url = githubRemote.refs.fetch;
		const match = url.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);

		if (!match) {
			return null;
		}

		return {
			owner: match[1],
			repo: match[2],
		};
	} catch {
		return null;
	}
}