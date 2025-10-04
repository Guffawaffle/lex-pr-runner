import { describe, it, expect, beforeEach } from 'vitest';
import { EnterpriseAuditService, ComplianceFormat, MergeAuditData } from '../src/security/compliance';
import { AuthContext } from '../src/security/authentication';

describe('Security - Compliance & Audit', () => {
	let auditService: EnterpriseAuditService;

	beforeEach(() => {
		auditService = new EnterpriseAuditService();
	});

	describe('Secure Audit Logging', () => {
		it('should create secure audit entry with hash', () => {
			const entry = auditService.logSecure(
				'test_operation',
				'approved',
				{ test: 'data' }
			);

			expect(entry).toHaveProperty('hash');
			expect(entry).toHaveProperty('timestamp');
			expect(entry.operation).toBe('test_operation');
			expect(entry.decision).toBe('approved');
		});

		it('should include auth context in entry', () => {
			const authContext: AuthContext = {
				user: 'test-user',
				method: 'token',
				roles: ['developer'],
			};

			const entry = auditService.logSecure(
				'test_operation',
				'approved',
				{},
				authContext
			);

			expect(entry.authContext).toBeDefined();
			expect(entry.authContext?.user).toBe('test-user');
			expect(entry.authContext?.roles).toContain('developer');
		});

		it('should sign entry when signing key provided', () => {
			const signedService = new EnterpriseAuditService('test-signing-key');
			const entry = signedService.logSecure(
				'test_operation',
				'approved',
				{}
			);

			expect(entry.signature).toBeDefined();
			expect(typeof entry.signature).toBe('string');
		});
	});

	describe('Merge Operation Audit', () => {
		it('should log merge operation with full details', () => {
			const mergeData: MergeAuditData = {
				prNumbers: [101, 102],
				targetBranch: 'main',
				mergeStrategy: 'squash',
				gateResults: { lint: 'passed', test: 'passed' },
				decision: 'approved',
			};

			const entry = auditService.logMergeOperation(mergeData);

			expect(entry.operation).toBe('merge_operation');
			expect(entry.decision).toBe('approved');
			expect(entry.metadata.prNumbers).toEqual([101, 102]);
			expect(entry.metadata.targetBranch).toBe('main');
		});

		it('should include rejection reason in audit', () => {
			const mergeData: MergeAuditData = {
				prNumbers: [103],
				targetBranch: 'main',
				mergeStrategy: 'merge',
				gateResults: { test: 'failed' },
				decision: 'rejected',
				reason: 'Test gate failed',
			};

			const entry = auditService.logMergeOperation(mergeData);

			expect(entry.decision).toBe('rejected');
			expect(entry.metadata.reason).toBe('Test gate failed');
		});
	});

	describe('Signature Verification', () => {
		it('should verify valid signature', () => {
			const signedService = new EnterpriseAuditService('test-key');
			const entry = signedService.logSecure(
				'test',
				'approved',
				{}
			);

			expect(signedService.verifyEntry(entry)).toBe(true);
		});

		it('should fail verification for tampered entry', () => {
			const signedService = new EnterpriseAuditService('test-key');
			const entry = signedService.logSecure(
				'test',
				'approved',
				{}
			);

			// Tamper with the entry
			entry.decision = 'rejected';

			expect(signedService.verifyEntry(entry)).toBe(false);
		});

		it('should fail verification without signing key', () => {
			const entry = auditService.logSecure(
				'test',
				'approved',
				{}
			);

			expect(auditService.verifyEntry(entry)).toBe(false);
		});
	});

	describe('Compliance Reports', () => {
		beforeEach(() => {
			// Create some audit entries
			auditService.logSecure('gate_execution', 'passed', { gate: 'lint' });
			auditService.logSecure('merge_operation', 'approved', { pr: 101 });
			auditService.logSecure('gate_execution', 'failed', { gate: 'test' });
		});

		it('should generate JSON format report', () => {
			const report = auditService.generateComplianceReport(ComplianceFormat.JSON);

			expect(report.format).toBe(ComplianceFormat.JSON);
			expect(report.totalEntries).toBeGreaterThan(0);
			expect(report.content).toBeDefined();
			expect(() => JSON.parse(report.content)).not.toThrow();
		});

		it('should generate JSONL format report', () => {
			const report = auditService.generateComplianceReport(ComplianceFormat.JSONL);

			expect(report.format).toBe(ComplianceFormat.JSONL);
			const lines = report.content.split('\n').filter(l => l.trim());
			expect(lines.length).toBeGreaterThan(0);
			lines.forEach(line => {
				expect(() => JSON.parse(line)).not.toThrow();
			});
		});

		it('should generate SOX format report', () => {
			const report = auditService.generateComplianceReport(ComplianceFormat.SOX);

			expect(report.format).toBe(ComplianceFormat.SOX);
			expect(report.content).toContain('SOX COMPLIANCE');
			expect(report.content).toContain('AUDIT TRAIL');
		});

		it('should generate SOC2 format report', () => {
			const report = auditService.generateComplianceReport(ComplianceFormat.SOC2);

			expect(report.format).toBe(ComplianceFormat.SOC2);
			expect(report.content).toContain('SOC2 COMPLIANCE');
			expect(report.content).toContain('ACCESS CONTROL');
			expect(report.content).toContain('CHANGE MANAGEMENT');
		});

		it('should generate CSV format report', () => {
			const report = auditService.generateComplianceReport(ComplianceFormat.CSV);

			expect(report.format).toBe(ComplianceFormat.CSV);
			expect(report.content).toContain('Timestamp,Operation,Decision');
			const lines = report.content.split('\n');
			expect(lines.length).toBeGreaterThan(1); // Header + data
		});

		it('should include time range in report', () => {
			const report = auditService.generateComplianceReport(ComplianceFormat.JSON);

			expect(report.timeRange).toBeDefined();
			expect(report.timeRange.start).toBeDefined();
			expect(report.timeRange.end).toBeDefined();
		});

		it('should sign report when signing key provided', () => {
			const signedService = new EnterpriseAuditService('test-key');
			signedService.logSecure('test', 'approved', {});
			
			const report = signedService.generateComplianceReport(ComplianceFormat.JSON);

			expect(report.signature).toBeDefined();
			expect(typeof report.signature).toBe('string');
		});
	});
});
