#!/usr/bin/env node
import { Command } from "commander";
import { createPlan, generateSnapshot } from "./core/plan.js";
import * as fs from "fs";
import * as path from "path";

const program = new Command();
program.name("lex-pr").description("Lex-PR Runner CLI").version("0.1.0");

program
	.command("plan")
	.description("Compute merge pyramid and freeze plan artifacts")
	.option("--out <dir>", "Artifacts output dir", ".smartergpt/runner")
	.action(async (opts) => {
		const plan = await createPlan();
		const outDir = opts.out as string;
		fs.mkdirSync(outDir, { recursive: true });
		
		// Write plan.json
		const planPath = path.join(outDir, "plan.json");
		fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
		console.log(`Wrote ${planPath}`);
		
		// Write snapshot.md
		const snapshot = await generateSnapshot(plan);
		const snapshotPath = path.join(outDir, "snapshot.md");
		fs.writeFileSync(snapshotPath, snapshot);
		console.log(`Wrote ${snapshotPath}`);
	});

program
	.command("doctor")
	.description("Environment and config sanity checks")
	.action(async () => {
		console.log("doctor: TODO — check git, node, package manager, and .smartergpt/*");
	});

program.parseAsync(process.argv);
