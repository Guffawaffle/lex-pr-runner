#!/usr/bin/env node
import { Command } from "commander";
import { createPlan } from "./core/plan.js";
import { runDoctorChecks } from "./core/doctor.js";
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
		const planPath = path.join(outDir, "plan.json");
		fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
		console.log(`Wrote ${planPath}`);
	});

program
	.command("doctor")
	.description("Environment and config sanity checks")
	.action(async () => {
		const report = await runDoctorChecks();
		
		console.log("Environment Health Check");
		console.log("======================");
		
		for (const check of report.checks) {
			const status = check.passed ? "✓" : "✗";
			console.log(`${status} ${check.name}: ${check.message}`);
			
			if (!check.passed && check.fix) {
				console.log(`  Fix: ${check.fix}`);
			}
		}
		
		console.log();
		
		if (report.passed) {
			console.log("✓ All checks passed! Environment is healthy.");
			process.exit(0);
		} else {
			console.log("✗ Some checks failed. Please address the issues above.");
			process.exit(1);
		}
	});

program.parseAsync(process.argv);
