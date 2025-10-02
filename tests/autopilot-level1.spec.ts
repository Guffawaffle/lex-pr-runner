/**
 * Tests for Autopilot Level 1 - Artifact generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AutopilotLevel0, AutopilotLevel1, AutopilotContext } from '../src/autopilot/index.js';
import { Plan } from '../src/schema.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('AutopilotLevel0', () => {
	let testDir: string;
	let context: AutopilotContext;

	beforeEach(() => {
		testDir = path.join(os.tmpdir(), `lex-pr-runner-autopilot-test-${Date.now()}`);
		fs.mkdirSync(testDir, { recursive: true });

		const plan: Plan = {
			schemaVersion: "1.0.0",
			target: "main",
			items: [
				{
					name: "item-1",
					deps: [],
					gates: [
						{ name: "lint", run: "npm run lint", env: {} }
					]
				},
				{
					name: "item-2",
					deps: ["item-1"],
					gates: [
						{ name: "test", run: "npm test", env: {} }
					]
				}
			]
		};

		context = {
			plan,
			profilePath: testDir,
			profileRole: "local"
		};
	});

	afterEach(() => {
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true });
		}
	});

	it('should return level 0', () => {
		const autopilot = new AutopilotLevel0(context);
		expect(autopilot.getLevel()).toBe(0);
	});

	it('should generate report without creating artifacts', async () => {
		const autopilot = new AutopilotLevel0(context);
		const result = await autopilot.execute();

		expect(result.level).toBe(0);
		expect(result.success).toBe(true);
		expect(result.message).toContain("Level 0");
		expect(result.message).toContain("2 items");
		expect(result.artifacts).toBeUndefined();
	});

	it('should include recommendations in report', async () => {
		const autopilot = new AutopilotLevel0(context);
		const result = await autopilot.execute();

		expect(result.message).toContain("Recommendations:");
		expect(result.message).toContain("gates defined");
	});
});

describe('AutopilotLevel1', () => {
	let testDir: string;
	let context: AutopilotContext;

	beforeEach(() => {
		testDir = path.join(os.tmpdir(), `lex-pr-runner-autopilot-test-${Date.now()}`);
		fs.mkdirSync(testDir, { recursive: true });

		const plan: Plan = {
			schemaVersion: "1.0.0",
			target: "main",
			items: [
				{
					name: "item-1",
					deps: [],
					gates: [
						{ name: "lint", run: "npm run lint", env: {} }
					]
				},
				{
					name: "item-2",
					deps: ["item-1"],
					gates: [
						{ name: "test", run: "npm test", env: {} }
					]
				}
			]
		};

		context = {
			plan,
			profilePath: testDir,
			profileRole: "local"
		};
	});

	afterEach(() => {
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true });
		}
	});

	it('should return level 1', () => {
		const autopilot = new AutopilotLevel1(context);
		expect(autopilot.getLevel()).toBe(1);
	});

	it('should create deliverables directory', async () => {
		const autopilot = new AutopilotLevel1(context);
		const result = await autopilot.execute();

		expect(result.success).toBe(true);

		const deliverables = path.join(testDir, 'deliverables');
		expect(fs.existsSync(deliverables)).toBe(true);

		const dirs = fs.readdirSync(deliverables);
		expect(dirs.length).toBe(1);
		expect(dirs[0]).toMatch(/^weave-/);
	});

	it('should generate all required artifacts', async () => {
		const autopilot = new AutopilotLevel1(context);
		const result = await autopilot.execute();

		expect(result.success).toBe(true);
		expect(result.artifacts).toBeDefined();
		expect(result.artifacts?.length).toBe(5);

		const deliverables = path.join(testDir, 'deliverables');
		const dirs = fs.readdirSync(deliverables);
		const weaveDir = path.join(deliverables, dirs[0]);

		// Verify all artifacts exist
		expect(fs.existsSync(path.join(weaveDir, 'analysis.json'))).toBe(true);
		expect(fs.existsSync(path.join(weaveDir, 'weave-report.md'))).toBe(true);
		expect(fs.existsSync(path.join(weaveDir, 'gate-predictions.json'))).toBe(true);
		expect(fs.existsSync(path.join(weaveDir, 'execution-log.md'))).toBe(true);
		expect(fs.existsSync(path.join(weaveDir, 'metadata.json'))).toBe(true);
	});

	it('should generate valid analysis.json', async () => {
		const autopilot = new AutopilotLevel1(context);
		const result = await autopilot.execute();

		expect(result.success).toBe(true);

		const deliverables = path.join(testDir, 'deliverables');
		const dirs = fs.readdirSync(deliverables);
		const weaveDir = path.join(deliverables, dirs[0]);
		const analysisPath = path.join(weaveDir, 'analysis.json');

		const content = fs.readFileSync(analysisPath, 'utf-8');
		const analysis = JSON.parse(content);

		expect(analysis.schemaVersion).toBe("1.0.0");
		expect(analysis.timestamp).toBeDefined();
		expect(analysis.plan).toBeDefined();
		expect(analysis.plan.nodes).toHaveLength(2);
		expect(analysis.mergeOrder).toBeDefined();
		expect(analysis.mergeOrder).toHaveLength(2);
		expect(analysis.mergeOrder[0]).toEqual(["item-1"]);
		expect(analysis.mergeOrder[1]).toEqual(["item-2"]);
		expect(analysis.recommendations).toBeDefined();
		expect(Array.isArray(analysis.recommendations)).toBe(true);
	});

	it('should generate valid weave-report.md', async () => {
		const autopilot = new AutopilotLevel1(context);
		const result = await autopilot.execute();

		expect(result.success).toBe(true);

		const deliverables = path.join(testDir, 'deliverables');
		const dirs = fs.readdirSync(deliverables);
		const weaveDir = path.join(deliverables, dirs[0]);
		const reportPath = path.join(weaveDir, 'weave-report.md');

		const content = fs.readFileSync(reportPath, 'utf-8');

		expect(content).toContain("# Merge-Weave Execution Report");
		expect(content).toContain("## Plan Summary");
		expect(content).toContain("## Merge Order");
		expect(content).toContain("**Level 1**: item-1");
		expect(content).toContain("**Level 2**: item-2");
		expect(content).toContain("## Items");
		expect(content).toContain("### item-1");
		expect(content).toContain("### item-2");
	});

	it('should generate valid gate-predictions.json', async () => {
		const autopilot = new AutopilotLevel1(context);
		const result = await autopilot.execute();

		expect(result.success).toBe(true);

		const deliverables = path.join(testDir, 'deliverables');
		const dirs = fs.readdirSync(deliverables);
		const weaveDir = path.join(deliverables, dirs[0]);
		const predictionsPath = path.join(weaveDir, 'gate-predictions.json');

		const content = fs.readFileSync(predictionsPath, 'utf-8');
		const data = JSON.parse(content);

		expect(data.schemaVersion).toBe("1.0.0");
		expect(data.timestamp).toBeDefined();
		expect(data.predictions).toBeDefined();
		expect(Array.isArray(data.predictions)).toBe(true);
		expect(data.predictions.length).toBe(2);

		const pred1 = data.predictions.find((p: any) => p.item === "item-1" && p.gate === "lint");
		expect(pred1).toBeDefined();
		expect(pred1.expectedStatus).toBe("pass");

		const pred2 = data.predictions.find((p: any) => p.item === "item-2" && p.gate === "test");
		expect(pred2).toBeDefined();
		expect(pred2.expectedStatus).toBe("pass");
	});

	it('should generate valid execution-log.md', async () => {
		const autopilot = new AutopilotLevel1(context);
		const result = await autopilot.execute();

		expect(result.success).toBe(true);

		const deliverables = path.join(testDir, 'deliverables');
		const dirs = fs.readdirSync(deliverables);
		const weaveDir = path.join(deliverables, dirs[0]);
		const logPath = path.join(weaveDir, 'execution-log.md');

		const content = fs.readFileSync(logPath, 'utf-8');

		expect(content).toContain("# Merge-Weave Execution Log");
		expect(content).toContain("## Pre-Execution Summary");
		expect(content).toContain("### Plan Generation ✅");
		expect(content).toContain("### Merge Order Computation ✅");
		expect(content).toContain("## Execution Steps");
		expect(content).toContain("### Level 1 Execution");
		expect(content).toContain("### Level 2 Execution");
	});

	it('should generate valid metadata.json', async () => {
		const autopilot = new AutopilotLevel1(context);
		const result = await autopilot.execute();

		expect(result.success).toBe(true);

		const deliverables = path.join(testDir, 'deliverables');
		const dirs = fs.readdirSync(deliverables);
		const weaveDir = path.join(deliverables, dirs[0]);
		const metadataPath = path.join(weaveDir, 'metadata.json');

		const content = fs.readFileSync(metadataPath, 'utf-8');
		const metadata = JSON.parse(content);

		expect(metadata.schemaVersion).toBe("1.0.0");
		expect(metadata.timestamp).toBeDefined();
		expect(metadata.runnerVersion).toBeDefined();
		expect(metadata.levelExecuted).toBe(1);
		expect(metadata.profilePath).toBe(testDir);
	});

	it('should fail when writing to role=example profile', async () => {
		const exampleContext: AutopilotContext = {
			...context,
			profileRole: "example"
		};

		const autopilot = new AutopilotLevel1(exampleContext);
		const result = await autopilot.execute();

		expect(result.success).toBe(false);
		expect(result.message).toContain("failed");
		expect(result.message).toContain("example");
	});

	it('should handle plan with no dependencies', async () => {
		const simplePlan: Plan = {
			schemaVersion: "1.0.0",
			target: "main",
			items: [
				{
					name: "item-a",
					deps: [],
					gates: []
				},
				{
					name: "item-b",
					deps: [],
					gates: []
				}
			]
		};

		const simpleContext: AutopilotContext = {
			plan: simplePlan,
			profilePath: testDir,
			profileRole: "local"
		};

		const autopilot = new AutopilotLevel1(simpleContext);
		const result = await autopilot.execute();

		expect(result.success).toBe(true);

		const deliverables = path.join(testDir, 'deliverables');
		const dirs = fs.readdirSync(deliverables);
		const weaveDir = path.join(deliverables, dirs[0]);
		const analysisPath = path.join(weaveDir, 'analysis.json');

		const content = fs.readFileSync(analysisPath, 'utf-8');
		const analysis = JSON.parse(content);

		expect(analysis.mergeOrder).toHaveLength(1);
		expect(analysis.mergeOrder[0]).toHaveLength(2);
	});
});
