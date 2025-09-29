import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Doctor Command Integration', () => {
	let tempDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-test-'));
		process.chdir(tempDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it('should pass when toolchain versions match exactly', () => {
		// Create a package.json with current Node/npm versions
		const currentNodeVersion = process.version.startsWith('v') ? process.version.slice(1) : process.version;
		const currentNpmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();

		const packageJson = {
			name: 'test-project',
			version: '1.0.0',
			engines: {
				node: currentNodeVersion,
				npm: currentNpmVersion
			},
			packageManager: `npm@${currentNpmVersion}`
		};

		fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
		fs.writeFileSync('.nvmrc', currentNodeVersion);

		// Initialize git repo
		execSync('git init', { stdio: 'pipe' });
		execSync('git config user.email "test@example.com"', { stdio: 'pipe' });
		execSync('git config user.name "Test User"', { stdio: 'pipe' });

		// Create a simple valid plan.json
		const simplePlan = {
			schemaVersion: '1.0.0',
			target: 'main',
			items: [],
			policy: {
				requiredGates: ['lint'],
				maxWorkers: 1
			}
		};
		fs.writeFileSync('plan.json', JSON.stringify(simplePlan, null, 2));

		// Create .smartergpt directory with required files
		fs.mkdirSync('.smartergpt');
		fs.writeFileSync('.smartergpt/scope.yml', 'version: 1\nscope: test');
		fs.writeFileSync('.smartergpt/gates.yml', 'version: 1\nlevels:\n  default:\n    - name: lint\n      run: echo test');

		// Test the doctor command
		try {
			const output = execSync(`node ${path.join(originalCwd, 'dist/cli.js')} doctor`, { 
				encoding: 'utf-8',
				stdio: 'pipe'
			});
			
			expect(output).toContain('✅ Doctor check PASSED');
			expect(output).toContain('Toolchain aligned for deterministic builds');
		} catch (error: any) {
			// If doctor failed, let's see why
			console.log('Doctor output:', error.stdout);
			console.log('Doctor error:', error.stderr);
			throw error;
		}
	});

	it('should fail when Node.js version mismatches', () => {
		// Create package.json with different Node version
		const currentNpmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
		const packageJson = {
			name: 'test-project',
			version: '1.0.0',
			engines: {
				node: '18.0.0', // Different from current
				npm: currentNpmVersion
			},
			packageManager: `npm@${currentNpmVersion}`
		};

		fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
		fs.writeFileSync('.nvmrc', '18.0.0');

		// Initialize git repo
		execSync('git init', { stdio: 'pipe' });
		execSync('git config user.email "test@example.com"', { stdio: 'pipe' });
		execSync('git config user.name "Test User"', { stdio: 'pipe' });

		try {
			execSync(`node ${path.join(originalCwd, 'dist/cli.js')} doctor`, { 
				encoding: 'utf-8',
				stdio: 'pipe'
			});
			// Should not reach here
			expect.fail('Doctor should have failed due to version mismatch');
		} catch (error: any) {
			expect(error.status).toBe(1); // Exit code should be 1
			expect(error.stdout).toContain('❌ Doctor check FAILED');
			expect(error.stdout).toContain('Node.js version mismatch');
		}
	});

	it('should fail when npm version mismatches', () => {
		// Create package.json with different npm version
		const currentNodeVersion = process.version.startsWith('v') ? process.version.slice(1) : process.version;
		const packageJson = {
			name: 'test-project',
			version: '1.0.0',
			engines: {
				node: currentNodeVersion,
				npm: '8.0.0' // Different from current
			},
			packageManager: 'npm@8.0.0'
		};

		fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
		fs.writeFileSync('.nvmrc', currentNodeVersion);

		// Initialize git repo
		execSync('git init', { stdio: 'pipe' });
		execSync('git config user.email "test@example.com"', { stdio: 'pipe' });
		execSync('git config user.name "Test User"', { stdio: 'pipe' });

		try {
			execSync(`node ${path.join(originalCwd, 'dist/cli.js')} doctor`, { 
				encoding: 'utf-8',
				stdio: 'pipe'
			});
			// Should not reach here
			expect.fail('Doctor should have failed due to npm version mismatch');
		} catch (error: any) {
			expect(error.status).toBe(1); // Exit code should be 1
			expect(error.stdout).toContain('❌ Doctor check FAILED');
			expect(error.stdout).toContain('npm version mismatch');
		}
	});

	it('should detect .nvmrc and package.json inconsistencies', () => {
		// Create mismatched .nvmrc and package.json
		const currentNpmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
		const packageJson = {
			name: 'test-project',
			version: '1.0.0',
			engines: {
				node: '20.0.0',
				npm: currentNpmVersion
			},
			packageManager: `npm@${currentNpmVersion}`
		};

		fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
		fs.writeFileSync('.nvmrc', '18.0.0'); // Different from package.json

		// Initialize git repo
		execSync('git init', { stdio: 'pipe' });
		execSync('git config user.email "test@example.com"', { stdio: 'pipe' });
		execSync('git config user.name "Test User"', { stdio: 'pipe' });

		try {
			execSync(`node ${path.join(originalCwd, 'dist/cli.js')} doctor`, { 
				encoding: 'utf-8',
				stdio: 'pipe'
			});
			// Should not reach here
			expect.fail('Doctor should have failed due to .nvmrc mismatch');
		} catch (error: any) {
			expect(error.status).toBe(1); // Exit code should be 1
			expect(error.stdout).toContain('❌ Doctor check FAILED');
			expect(error.stdout).toContain('.nvmrc mismatch');
		}
	});
});