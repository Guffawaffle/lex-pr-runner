import { execa } from "execa";

// GitHub PR data structure from gh pr list --json
export interface GitHubPR {
	number: number;
	headRefName: string;
	headRefOid: string;
}

// Execute gh pr list command with query
export async function listPRsWithQuery(query: string, repo?: string): Promise<GitHubPR[]> {
	const args = ["pr", "list", "--json", "number,headRefName,headRefOid", "--search", query];
	
	if (repo) {
		args.push("--repo", repo);
	}
	
	try {
		const result = await execa("gh", args);
		const prs = JSON.parse(result.stdout) as GitHubPR[];
		return prs;
	} catch (error) {
		throw new Error(`Failed to execute gh pr list: ${error}`);
	}
}

// Validate that gh CLI is available
export async function validateGitHubCLI(): Promise<boolean> {
	try {
		await execa("gh", ["--version"]);
		return true;
	} catch {
		return false;
	}
}