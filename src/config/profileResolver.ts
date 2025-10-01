/**
 * Profile resolver with manifest support
 * Implements precedence chain: --profile-dir → LEX_PR_PROFILE_DIR → .smartergpt.local/ → .smartergpt/
 */

import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";

/**
 * Profile manifest schema
 */
export interface ProfileManifest {
	role: string;
	name?: string;
	version?: string;
}

/**
 * Resolved profile information
 */
export interface ResolvedProfile {
	path: string; // Absolute path to profile directory
	manifest: ProfileManifest;
}

/**
 * Resolve profile directory with precedence chain
 * 
 * Precedence order:
 * 1. --profile-dir flag (passed as parameter)
 * 2. LEX_PR_PROFILE_DIR environment variable
 * 3. .smartergpt.local/ (local override, not tracked)
 * 4. .smartergpt/ (tracked example profile)
 * 
 * @param profileDirFlag - Profile directory from CLI flag (optional)
 * @param baseDir - Base directory to resolve relative paths (default: current working directory)
 * @returns Resolved profile with absolute path and manifest
 */
export function resolveProfile(
	profileDirFlag?: string,
	baseDir: string = process.cwd()
): ResolvedProfile {
	let profilePath: string | undefined;
	let source: string;

	// Precedence 1: --profile-dir flag
	if (profileDirFlag) {
		profilePath = path.isAbsolute(profileDirFlag)
			? profileDirFlag
			: path.resolve(baseDir, profileDirFlag);
		source = "--profile-dir";
	}
	// Precedence 2: LEX_PR_PROFILE_DIR environment variable
	else if (process.env.LEX_PR_PROFILE_DIR) {
		profilePath = path.isAbsolute(process.env.LEX_PR_PROFILE_DIR)
			? process.env.LEX_PR_PROFILE_DIR
			: path.resolve(baseDir, process.env.LEX_PR_PROFILE_DIR);
		source = "LEX_PR_PROFILE_DIR";
	}
	// Precedence 3: .smartergpt.local/ (local override)
	else {
		const localPath = path.resolve(baseDir, ".smartergpt.local");
		if (fs.existsSync(localPath)) {
			profilePath = localPath;
			source = ".smartergpt.local/";
		}
		// Precedence 4: .smartergpt/ (tracked profile)
		else {
			profilePath = path.resolve(baseDir, ".smartergpt");
			source = ".smartergpt/";
		}
	}

	// Read manifest file if present
	const manifestPath = path.join(profilePath, "profile.yml");
	let manifest: ProfileManifest;

	try {
		const content = fs.readFileSync(manifestPath, "utf8");
		const parsed = YAML.parse(content);
		manifest = {
			role: parsed.role || "example",
			name: parsed.name,
			version: parsed.version
		};
	} catch (error) {
		// Default manifest for .smartergpt/ when no profile.yml exists
		if (source === ".smartergpt/") {
			manifest = { role: "example" };
		} else {
			// For other sources, missing manifest is an error
			throw new ProfileResolverError(
				`Profile directory "${profilePath}" (from ${source}) is missing profile.yml manifest`
			);
		}
	}

	// Emit telemetry breadcrumb
	emitTelemetry(profilePath, manifest.role);

	return {
		path: profilePath,
		manifest
	};
}

/**
 * Emit telemetry breadcrumb on profile resolution
 */
function emitTelemetry(profilePath: string, role: string): void {
	console.log(`lex-pr-runner using profile: ${profilePath} (role: ${role})`);
}

/**
 * Profile resolver error
 */
export class ProfileResolverError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ProfileResolverError";
	}
}
