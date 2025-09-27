import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPlan } from "../core/plan.js";
import { loadScopeConfig, loadStackConfig } from "../core/config.js";
import { listPRsWithQuery, validateGitHubCLI } from "../core/github.js";

// Mock the dependencies
vi.mock("../core/config.js");
vi.mock("../core/github.js");

const mockedLoadScopeConfig = vi.mocked(loadScopeConfig);
const mockedLoadStackConfig = vi.mocked(loadStackConfig);
const mockedListPRsWithQuery = vi.mocked(listPRsWithQuery);
const mockedValidateGitHubCLI = vi.mocked(validateGitHubCLI);

describe("Plan Creation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("createPlan", () => {
		it("should return empty plan when no configuration is available", async () => {
			mockedLoadStackConfig.mockResolvedValueOnce(null);
			mockedLoadScopeConfig.mockResolvedValueOnce(null);

			const result = await createPlan();

			expect(result).toEqual({
				target: "main",
				items: []
			});
		});

		it("should use stack target when stack config is available", async () => {
			mockedLoadStackConfig.mockResolvedValueOnce({
				version: 1,
				target: "develop",
				prs: []
			});
			mockedLoadScopeConfig.mockResolvedValueOnce({
				version: 1,
				target: "main",
				sources: [{ query: "is:open" }]
			});

			const result = await createPlan();

			expect(result.target).toBe("develop");
		});

		it("should use scope target when stack config is not available", async () => {
			mockedLoadStackConfig.mockResolvedValueOnce(null);
			mockedLoadScopeConfig.mockResolvedValueOnce({
				version: 1,
				target: "feature-branch",
				sources: [{ query: "is:open" }]
			});

			const result = await createPlan();

			expect(result.target).toBe("feature-branch");
		});

		it("should fallback to GitHub query when stack has no PRs", async () => {
			const mockStackConfig = {
				version: 1,
				target: "main",
				prs: []
			};

			const mockScopeConfig = {
				version: 1,
				target: "main",
				repo: "owner/repo",
				sources: [{ query: "is:open label:stack:*" }],
				pin_commits: true,
				defaults: {
					strategy: "merge-weave" as const
				}
			};

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

			mockedLoadStackConfig.mockResolvedValueOnce(mockStackConfig);
			mockedLoadScopeConfig.mockResolvedValueOnce(mockScopeConfig);
			mockedValidateGitHubCLI.mockResolvedValueOnce(true);
			mockedListPRsWithQuery.mockResolvedValueOnce(mockPRs);

			const result = await createPlan();

			expect(result).toEqual({
				target: "main",
				items: [
					{
						id: 123,
						branch: "feature/test-branch",
						sha: "abc123def456",
						needs: [],
						strategy: "merge-weave"
					},
					{
						id: 456,
						branch: "fix/bug-fix",
						sha: "def456ghi789",
						needs: [],
						strategy: "merge-weave"
					}
				]
			});

			expect(mockedValidateGitHubCLI).toHaveBeenCalledOnce();
			expect(mockedListPRsWithQuery).toHaveBeenCalledWith("is:open label:stack:*", "owner/repo");
		});

		it("should not pin commits when pin_commits is false", async () => {
			const mockStackConfig = {
				version: 1,
				target: "main",
				prs: []
			};

			const mockScopeConfig = {
				version: 1,
				target: "main",
				sources: [{ query: "is:open" }],
				pin_commits: false
			};

			const mockPRs = [
				{
					number: 123,
					headRefName: "feature/test-branch",
					headRefOid: "abc123def456"
				}
			];

			mockedLoadStackConfig.mockResolvedValueOnce(mockStackConfig);
			mockedLoadScopeConfig.mockResolvedValueOnce(mockScopeConfig);
			mockedValidateGitHubCLI.mockResolvedValueOnce(true);
			mockedListPRsWithQuery.mockResolvedValueOnce(mockPRs);

			const result = await createPlan();

			expect(result.items[0].sha).toBeUndefined();
		});

		it("should use default strategy when not specified in scope config", async () => {
			const mockStackConfig = {
				version: 1,
				target: "main",
				prs: []
			};

			const mockScopeConfig = {
				version: 1,
				target: "main",
				sources: [{ query: "is:open" }]
			};

			const mockPRs = [
				{
					number: 123,
					headRefName: "feature/test-branch",
					headRefOid: "abc123def456"
				}
			];

			mockedLoadStackConfig.mockResolvedValueOnce(mockStackConfig);
			mockedLoadScopeConfig.mockResolvedValueOnce(mockScopeConfig);
			mockedValidateGitHubCLI.mockResolvedValueOnce(true);
			mockedListPRsWithQuery.mockResolvedValueOnce(mockPRs);

			const result = await createPlan();

			expect(result.items[0].strategy).toBe("rebase-weave");
		});

		it("should return empty plan when GitHub CLI is not available", async () => {
			const mockStackConfig = {
				version: 1,
				target: "main",
				prs: []
			};

			const mockScopeConfig = {
				version: 1,
				target: "main",
				sources: [{ query: "is:open" }]
			};

			mockedLoadStackConfig.mockResolvedValueOnce(mockStackConfig);
			mockedLoadScopeConfig.mockResolvedValueOnce(mockScopeConfig);
			mockedValidateGitHubCLI.mockResolvedValueOnce(false);

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = await createPlan();

			expect(result).toEqual({
				target: "main",
				items: []
			});

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("GitHub query fallback failed"));
			
			consoleSpy.mockRestore();
		});

		it("should return empty plan when GitHub query fails", async () => {
			const mockStackConfig = {
				version: 1,
				target: "main",
				prs: []
			};

			const mockScopeConfig = {
				version: 1,
				target: "main",
				sources: [{ query: "is:open" }]
			};

			mockedLoadStackConfig.mockResolvedValueOnce(mockStackConfig);
			mockedLoadScopeConfig.mockResolvedValueOnce(mockScopeConfig);
			mockedValidateGitHubCLI.mockResolvedValueOnce(true);
			mockedListPRsWithQuery.mockRejectedValueOnce(new Error("API rate limit exceeded"));

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = await createPlan();

			expect(result).toEqual({
				target: "main",
				items: []
			});

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("GitHub query fallback failed"));
			
			consoleSpy.mockRestore();
		});

		it("should call GitHub query without repo when repo is not specified", async () => {
			const mockStackConfig = {
				version: 1,
				target: "main",
				prs: []
			};

			const mockScopeConfig = {
				version: 1,
				target: "main",
				sources: [{ query: "is:open" }]
			};

			const mockPRs = [
				{
					number: 123,
					headRefName: "feature/test-branch",
					headRefOid: "abc123def456"
				}
			];

			mockedLoadStackConfig.mockResolvedValueOnce(mockStackConfig);
			mockedLoadScopeConfig.mockResolvedValueOnce(mockScopeConfig);
			mockedValidateGitHubCLI.mockResolvedValueOnce(true);
			mockedListPRsWithQuery.mockResolvedValueOnce(mockPRs);

			await createPlan();

			expect(mockedListPRsWithQuery).toHaveBeenCalledWith("is:open", undefined);
		});
	});
});