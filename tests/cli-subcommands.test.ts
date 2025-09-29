import { describe, it, expect } from 'vitest';

describe('CLI subcommands contract', () => {
	describe('plan command', () => {
		it.todo('should exit with code 0 on successful plan generation');
		
		it.todo('should exit with code 2 on validation errors (unknown dependencies, invalid config)');
		
		it.todo('should exit with code 1 on unexpected failures (filesystem errors, missing files)');
		
		it.todo('should support --json flag with deterministic output');
		
		it.todo('should support --dry-run flag without writing files');
		
		it.todo('should support --out flag for custom output directory');
		
		it.todo('should validate required inputs exist (.smartergpt/stack.yml)');
	});

	describe('merge-order command', () => {
		it.todo('should exit with code 0 on successful merge order computation');
		
		it.todo('should exit with code 2 on validation errors (cycles, unknown dependencies)');
		
		it.todo('should exit with code 1 on unexpected failures (missing plan file)');
		
		it.todo('should support --json flag with deterministic levels output');
		
		it.todo('should accept plan file via --plan flag or positional argument');
		
		it.todo('should require plan file and error appropriately when missing');
	});

	describe('schema validate command', () => {
		it.todo('should exit with code 0 on valid plan.json');
		
		it.todo('should exit with code 2 on schema validation failures');
		
		it.todo('should exit with code 1 on file not found or read errors');
		
		it.todo('should support --json flag with structured error output');
		
		it.todo('should accept plan file via --plan flag or positional argument');
	});

	describe('execute command', () => {
		it.todo('should exit with code 0 when all gates pass');
		
		it.todo('should exit with code 1 when any gates fail or are blocked');
		
		it.todo('should exit with code 2 on plan validation failures');
		
		it.todo('should support --json flag with execution results');
		
		it.todo('should support --dry-run flag without executing gates');
		
		it.todo('should support --timeout flag for gate execution limits');
		
		it.todo('should support --status-table flag for PR comment generation');
	});

	describe('status command', () => {
		it.todo('should exit with code 0 on successful status computation');
		
		it.todo('should exit with code 2 on plan validation failures');
		
		it.todo('should exit with code 1 on unexpected failures');
		
		it.todo('should support --json flag with merge eligibility output');
		
		it.todo('should show current execution state and blocked/eligible items');
	});

	describe('report command', () => {
		it.todo('should exit with code 0 when all gates pass');
		
		it.todo('should exit with code 1 when any gates fail');
		
		it.todo('should exit with code 2 on validation errors (invalid gate result format)');
		
		it.todo('should support --out json flag with aggregated results');
		
		it.todo('should support --out md flag with markdown summary');
		
		it.todo('should validate gate result JSON schema compliance');
		
		it.todo('should require directory argument and error when missing');
	});

	describe('doctor command', () => {
		it.todo('should exit with code 0 when environment checks pass');
		
		it.todo('should exit with code 1 when environment issues detected');
		
		it.todo('should check Node.js version, platform, and working directory');
		
		it.todo('should validate plan.json existence and schema compliance');
		
		it.todo('should check .smartergpt directory structure');
	});

	describe('global CLI behavior', () => {
		it.todo('should show help with --help flag');
		
		it.todo('should show version with --version flag');
		
		it.todo('should error appropriately on unknown commands');
		
		it.todo('should error appropriately on unknown flags');
		
		it.todo('should maintain consistent exit code discipline across all commands');
	});
});