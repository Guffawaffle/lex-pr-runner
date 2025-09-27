import { describe, it, expect, vi, beforeEach } from "vitest";
import { listPRsWithQuery, validateGitHubCLI } from "../core/github.js";
import { execa } from "execa";

// Mock execa module
vi.mock("execa");
const mockedExeca = vi.mocked(execa);

describe("GitHub CLI Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("validateGitHubCLI", () => {
		it("should return true when gh CLI is available", async () => {
			mockedExeca.mockResolvedValueOnce({
				stdout: "gh version 2.32.1 (2023-07-18)",
				stderr: "",
				exitCode: 0,
			} as any);

			const result = await validateGitHubCLI();
			expect(result).toBe(true);
			expect(mockedExeca).toHaveBeenCalledWith("gh", ["--version"]);
		});

		it("should return false when gh CLI is not available", async () => {
			mockedExeca.mockRejectedValueOnce(new Error("Command not found"));

			const result = await validateGitHubCLI();
			expect(result).toBe(false);
		});
	});

	describe("listPRsWithQuery", () => {
		it("should list PRs with query only", async () => {
			const mockPRs = [
				{
					number: 123,
					headRefName: "feature/test-branch",
					headRefOid: "abc123def456"
				},
				{
					number: 456,
					headRefName: "fix/bug-fix",
					headRefOid: "def456ghi789"
				}
			];

			mockedExeca.mockResolvedValueOnce({
				stdout: JSON.stringify(mockPRs),
				stderr: "",
				exitCode: 0,
			} as any);

			const result = await listPRsWithQuery("is:open label:stack:*");
			
			expect(result).toEqual(mockPRs);
			expect(mockedExeca).toHaveBeenCalledWith("gh", [
				"pr", "list", "--json", "number,headRefName,headRefOid", "--search", "is:open label:stack:*"
			]);
		});

		it("should list PRs with query and repo", async () => {
			const mockPRs = [
				{
					number: 789,
					headRefName: "feature/new-feature",
					headRefOid: "ghi789jkl012"
				}
			];

			mockedExeca.mockResolvedValueOnce({
				stdout: JSON.stringify(mockPRs),
				stderr: "",
				exitCode: 0,
			} as any);

			const result = await listPRsWithQuery("is:open", "owner/repo");
			
			expect(result).toEqual(mockPRs);
			expect(mockedExeca).toHaveBeenCalledWith("gh", [
				"pr", "list", "--json", "number,headRefName,headRefOid", "--search", "is:open", "--repo", "owner/repo"
			]);
		});

		it("should throw error when gh command fails", async () => {
			mockedExeca.mockRejectedValueOnce(new Error("Authentication failed"));

			await expect(listPRsWithQuery("is:open")).rejects.toThrow(
				"Failed to execute gh pr list: Error: Authentication failed"
			);
		});

		it("should handle empty PR list", async () => {
			mockedExeca.mockResolvedValueOnce({
				stdout: "[]",
				stderr: "",
				exitCode: 0,
			} as any);

			const result = await listPRsWithQuery("is:open");
			
			expect(result).toEqual([]);
		});
	});
});