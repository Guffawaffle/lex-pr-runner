import { createPlan, createPlanSnapshot } from "../src/core/plan";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const FIXTURES_DIR = path.join(__dirname, "fixtures", "determinism-test");
const TEMP_OUTPUT_DIR = "/tmp/lex-pr-determinism-test";

/**
 * Calculate SHA256 hash of a file
 */
function getFileHash(filePath: string): string {
	const content = fs.readFileSync(filePath);
	return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Clean up and prepare test environment
 */
function setupTestEnvironment(): void {
	// Clean up any existing temp directory
	if (fs.existsSync(TEMP_OUTPUT_DIR)) {
		fs.rmSync(TEMP_OUTPUT_DIR, { recursive: true, force: true });
	}
	fs.mkdirSync(TEMP_OUTPUT_DIR, { recursive: true });
	
	// Set deterministic environment variables
	process.env.LEX_PR_DETERMINISTIC_TIME = "2024-01-01T12:00:00.000Z";
}

/**
 * Generate plan artifacts using the CLI-like process
 */
async function generatePlanArtifacts(outputDir: string, inputsDir: string): Promise<{
	planPath: string;
	snapshotPath: string;
}> {
	const plan = await createPlan(inputsDir);
	const snapshot = await createPlanSnapshot(inputsDir);
	
	// Write plan.json with deterministic formatting (matching CLI)
	const planPath = path.join(outputDir, "plan.json");
	fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");
	
	// Write snapshot.md (matching CLI format)
	const snapshotPath = path.join(outputDir, "snapshot.md");
	const snapshotContent = generateSnapshotMarkdown(snapshot);
	fs.writeFileSync(snapshotPath, snapshotContent);
	
	return { planPath, snapshotPath };
}

/**
 * Generate snapshot markdown content (copied from CLI)
 */
function generateSnapshotMarkdown(snapshot: any): string {
	const lines = [
		"# Plan Snapshot",
		"",
		`**Generated:** ${snapshot.timestamp}`,
		`**Target Branch:** ${snapshot.plan.target}`,
		"",
		"## Environment",
		"",
		`- **Node Version:** ${snapshot.environment.nodeVersion}`,
		`- **Platform:** ${snapshot.environment.platform}`,
		`- **Architecture:** ${snapshot.environment.arch}`,
		"",
		"## Plan Items",
		""
	];

	if (snapshot.plan.items.length === 0) {
		lines.push("*No plan items found.*");
	} else {
		snapshot.plan.items.forEach((item: any) => {
			lines.push(`### Item ${item.id}: ${item.branch}`);
			lines.push("");
			lines.push(`- **Strategy:** ${item.strategy}`);
			if (item.sha) {
				lines.push(`- **SHA:** ${item.sha}`);
			}
			if (item.needs.length > 0) {
				lines.push(`- **Dependencies:** ${item.needs.join(", ")}`);
			}
			lines.push("");
		});
	}

	lines.push("## Input Files");
	lines.push("");
	
	Object.keys(snapshot.inputs).sort().forEach(filename => {
		lines.push(`### ${filename}`);
		lines.push("");
		lines.push("```yaml");
		lines.push(typeof snapshot.inputs[filename] === 'string' 
			? snapshot.inputs[filename] 
			: JSON.stringify(snapshot.inputs[filename], null, 2));
		lines.push("```");
		lines.push("");
	});

	return lines.join("\n");
}

describe("Determinism Tests", () => {
	beforeEach(() => {
		setupTestEnvironment();
	});

	afterEach(() => {
		// Clean up
		if (fs.existsSync(TEMP_OUTPUT_DIR)) {
			fs.rmSync(TEMP_OUTPUT_DIR, { recursive: true, force: true });
		}
		// Clean up environment variables
		delete process.env.LEX_PR_DETERMINISTIC_TIME;
	});

	test("plan artifacts are identical between runs with same inputs", async () => {
		const inputsDir = path.join(FIXTURES_DIR, ".smartergpt");
		
		// First run
		const run1Dir = path.join(TEMP_OUTPUT_DIR, "run1");
		fs.mkdirSync(run1Dir, { recursive: true });
		const run1Results = await generatePlanArtifacts(run1Dir, inputsDir);
		
		// Second run
		const run2Dir = path.join(TEMP_OUTPUT_DIR, "run2");
		fs.mkdirSync(run2Dir, { recursive: true });
		const run2Results = await generatePlanArtifacts(run2Dir, inputsDir);
		
		// Compare file hashes - they should be identical
		const run1PlanHash = getFileHash(run1Results.planPath);
		const run2PlanHash = getFileHash(run2Results.planPath);
		expect(run1PlanHash).toBe(run2PlanHash);
		
		const run1SnapshotHash = getFileHash(run1Results.snapshotPath);
		const run2SnapshotHash = getFileHash(run2Results.snapshotPath);
		expect(run1SnapshotHash).toBe(run2SnapshotHash);
		
		// Also verify content is identical
		const run1PlanContent = fs.readFileSync(run1Results.planPath, "utf-8");
		const run2PlanContent = fs.readFileSync(run2Results.planPath, "utf-8");
		expect(run1PlanContent).toBe(run2PlanContent);
		
		const run1SnapshotContent = fs.readFileSync(run1Results.snapshotPath, "utf-8");
		const run2SnapshotContent = fs.readFileSync(run2Results.snapshotPath, "utf-8");
		expect(run1SnapshotContent).toBe(run2SnapshotContent);
	});

	test("plan artifacts contain expected structure and content", async () => {
		const inputsDir = path.join(FIXTURES_DIR, ".smartergpt");
		const outputDir = path.join(TEMP_OUTPUT_DIR, "structure-test");
		fs.mkdirSync(outputDir, { recursive: true });
		
		const results = await generatePlanArtifacts(outputDir, inputsDir);
		
		// Verify files exist
		expect(fs.existsSync(results.planPath)).toBe(true);
		expect(fs.existsSync(results.snapshotPath)).toBe(true);
		
		// Verify plan.json structure
		const planContent = JSON.parse(fs.readFileSync(results.planPath, "utf-8"));
		expect(planContent).toHaveProperty("target");
		expect(planContent).toHaveProperty("items");
		expect(Array.isArray(planContent.items)).toBe(true);
		
		// Based on our fixture, we should have 3 plan items
		expect(planContent.items).toHaveLength(3);
		expect(planContent.target).toBe("main");
		
		// Verify first item structure
		const firstItem = planContent.items[0];
		expect(firstItem).toHaveProperty("id", 1);
		expect(firstItem).toHaveProperty("branch", "feature/auth-system");
		expect(firstItem).toHaveProperty("sha", "abc123def456");
		expect(firstItem).toHaveProperty("needs", []);
		expect(firstItem).toHaveProperty("strategy", "rebase-weave");
		
		// Verify snapshot.md contains expected sections
		const snapshotContent = fs.readFileSync(results.snapshotPath, "utf-8");
		expect(snapshotContent).toContain("# Plan Snapshot");
		expect(snapshotContent).toContain("## Environment");
		expect(snapshotContent).toContain("## Plan Items");
		expect(snapshotContent).toContain("## Input Files");
		expect(snapshotContent).toContain("**Generated:** 2024-01-01T12:00:00.000Z");
	});

	test("output is deterministic across multiple runs", async () => {
		const inputsDir = path.join(FIXTURES_DIR, ".smartergpt");
		const results: Array<{ planHash: string; snapshotHash: string }> = [];
		
		// Run 5 times to ensure consistency
		for (let i = 0; i < 5; i++) {
			const runDir = path.join(TEMP_OUTPUT_DIR, `run${i}`);
			fs.mkdirSync(runDir, { recursive: true });
			const runResults = await generatePlanArtifacts(runDir, inputsDir);
			
			results.push({
				planHash: getFileHash(runResults.planPath),
				snapshotHash: getFileHash(runResults.snapshotPath)
			});
		}
		
		// All hashes should be identical
		const firstRun = results[0];
		for (let i = 1; i < results.length; i++) {
			expect(results[i].planHash).toBe(firstRun.planHash);
			expect(results[i].snapshotHash).toBe(firstRun.snapshotHash);
		}
	});
});