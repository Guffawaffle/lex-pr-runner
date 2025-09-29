#!/usr/bin/env node
import { Command } from "commander";
import { Plan, loadPlan, SchemaValidationError } from "./schema.js";
import { computeMergeOrder, CycleError, UnknownDependencyError } from "./mergeOrder.js";
import { executeGatesWithPolicy } from "./gates.js";
import { ExecutionState } from "./executionState.js";
import { MergeEligibilityEvaluator } from "./mergeEligibility.js";
import { loadInputs } from "./core/inputs.js";
import { generatePlan, generateEmptyPlan } from "./core/plan.js";
import { generateSnapshot, generatePlanSummary } from "./core/snapshot.js";
import { canonicalJSONStringify } from "./util/canonicalJson.js";
import { readGateDir, generateMarkdownSummary } from "./report/aggregate.js";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

/**
 * CLI exit discipline with proper error codes
 */
function exitWith(e: unknown, schemaCode = "ESCHEMA") {
  const err: any = e;
  if (err?.code === schemaCode && Array.isArray(err.issues)) {
    console.log(JSON.stringify({ errors: err.issues }, null, 2));
    console.error(err.message);
    process.exit(2);
  }
  if (e instanceof SchemaValidationError || e instanceof CycleError || e instanceof UnknownDependencyError) {
    console.error(String(err?.message ?? e));
    process.exit(2); // Validation errors
  }
  console.error(String(err?.message ?? e));
  process.exit(1); // Unexpected failures
}

const program = new Command();
program.name("lex-pr").description("Lex-PR Runner CLI - TypeScript Implementation").version("0.1.0");

// Schema validation command
program
	.command("schema")
	.description("Schema operations")
	.addCommand(
		new Command("validate")
			.description("Validate plan.json against schema")
			.option("--plan <file>", "Path to plan.json file")
			.argument("[file]", "Path to plan.json file (alternative to --plan)")
			.option("--json", "Output machine-readable JSON errors")
			.action((file: string | undefined, opts) => {
				const planFile = opts.plan || file;
				if (!planFile) {
					console.error("Error: plan file is required (use --plan <file> or provide as argument)");
					process.exit(1);
				}

				try {
					const planContent = fs.readFileSync(planFile, "utf-8");
					const plan = loadPlan(planContent);

					if (opts.json) {
						console.log(JSON.stringify({ valid: true }));
					} else {
						console.log(`✓ ${planFile} is valid`);
					}
					process.exit(0);
				} catch (error) {
					if (error instanceof SchemaValidationError) {
						if (opts.json) {
							const errorJson = error.toJSON();
							console.log(JSON.stringify({ valid: false, errors: errorJson.errors }, null, 2));
						} else {
							console.error(`✗ ${planFile} validation failed:`);
							error.issues.forEach(issue => {
								console.error(`  ${issue.path.join('.')}: ${issue.message}`);
							});
						}
						process.exit(1);
					} else {
						const message = error instanceof Error ? error.message : String(error);
						if (opts.json) {
							console.log(JSON.stringify({ valid: false, errors: [message] }));
						} else {
							console.error(`Error validating ${planFile}: ${message}`);
						}
						process.exit(1);
					}
				}
			})
	);

// Plan generation command
program
	.command("plan")
	.description("Generate plan from configuration sources")
	.option("--out <dir>", "Output directory for artifacts", ".smartergpt/runner")
	.option("--json", "Output canonical plan JSON to stdout only")
	.option("--dry-run", "Validate inputs and show what would be written")
	.action(async (opts) => {
		try {
			// Load inputs with deterministic ordering
			const inputs = loadInputs();

			// Generate normalized plan
			const plan = inputs.items.length > 0 ? generatePlan(inputs) : generateEmptyPlan(inputs.target);

			// Validate plan structure
			const validatedPlan = loadPlan(canonicalJSONStringify(plan));

			if (opts.json) {
				// JSON mode: output only canonical plan to stdout, write nothing else
				process.stdout.write(canonicalJSONStringify(validatedPlan));
				process.exit(0);
			}

			// Generate artifacts
			const planJSON = canonicalJSONStringify(validatedPlan);
			const snapshot = generateSnapshot(validatedPlan, inputs);

			if (opts.dryRun) {
				console.log("Dry run - would generate:");
				console.log(`📁 ${path.join(opts.out, "plan.json")} (${planJSON.length} bytes)`);
				console.log(`📁 ${path.join(opts.out, "snapshot.md")} (${snapshot.length} bytes)`);
				console.log("");
				console.log(generatePlanSummary(validatedPlan));
				process.exit(0);
			}

			// Write artifacts
			const outDir = opts.out;
			fs.mkdirSync(outDir, { recursive: true });

			const planPath = path.join(outDir, "plan.json");
			const snapshotPath = path.join(outDir, "snapshot.md");

			fs.writeFileSync(planPath, planJSON);
			fs.writeFileSync(snapshotPath, snapshot);

			console.log(`✓ Generated plan artifacts:`);
			console.log(`  📁 ${planPath}`);
			console.log(`  📁 ${snapshotPath}`);
			console.log("");
			console.log(generatePlanSummary(validatedPlan));

			process.exit(0);
		} catch (error) {
			exitWith(error);
		}
	});

// Merge order command
program
	.command("merge-order")
	.description("Compute dependency levels and merge order")
	.option("--plan <file>", "Path to plan.json file")
	.argument("[file]", "Path to plan.json file (alternative to --plan)")
	.option("--json", "Output JSON format")
	.action((file: string | undefined, opts) => {
		const planFile = opts.plan || file;
		if (!planFile) {
			console.error("Error: plan file is required (use --plan <file> or provide as argument)");
			process.exit(1);
		}

		try {
			const planContent = fs.readFileSync(planFile, "utf-8");
			const plan = loadPlan(planContent);
			const levels = computeMergeOrder(plan);

			if (opts.json) {
				console.log(canonicalJSONStringify({ levels }));
			} else {
				console.log(`Merge order for ${plan.items.length} items:`);
				levels.forEach((level: string[], index: number) => {
					console.log(`Level ${index + 1}: [${level.join(', ')}]`);
				});
			}
			process.exit(0);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (opts.json) {
				console.log(canonicalJSONStringify({ error: message }));
			} else {
				console.error(`Error computing merge order: ${message}`);
			}
			exitWith(error);
		}
	});

// Execute plan command (replaces gate command)
program
	.command("execute")
	.description("Execute plan with policy-aware gate running and status tracking")
	.option("--plan <file>", "Path to plan.json file", "plan.json")
	.argument("[file]", "Path to plan.json file (alternative to --plan)")
	.option("--artifact-dir <dir>", "Output directory for artifacts", "./artifacts")
	.option("--timeout <ms>", "Gate timeout in milliseconds", "30000")
	.option("--dry-run", "Validate plan and show execution order without running gates")
	.option("--json", "Output results in JSON format")
	.option("--status-table", "Generate status table for PR comments")
	.action(async (file: string | undefined, opts) => {
		const planFile = opts.plan || file || "plan.json";

		try {
			const planContent = fs.readFileSync(planFile, "utf-8");
			const plan = loadPlan(planContent);
			const timeoutMs = parseInt(opts.timeout);

			// Create execution state
			const executionState = new ExecutionState(plan);
			const evaluator = new MergeEligibilityEvaluator(plan, executionState);

			// Validate and show execution order
			const levels = computeMergeOrder(plan);

			if (opts.dryRun) {
				console.log("Dry run - Plan validation successful");
				console.log(`Plan contains ${plan.items.length} items in ${levels.length} levels:`);
				levels.forEach((level: string[], index: number) => {
					console.log(`  Level ${index + 1}: [${level.join(', ')}]`);
				});

				if (plan.policy) {
					console.log(`Policy: ${plan.policy.maxWorkers} max workers, ${Object.keys(plan.policy.retries).length} retry configs`);
				}

				process.exit(0);
			}

			console.log(`Executing plan: ${plan.items.length} items, ${levels.length} levels`);

			// Execute gates with policy
			await executeGatesWithPolicy(plan, executionState, opts.artifactDir, timeoutMs);

			// Get final results
			const results = executionState.getResults();
			const mergeSummary = evaluator.getMergeSummary();

			if (opts.json) {
				// Output JSON results
				const output = {
					plan: {
						schemaVersion: plan.schemaVersion,
						target: plan.target,
						itemCount: plan.items.length
					},
					execution: {
						results: Object.fromEntries(results),
						mergeSummary,
						artifactDir: opts.artifactDir
					}
				};
				console.log(canonicalJSONStringify(output));
			} else if (opts.statusTable) {
				// Generate status table for PR comments
				generateStatusTable(results, mergeSummary);
			} else {
				// Human-readable output
				console.log("\n=== Execution Results ===");
				for (const [name, result] of results) {
					const statusIcon = getStatusIcon(result.status);
					console.log(`${statusIcon} ${name}: ${result.status}`);

					if (result.gates.length > 0) {
						for (const gate of result.gates) {
							const gateIcon = getStatusIcon(gate.status);
							const duration = gate.duration ? ` (${gate.duration}ms)` : '';
							console.log(`  ${gateIcon} ${gate.gate}${duration}`);
						}
					}
				}

				console.log("\n=== Merge Summary ===");
				console.log(`Eligible: ${mergeSummary.eligible.length} - [${mergeSummary.eligible.join(', ')}]`);
				console.log(`Pending: ${mergeSummary.pending.length} - [${mergeSummary.pending.join(', ')}]`);
				console.log(`Blocked: ${mergeSummary.blocked.length} - [${mergeSummary.blocked.join(', ')}]`);
				console.log(`Failed: ${mergeSummary.failed.length} - [${mergeSummary.failed.join(', ')}]`);
			}

			// Exit with appropriate code
			const hasFailures = mergeSummary.failed.length > 0 || mergeSummary.blocked.length > 0;
			process.exit(hasFailures ? 1 : 0);

		} catch (error) {
			console.error(`Error executing plan: ${error instanceof Error ? error.message : String(error)}`);
			// Use exit code 2 for validation errors, 1 for others
			if (error instanceof SchemaValidationError || error instanceof CycleError || error instanceof UnknownDependencyError) {
				process.exit(2);
			} else {
				process.exit(1);
			}
		}
	});

// Status command
program
	.command("status")
	.description("Show current execution status and merge eligibility")
	.option("--plan <file>", "Path to plan.json file", "plan.json")
	.argument("[file]", "Path to plan.json file (alternative to --plan)")
	.option("--json", "Output JSON format")
	.action((file: string | undefined, opts) => {
		const planFile = opts.plan || file || "plan.json";

		try {
			const planContent = fs.readFileSync(planFile, "utf-8");
			const plan = loadPlan(planContent);

			// For now, show plan structure and policy
			// In a full implementation, this would load execution state from artifacts
			const executionState = new ExecutionState(plan);
			const evaluator = new MergeEligibilityEvaluator(plan, executionState);
			const mergeSummary = evaluator.getMergeSummary();

			if (opts.json) {
				console.log(canonicalJSONStringify({
					plan: {
						schemaVersion: plan.schemaVersion,
						target: plan.target,
						itemCount: plan.items.length,
						policy: plan.policy
					},
					mergeSummary
				}));
			} else {
				console.log(`Plan: ${plan.items.length} items targeting ${plan.target}`);
				console.log(`Schema version: ${plan.schemaVersion}`);
				if (plan.policy) {
					console.log(`Policy: ${plan.policy.maxWorkers} max workers, merge rule: ${plan.policy.mergeRule.type}`);
				}
				console.log(`Status: ${mergeSummary.eligible.length} eligible, ${mergeSummary.pending.length} pending, ${mergeSummary.failed.length} failed`);
			}
		} catch (error) {
			console.error(`Error getting status: ${error instanceof Error ? error.message : String(error)}`);
			// Use exit code 2 for validation errors, 1 for others
			if (error instanceof SchemaValidationError || error instanceof CycleError || error instanceof UnknownDependencyError) {
				process.exit(2);
			} else {
				process.exit(1);
			}
		}
	});

// Report command
program
	.command("report")
	.description("Aggregate gate reports from directory")
	.argument("<dir>", "Directory containing *.json gate result files")
	.option("--out <format>", "Output format: 'json' or 'md'", "json")
	.action((dir: string, opts) => {
		try {
			const report = readGateDir(dir);
			
			if (opts.out === 'md') {
				const markdown = generateMarkdownSummary(report);
				console.log(markdown);
			} else if (opts.out === 'json') {
				console.log(canonicalJSONStringify(report));
			} else {
				console.error(`Invalid output format: ${opts.out}. Use 'json' or 'md'.`);
				process.exit(1);
			}
			
			// Exit with error code if not all green
			process.exit(report.allGreen ? 0 : 1);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`Error aggregating gate reports: ${message}`);
			process.exit(1);
		}
	});

// Doctor command
program
	.command("doctor")
	.description("Environment and config sanity checks")
	.action(async () => {
		let hasErrors = false;

		console.log("🏥 lex-pr doctor - Environment and toolchain verification\n");

		// Check basic environment
		console.log("Environment:");
		console.log("✓ Platform:", process.platform);
		console.log("✓ CWD:", process.cwd());

		// Toolchain alignment checks (critical for lockfile stability)
		console.log("\nToolchain Alignment:");

		try {
			// Load package.json to get required versions
			const packageJsonPath = path.join(process.cwd(), "package.json");
			if (!fs.existsSync(packageJsonPath)) {
				console.log("✗ package.json not found");
				hasErrors = true;
			} else {
				const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
				const requiredNodeVersion = packageJson.engines?.node;
				const requiredNpmVersion = packageJson.engines?.npm;
				const packageManager = packageJson.packageManager;

				// Check Node.js version
				const currentNodeVersion = process.version; // e.g., "v20.19.5"
				const nodeVersionWithoutV = currentNodeVersion.startsWith('v') ? currentNodeVersion.slice(1) : currentNodeVersion;
				
				if (requiredNodeVersion && requiredNodeVersion !== nodeVersionWithoutV) {
					console.log(`✗ Node.js version mismatch: required ${requiredNodeVersion}, got ${nodeVersionWithoutV}`);
					hasErrors = true;
				} else if (requiredNodeVersion) {
					console.log(`✓ Node.js: ${nodeVersionWithoutV} (matches required ${requiredNodeVersion})`);
				} else {
					console.log(`⚠ Node.js: ${nodeVersionWithoutV} (no engine requirement specified)`);
				}

				// Check npm version
				try {
					const npmVersionOutput = execSync("npm --version", { encoding: "utf-8" }).trim();
					if (requiredNpmVersion && requiredNpmVersion !== npmVersionOutput) {
						console.log(`✗ npm version mismatch: required ${requiredNpmVersion}, got ${npmVersionOutput}`);
						hasErrors = true;
					} else if (requiredNpmVersion) {
						console.log(`✓ npm: ${npmVersionOutput} (matches required ${requiredNpmVersion})`);
					} else {
						console.log(`⚠ npm: ${npmVersionOutput} (no engine requirement specified)`);
					}
				} catch (error) {
					console.log("✗ npm version check failed:", error instanceof Error ? error.message : String(error));
					hasErrors = true;
				}

				// Check package manager consistency
				if (packageManager) {
					const expectedNpmVersion = packageManager.replace('npm@', '');
					try {
						const actualNpmVersion = execSync("npm --version", { encoding: "utf-8" }).trim();
						if (expectedNpmVersion !== actualNpmVersion) {
							console.log(`✗ packageManager mismatch: expected npm@${expectedNpmVersion}, got npm@${actualNpmVersion}`);
							hasErrors = true;
						} else {
							console.log(`✓ packageManager: npm@${actualNpmVersion} (matches ${packageManager})`);
						}
					} catch (error) {
						console.log("✗ packageManager verification failed:", error instanceof Error ? error.message : String(error));
						hasErrors = true;
					}
				}

				// Check .nvmrc consistency
				const nvmrcPath = path.join(process.cwd(), ".nvmrc");
				if (fs.existsSync(nvmrcPath)) {
					const nvmrcVersion = fs.readFileSync(nvmrcPath, "utf-8").trim();
					if (requiredNodeVersion && nvmrcVersion !== requiredNodeVersion) {
						console.log(`✗ .nvmrc mismatch: .nvmrc has ${nvmrcVersion}, package.json engines.node has ${requiredNodeVersion}`);
						hasErrors = true;
					} else if (nvmrcVersion === nodeVersionWithoutV) {
						console.log(`✓ .nvmrc: ${nvmrcVersion} (matches current Node.js version)`);
					} else {
						console.log(`✗ .nvmrc version mismatch: .nvmrc has ${nvmrcVersion}, current Node.js is ${nodeVersionWithoutV}`);
						hasErrors = true;
					}
				} else {
					console.log("⚠ .nvmrc not found (recommended for version consistency)");
				}
			}
		} catch (error) {
			console.log("✗ Toolchain verification failed:", error instanceof Error ? error.message : String(error));
			hasErrors = true;
		}

		// Check git status
		console.log("\nGit Repository:");
		try {
			execSync("git status --porcelain", { stdio: "pipe" });
			console.log("✓ Git repository detected");
		} catch (error) {
			console.log("✗ Not in a git repository or git not available");
			hasErrors = true;
		}

		// Check plan.json
		console.log("\nPlan Validation:");
		const planExists = fs.existsSync("plan.json");
		if (planExists) {
			console.log("✓ plan.json found");
			try {
				const planContent = fs.readFileSync("plan.json", "utf-8");
				const plan = loadPlan(planContent);
				console.log(`✓ plan.json valid (${plan.items.length} items, schema ${plan.schemaVersion})`);
			} catch (error) {
				console.log("✗ plan.json validation failed:", error instanceof Error ? error.message : String(error));
				hasErrors = true;
			}
		} else {
			console.log("ℹ plan.json not found (run 'lex-pr plan' to generate)");
		}

		// Check .smartergpt configuration
		console.log("\nWorkspace Configuration:");
		const smartergptDir = path.join(process.cwd(), ".smartergpt");
		if (fs.existsSync(smartergptDir)) {
			console.log("✓ .smartergpt directory found");
			
			const configFiles = ["scope.yml", "gates.yml"];
			for (const file of configFiles) {
				const filePath = path.join(smartergptDir, file);
				if (fs.existsSync(filePath)) {
					console.log(`✓ .smartergpt/${file} found`);
				} else {
					console.log(`⚠ .smartergpt/${file} not found`);
				}
			}
		} else {
			console.log("⚠ .smartergpt directory not found");
		}

		// Check lockfile consistency (critical for deterministic builds)
		console.log("\nLockfile Consistency:");
		const lockfilePath = path.join(process.cwd(), "package-lock.json");
		if (fs.existsSync(lockfilePath)) {
			console.log("✓ package-lock.json found");
			// TODO: Add deeper lockfile integrity checks in future iterations
		} else {
			console.log("⚠ package-lock.json not found (run 'npm install' to generate)");
		}

		console.log("\n" + "=".repeat(50));
		if (hasErrors) {
			console.log("❌ Doctor check FAILED - Fix toolchain mismatches before lockfile operations");
			console.log("\nRecommended actions:");
			console.log("1. Use 'nvm use' to switch to the required Node.js version");
			console.log("2. Install matching npm version with 'npm install -g npm@<version>'");
			console.log("3. Regenerate lockfile only after toolchain alignment");
			process.exit(1);
		} else {
			console.log("✅ Doctor check PASSED - Toolchain aligned for deterministic builds");
			process.exit(0);
		}
	});

program.parseAsync(process.argv);

/**
 * Helper functions for CLI output
 */

function getStatusIcon(status: string): string {
	switch (status) {
		case "pass": return "✓";
		case "fail": return "✗";
		case "blocked": return "⛔";
		case "skipped": return "⏭";
		case "retrying": return "🔄";
		default: return "?";
	}
}

function generateStatusTable(results: Map<string, any>, mergeSummary: any): void {
	console.log("\n## Execution Status Table");
	console.log("");
	console.log("| Node | Status | Gates | Eligible | Details |");
	console.log("|------|--------|-------|----------|---------|");

	for (const [name, result] of results) {
		const statusIcon = getStatusIcon(result.status);
		const gateCount = result.gates.length;
		const eligible = result.eligibleForMerge ? "✓" : "✗";

		let gateDetails = "";
		if (gateCount > 0) {
			const passed = result.gates.filter((g: any) => g.status === "pass").length;
			const failed = result.gates.filter((g: any) => g.status === "fail").length;
			gateDetails = `${passed}/${gateCount} passed`;
			if (failed > 0) gateDetails += `, ${failed} failed`;
		}

		console.log(`| ${name} | ${statusIcon} ${result.status} | ${gateCount} | ${eligible} | ${gateDetails} |`);
	}

	console.log("");
	console.log("### Summary");
	console.log(`- **Eligible**: ${mergeSummary.eligible.length} nodes ready for merge`);
	console.log(`- **Pending**: ${mergeSummary.pending.length} nodes waiting`);
	console.log(`- **Failed**: ${mergeSummary.failed.length} nodes with failures`);
	console.log(`- **Blocked**: ${mergeSummary.blocked.length} nodes blocked by dependencies`);
}
