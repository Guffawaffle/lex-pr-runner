import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('CLI init-local Integration Tests', () => {
	let tempDir: string;
	let cliPath: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-local-test-'));
		cliPath = path.resolve(__dirname, '../dist/cli.js');
	});

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true });
		}
	});

	it('should initialize local overlay with generic project type', () => {
		const output = execSync(`node "${cliPath}" init-local`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		expect(output).toContain('Local overlay initialized successfully');
		expect(output).toContain('Project type: generic');
		expect(output).toContain('Role: development');

		// Verify directory and files created
		expect(fs.existsSync(path.join(tempDir, '.smartergpt.local'))).toBe(true);
		expect(fs.existsSync(path.join(tempDir, '.smartergpt.local', 'profile.yml'))).toBe(true);
	});

	it('should detect Node.js project type', () => {
		fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name":"test"}');

		const output = execSync(`node "${cliPath}" init-local`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		expect(output).toContain('Project type: nodejs');
	});

	it('should detect Python project type', () => {
		fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'requests==2.28.0');

		const output = execSync(`node "${cliPath}" init-local`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		expect(output).toContain('Project type: python');
	});

	it('should output JSON format', () => {
		const output = execSync(`node "${cliPath}" init-local --json`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		const result = JSON.parse(output);
		expect(result.created).toBe(true);
		expect(result.config.role).toBe('development');
		expect(result.config.projectType).toBe('generic');
		expect(Array.isArray(result.copiedFiles)).toBe(true);
	});

	it('should be no-op on second run', () => {
		// First run
		execSync(`node "${cliPath}" init-local`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		// Second run
		const output = execSync(`node "${cliPath}" init-local`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		expect(output).toContain('Local overlay already exists');
		expect(output).toContain('Use --force to recreate');
	});

	it('should force recreation with --force flag', () => {
		// First run
		execSync(`node "${cliPath}" init-local`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		// Create a custom file
		fs.writeFileSync(path.join(tempDir, '.smartergpt.local', 'custom.txt'), 'custom');

		// Force recreation
		const output = execSync(`node "${cliPath}" init-local --force`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		expect(output).toContain('Local overlay initialized successfully');
		expect(fs.existsSync(path.join(tempDir, '.smartergpt.local', 'custom.txt'))).toBe(false);
	});

	it('should copy files from .smartergpt/ if it exists', () => {
		// Create .smartergpt directory with files
		const smartergptDir = path.join(tempDir, '.smartergpt');
		fs.mkdirSync(smartergptDir, { recursive: true });
		fs.writeFileSync(path.join(smartergptDir, 'intent.md'), '# Intent');
		fs.writeFileSync(path.join(smartergptDir, 'scope.yml'), 'version: 1');

		const output = execSync(`node "${cliPath}" init-local`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		expect(output).toContain('Copied files from .smartergpt/');
		expect(output).toContain('intent.md');
		expect(output).toContain('scope.yml');

		// Verify files were copied
		expect(fs.existsSync(path.join(tempDir, '.smartergpt.local', 'intent.md'))).toBe(true);
		expect(fs.existsSync(path.join(tempDir, '.smartergpt.local', 'scope.yml'))).toBe(true);
	});

	it('should have deterministic JSON output', () => {
		fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name":"test"}');

		// Run twice
		const output1 = execSync(`node "${cliPath}" init-local --json`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		// Remove the directory for second run
		fs.rmSync(path.join(tempDir, '.smartergpt.local'), { recursive: true });

		const output2 = execSync(`node "${cliPath}" init-local --json`, {
			cwd: tempDir,
			encoding: 'utf8'
		});

		// Parse and compare (ignoring path which will be absolute)
		const result1 = JSON.parse(output1);
		const result2 = JSON.parse(output2);

		expect(result1.created).toBe(result2.created);
		expect(result1.config).toEqual(result2.config);
		expect(result1.copiedFiles).toEqual(result2.copiedFiles);
	});
});
