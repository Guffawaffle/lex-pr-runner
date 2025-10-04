/**
 * Secrets Management Integration
 * 
 * Provides secure credential handling with:
 * - Environment variable validation
 * - Secret rotation support
 * - Credential lifecycle management
 * - Integration with secret management systems
 */

/**
 * Secret metadata
 */
export interface SecretMetadata {
	/** Secret identifier */
	id: string;
	/** When the secret was created */
	createdAt: Date;
	/** When the secret expires (if applicable) */
	expiresAt?: Date;
	/** When the secret was last rotated */
	lastRotated?: Date;
	/** Secret source (env, vault, etc.) */
	source: 'env' | 'vault' | 'file' | 'parameter-store';
}

/**
 * Secret value with metadata
 */
export interface Secret {
	value: string;
	metadata: SecretMetadata;
}

/**
 * Secret provider interface
 */
export interface SecretProvider {
	/** Get secret by identifier */
	getSecret(id: string): Promise<Secret | null>;
	/** List available secrets */
	listSecrets(): Promise<string[]>;
	/** Check if secret exists */
	hasSecret(id: string): Promise<boolean>;
}

/**
 * Environment variable secret provider
 */
export class EnvironmentSecretProvider implements SecretProvider {
	private prefix: string;

	constructor(prefix: string = 'LEX_PR_') {
		this.prefix = prefix;
	}

	async getSecret(id: string): Promise<Secret | null> {
		const envVar = `${this.prefix}${id}`;
		const value = process.env[envVar];

		if (!value) {
			return null;
		}

		return {
			value,
			metadata: {
				id,
				createdAt: new Date(), // Unknown for env vars
				source: 'env',
			},
		};
	}

	async listSecrets(): Promise<string[]> {
		const secrets: string[] = [];

		for (const key of Object.keys(process.env)) {
			if (key.startsWith(this.prefix)) {
				secrets.push(key.substring(this.prefix.length));
			}
		}

		return secrets;
	}

	async hasSecret(id: string): Promise<boolean> {
		const envVar = `${this.prefix}${id}`;
		return process.env[envVar] !== undefined;
	}
}

/**
 * Secrets Manager
 * Central service for secure credential handling
 */
export class SecretsManager {
	private provider: SecretProvider;
	private cache: Map<string, Secret> = new Map();
	private cacheExpiry: number = 300000; // 5 minutes

	constructor(provider?: SecretProvider) {
		this.provider = provider || new EnvironmentSecretProvider();
	}

	/**
	 * Get secret value (with caching)
	 */
	async getSecret(id: string): Promise<string | null> {
		// Check cache first
		const cached = this.cache.get(id);
		if (cached) {
			// Check if expired
			if (cached.metadata.expiresAt && cached.metadata.expiresAt < new Date()) {
				this.cache.delete(id);
			} else {
				return cached.value;
			}
		}

		// Fetch from provider
		const secret = await this.provider.getSecret(id);
		if (!secret) {
			return null;
		}

		// Cache the secret
		this.cache.set(id, secret);

		// Schedule cache cleanup
		setTimeout(() => {
			this.cache.delete(id);
		}, this.cacheExpiry);

		return secret.value;
	}

	/**
	 * Get secret or throw error if not found
	 */
	async requireSecret(id: string): Promise<string> {
		const secret = await this.getSecret(id);
		if (!secret) {
			throw new Error(`Required secret '${id}' not found`);
		}
		return secret;
	}

	/**
	 * Validate required secrets exist
	 */
	async validateSecrets(requiredIds: string[]): Promise<{ valid: boolean; missing: string[] }> {
		const missing: string[] = [];

		for (const id of requiredIds) {
			const hasSecret = await this.provider.hasSecret(id);
			if (!hasSecret) {
				missing.push(id);
			}
		}

		return {
			valid: missing.length === 0,
			missing,
		};
	}

	/**
	 * Get GitHub token from standard locations
	 */
	async getGitHubToken(): Promise<string | null> {
		// Try standard environment variables
		const envVars = ['GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_PAT'];

		for (const envVar of envVars) {
			const value = process.env[envVar];
			if (value) {
				return value;
			}
		}

		// Try from secrets manager
		return this.getSecret('GITHUB_TOKEN');
	}

	/**
	 * Redact secret from logs/output
	 */
	redactSecret(text: string, secretValue: string): string {
		if (!secretValue) {
			return text;
		}
		return text.replace(new RegExp(secretValue, 'g'), '***REDACTED***');
	}

	/**
	 * Clear secret cache
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Check if secrets need rotation (based on age)
	 */
	async checkRotationNeeded(id: string, maxAgeDays: number = 90): Promise<boolean> {
		const secret = await this.provider.getSecret(id);
		if (!secret) {
			return false;
		}

		if (!secret.metadata.lastRotated && !secret.metadata.createdAt) {
			return false;
		}

		const referenceDate = secret.metadata.lastRotated || secret.metadata.createdAt;
		const ageMs = Date.now() - referenceDate.getTime();
		const ageDays = ageMs / (1000 * 60 * 60 * 24);

		return ageDays > maxAgeDays;
	}
}

/**
 * Global secrets manager instance
 */
export const secretsManager = new SecretsManager();
