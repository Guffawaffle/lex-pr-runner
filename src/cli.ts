#!/usr/bin/env node
import { Command } from "commander";
import { createPlan, computePlanLevels, Plan } from "./core/plan.js";
import { CycleError, MissingNodeError } from "./core/dag.js";
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
	.command("levels")
	.description("Show dependency levels for a plan")
	.argument("[plan-file]", "Path to plan.json file", "plan.json")
	.option("--json", "Output JSON format", false)
	.action(async (planFile: string, opts) => {
		try {
			if (!fs.existsSync(planFile)) {
				console.error(`Plan file not found: ${planFile}`);
				process.exit(1);
			}

			const planData = JSON.parse(fs.readFileSync(planFile, "utf-8")) as Plan;
			const result = computePlanLevels(planData);

			if (opts.json) {
				console.log(JSON.stringify({
					levels: result.levels,
					namedLevels: result.namedLevels
				}, null, 2));
			} else {
				console.log("Dependency Levels:");
				result.namedLevels.forEach((level, index) => {
					console.log(`  Level ${index}: ${level.join(", ")}`);
				});
			}
		} catch (error) {
			if (error instanceof CycleError) {
				console.error(`Error: ${error.message}`);
				process.exit(2);
			} else if (error instanceof MissingNodeError) {
				console.error(`Error: ${error.message}`);
				process.exit(3);
			} else {
				console.error(`Unexpected error: ${error}`);
				process.exit(1);
			}
		}
	});

program
	.command("doctor")
	.description("Environment and config sanity checks")
	.action(async () => {
		console.log("doctor: TODO — check git, node, package manager, and .smartergpt/*");
	});

program.parseAsync(process.argv);
