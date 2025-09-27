#!/usr/bin/env node
import { Command } from "commander";
import { createPlan, createPlanSnapshot } from "./core/plan.js";
import * as fs from "fs";
import * as path from "path";

const program = new Command();
program.name("lex-pr").description("Lex-PR Runner CLI").version("0.1.0");

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

program
	.command("plan")
	.description("Compute merge pyramid and freeze plan artifacts")
	.option("--out <dir>", "Artifacts output dir", ".smartergpt/runner")
	.option("--inputs <dir>", "Input files directory", ".smartergpt")
	.action(async (opts) => {
		const plan = await createPlan(opts.inputs);
		const snapshot = await createPlanSnapshot(opts.inputs);
		
		const outDir = opts.out as string;
		fs.mkdirSync(outDir, { recursive: true });
		
		// Write plan.json with deterministic formatting
		const planPath = path.join(outDir, "plan.json");
		fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");
		
		// Write snapshot.md
		const snapshotPath = path.join(outDir, "snapshot.md");
		const snapshotContent = generateSnapshotMarkdown(snapshot);
		fs.writeFileSync(snapshotPath, snapshotContent);
		
		console.log(`Wrote ${planPath}`);
		console.log(`Wrote ${snapshotPath}`);
	});

program
	.command("doctor")
	.description("Environment and config sanity checks")
	.action(async () => {
		console.log("doctor: TODO — check git, node, package manager, and .smartergpt/*");
	});

program.parseAsync(process.argv);
