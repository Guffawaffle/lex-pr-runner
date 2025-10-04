import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecretsManager, EnvironmentSecretProvider } from '../src/security/secrets';

describe('Security - Secrets Management', () => {
	let secretsManager: SecretsManager;
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		secretsManager = new SecretsManager();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('Environment Secret Provider', () => {
		it('should get secret from environment', async () => {
			process.env.LEX_PR_TEST_SECRET = 'secret-value';
			
			const provider = new EnvironmentSecretProvider();
			const secret = await provider.getSecret('TEST_SECRET');

			expect(secret).toBeDefined();
			expect(secret?.value).toBe('secret-value');
			expect(secret?.metadata.source).toBe('env');
		});

		it('should return null for missing secret', async () => {
			const provider = new EnvironmentSecretProvider();
			const secret = await provider.getSecret('NONEXISTENT');

			expect(secret).toBeNull();
		});

		it('should list available secrets', async () => {
			process.env.LEX_PR_SECRET1 = 'value1';
			process.env.LEX_PR_SECRET2 = 'value2';
			process.env.OTHER_VAR = 'other';

			const provider = new EnvironmentSecretProvider();
			const secrets = await provider.listSecrets();

			expect(secrets).toContain('SECRET1');
			expect(secrets).toContain('SECRET2');
			expect(secrets).not.toContain('OTHER_VAR');
		});

		it('should check if secret exists', async () => {
			process.env.LEX_PR_EXISTS = 'value';

			const provider = new EnvironmentSecretProvider();
			
			expect(await provider.hasSecret('EXISTS')).toBe(true);
			expect(await provider.hasSecret('NOT_EXISTS')).toBe(false);
		});
	});

	describe('Secrets Manager', () => {
		it('should get secret value', async () => {
			process.env.LEX_PR_API_KEY = 'api-key-value';

			const value = await secretsManager.getSecret('API_KEY');
			expect(value).toBe('api-key-value');
		});

		it('should return null for missing secret', async () => {
			const value = await secretsManager.getSecret('MISSING');
			expect(value).toBeNull();
		});

		it('should require secret and throw if missing', async () => {
			await expect(
				secretsManager.requireSecret('REQUIRED_SECRET')
			).rejects.toThrow(/Required secret.*not found/);
		});

		it('should require secret successfully when exists', async () => {
			process.env.LEX_PR_REQUIRED = 'required-value';

			const value = await secretsManager.requireSecret('REQUIRED');
			expect(value).toBe('required-value');
		});

		it('should validate required secrets', async () => {
			process.env.LEX_PR_SECRET1 = 'value1';
			process.env.LEX_PR_SECRET2 = 'value2';

			const result = await secretsManager.validateSecrets([
				'SECRET1',
				'SECRET2',
				'MISSING'
			]);

			expect(result.valid).toBe(false);
			expect(result.missing).toEqual(['MISSING']);
		});

		it('should validate all secrets present', async () => {
			process.env.LEX_PR_SECRET1 = 'value1';
			process.env.LEX_PR_SECRET2 = 'value2';

			const result = await secretsManager.validateSecrets([
				'SECRET1',
				'SECRET2'
			]);

			expect(result.valid).toBe(true);
			expect(result.missing).toEqual([]);
		});
	});

	describe('GitHub Token Handling', () => {
		it('should get GitHub token from GITHUB_TOKEN', async () => {
			process.env.GITHUB_TOKEN = 'github-token';

			const token = await secretsManager.getGitHubToken();
			expect(token).toBe('github-token');
		});

		it('should get GitHub token from GH_TOKEN', async () => {
			delete process.env.GITHUB_TOKEN;
			process.env.GH_TOKEN = 'gh-token';

			const token = await secretsManager.getGitHubToken();
			expect(token).toBe('gh-token');
		});

		it('should get GitHub token from GITHUB_PAT', async () => {
			delete process.env.GITHUB_TOKEN;
			delete process.env.GH_TOKEN;
			process.env.GITHUB_PAT = 'pat-token';

			const token = await secretsManager.getGitHubToken();
			expect(token).toBe('pat-token');
		});

		it('should prefer GITHUB_TOKEN over others', async () => {
			process.env.GITHUB_TOKEN = 'github-token';
			process.env.GH_TOKEN = 'gh-token';
			process.env.GITHUB_PAT = 'pat-token';

			const token = await secretsManager.getGitHubToken();
			expect(token).toBe('github-token');
		});
	});

	describe('Secret Redaction', () => {
		it('should redact secret from text', () => {
			const text = 'The API key is secret-123 and should be hidden';
			const redacted = secretsManager.redactSecret(text, 'secret-123');

			expect(redacted).toBe('The API key is ***REDACTED*** and should be hidden');
			expect(redacted).not.toContain('secret-123');
		});

		it('should handle multiple occurrences', () => {
			const text = 'secret-123 appears twice: secret-123';
			const redacted = secretsManager.redactSecret(text, 'secret-123');

			expect(redacted).toBe('***REDACTED*** appears twice: ***REDACTED***');
		});

		it('should handle empty secret value', () => {
			const text = 'No secret here';
			const redacted = secretsManager.redactSecret(text, '');

			expect(redacted).toBe('No secret here');
		});
	});

	describe('Cache Management', () => {
		it('should cache secrets', async () => {
			process.env.LEX_PR_CACHED = 'cached-value';

			const value1 = await secretsManager.getSecret('CACHED');
			const value2 = await secretsManager.getSecret('CACHED');

			expect(value1).toBe(value2);
			expect(value1).toBe('cached-value');
		});

		it('should clear cache', async () => {
			process.env.LEX_PR_CACHED = 'value';

			await secretsManager.getSecret('CACHED');
			secretsManager.clearCache();

			// After clearing, should fetch again
			const value = await secretsManager.getSecret('CACHED');
			expect(value).toBe('value');
		});
	});
});
