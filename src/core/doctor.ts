import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

export interface CheckResult {
	name: string;
	passed: boolean;
	message: string;
	fix?: string;
}

export interface DoctorReport {
	passed: boolean;
	checks: CheckResult[];
}

export async function runDoctorChecks(): Promise<DoctorReport> {
	const checks: CheckResult[] = [];

	// Check git presence
	checks.push(checkGitPresent());

	// Check gh (GitHub CLI) presence
	checks.push(checkGhPresent());

	// Check Node.js version (20+)
	checks.push(checkNodeVersion());

	// Check write permissions to .smartergpt/runner
	checks.push(checkSmartergptRunnerWritePerms());

	const passed = checks.every(check => check.passed);

	return {
		passed,
		checks
	};
}

function checkGitPresent(): CheckResult {
	try {
		execSync("git --version", { stdio: "pipe" });
		return {
			name: "Git",
			passed: true,
			message: "Git is installed and available"
		};
	} catch (error) {
		return {
			name: "Git",
			passed: false,
			message: "Git is not installed or not in PATH",
			fix: "Install Git: https://git-scm.com/downloads"
		};
	}
}

function checkGhPresent(): CheckResult {
	try {
		execSync("gh --version", { stdio: "pipe" });
		return {
			name: "GitHub CLI",
			passed: true,
			message: "GitHub CLI is installed and available"
		};
	} catch (error) {
		return {
			name: "GitHub CLI",
			passed: false,
			message: "GitHub CLI (gh) is not installed or not in PATH",
			fix: "Install GitHub CLI: https://cli.github.com/ or run 'npm install -g @github/cli'"
		};
	}
}

function checkNodeVersion(): CheckResult {
	try {
		const version = process.version;
		const majorVersion = parseInt(version.slice(1).split(".")[0]);
		
		if (majorVersion >= 20) {
			return {
				name: "Node.js Version",
				passed: true,
				message: `Node.js ${version} is supported (>= 20.0.0)`
			};
		} else {
			return {
				name: "Node.js Version",
				passed: false,
				message: `Node.js ${version} is too old (< 20.0.0)`,
				fix: "Update Node.js to version 20 or higher: https://nodejs.org/en/download/"
			};
		}
	} catch (error) {
		return {
			name: "Node.js Version",
			passed: false,
			message: "Could not determine Node.js version",
			fix: "Ensure Node.js is properly installed: https://nodejs.org/en/download/"
		};
	}
}

function checkSmartergptRunnerWritePerms(): CheckResult {
	try {
		const smartergptDir = ".smartergpt";
		const runnerDir = path.join(smartergptDir, "runner");
		
		// Ensure the directories exist
		fs.mkdirSync(runnerDir, { recursive: true });
		
		// Try to write a test file
		const testFile = path.join(runnerDir, ".write-test");
		fs.writeFileSync(testFile, "test");
		fs.unlinkSync(testFile);
		
		return {
			name: "Write Permissions",
			passed: true,
			message: "Write permissions to .smartergpt/runner are available"
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return {
			name: "Write Permissions",
			passed: false,
			message: `Cannot write to .smartergpt/runner: ${errorMessage}`,
			fix: "Check directory permissions or run with appropriate privileges"
		};
	}
}