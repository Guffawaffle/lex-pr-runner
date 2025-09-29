import { z } from "zod";

/**
 * Gate result schema with stable keys and no timestamps for deterministic output
 * Based on issue requirement: stable keys, no timestamps
 */
export const GateReport = z.object({
	/** Item identifier this gate was run for */
	item: z.string(),
	/** Gate name identifier */
	gate: z.string(),
	/** Gate execution status - only pass or fail for stable output */
	status: z.enum(["pass", "fail"]),
	/** Duration in milliseconds */
	duration_ms: z.number().min(0),
	/** ISO-8601 timestamp when gate started */
	started_at: z.string(),
	/** Optional path to stderr output file */
	stderr_path: z.string().optional(),
	/** Optional path to stdout output file */
	stdout_path: z.string().optional(),
	/** Optional metadata as string key-value pairs */
	meta: z.record(z.string()).optional()
}).strict();

export type GateReport = z.infer<typeof GateReport>;

/**
 * Validate a gate report object
 */
export function validateGateReport(data: unknown): GateReport {
	return GateReport.parse(data);
}

/**
 * Safe validation that returns success/error result
 */
export function safeValidateGateReport(data: unknown): { success: true; data: GateReport } | { success: false; error: z.ZodError } {
	const result = GateReport.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error };
}
