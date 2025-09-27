import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import { loadScopeConfig, loadStackConfig, hasStackPRs } from "../core/config.js";

// Mock fs module
vi.mock("fs");
const mockedFs = vi.mocked(fs);

describe("Configuration Loading", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("loadScopeConfig", () => {
		it("should load valid scope.yml configuration", async () => {
			const mockScopeContent = `
version: 1
target: main
repo: owner/repo
sources:
  - query: "is:open label:stack:*"
selectors:
  include_labels: ["stack:*"]
  exclude_labels: ["WIP", "do-not-merge"]
defaults:
  strategy: rebase-weave
  base: main
pin_commits: true
`;

			mockedFs.readFileSync.mockReturnValueOnce(mockScopeContent);

			const result = await loadScopeConfig();

			expect(result).toEqual({
				version: 1,
				target: "main",
				repo: "owner/repo",
				sources: [{ query: "is:open label:stack:*" }],
				selectors: {
					include_labels: ["stack:*"],
					exclude_labels: ["WIP", "do-not-merge"]
				},
				defaults: {
					strategy: "rebase-weave",
					base: "main"
				},
				pin_commits: true
			});

			expect(mockedFs.readFileSync).toHaveBeenCalledWith(".smartergpt/scope.yml", "utf-8");
		});

		it("should return null when scope.yml file doesn't exist", async () => {
			mockedFs.readFileSync.mockImplementationOnce(() => {
				throw new Error("ENOENT: no such file or directory");
			});

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = await loadScopeConfig();

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Could not load scope.yml"));
			
			consoleSpy.mockRestore();
		});

		it("should return null when scope.yml has invalid YAML", async () => {
			mockedFs.readFileSync.mockReturnValueOnce("invalid: yaml: content: [");

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = await loadScopeConfig();

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Could not load scope.yml"));
			
			consoleSpy.mockRestore();
		});

		it("should use custom config directory", async () => {
			const mockScopeContent = `
version: 1
target: main
sources:
  - query: "is:open"
`;

			mockedFs.readFileSync.mockReturnValueOnce(mockScopeContent);

			await loadScopeConfig("custom/config");

			expect(mockedFs.readFileSync).toHaveBeenCalledWith("custom/config/scope.yml", "utf-8");
		});
	});

	describe("loadStackConfig", () => {
		it("should load valid stack.yml configuration", async () => {
			const mockStackContent = `
version: 1
target: main
prs: [123, 456, 789]
`;

			mockedFs.readFileSync.mockReturnValueOnce(mockStackContent);

			const result = await loadStackConfig();

			expect(result).toEqual({
				version: 1,
				target: "main",
				prs: [123, 456, 789]
			});

			expect(mockedFs.readFileSync).toHaveBeenCalledWith(".smartergpt/stack.yml", "utf-8");
		});

		it("should return null when stack.yml file doesn't exist", async () => {
			mockedFs.readFileSync.mockImplementationOnce(() => {
				throw new Error("ENOENT: no such file or directory");
			});

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = await loadStackConfig();

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Could not load stack.yml"));
			
			consoleSpy.mockRestore();
		});
	});

	describe("hasStackPRs", () => {
		it("should return true when stack has PRs", () => {
			const stack = {
				version: 1,
				target: "main",
				prs: [123, 456]
			};

			expect(hasStackPRs(stack)).toBe(true);
		});

		it("should return false when stack has no PRs", () => {
			const stack = {
				version: 1,
				target: "main",
				prs: []
			};

			expect(hasStackPRs(stack)).toBe(false);
		});

		it("should return false when stack is null", () => {
			expect(hasStackPRs(null)).toBe(false);
		});
	});
});