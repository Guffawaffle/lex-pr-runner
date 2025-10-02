/**
 * Autopilot Level 1 - Artifact Writers (JSON/MD deliverables)
 * Extends Level 0 with artifact generation to .smartergpt/deliverables/
 */

import { AutopilotLevel0, AutopilotResult } from "./base.js";
import {
	ArtifactWriter,
	AnalysisData,
	GatePrediction,
	ConflictPrediction
} from "./artifacts.js";

/**
 * Level 1 autopilot - Artifact generation
 * Generates structured JSON and Markdown deliverables
 */
export class AutopilotLevel1 extends AutopilotLevel0 {
	getLevel(): number {
		return 1;
	}

	async execute(): Promise<AutopilotResult> {
		try {
			const plan = this.context.plan;
			const mergeOrder = this.computeMergeOrder();
			const recommendations = this.generateRecommendations();

			// Create artifact writer with timestamp
			const writer = new ArtifactWriter(
				this.context.profilePath,
				this.context.profileRole
			);

			// Initialize output directory (validates write permissions)
			await writer.initialize();

			// Generate analysis data
			const analysisData: AnalysisData = {
				schemaVersion: "1.0.0",
				timestamp: new Date().toISOString(),
				plan: {
					nodes: plan.items,
					policy: plan.policy || {}
				},
				mergeOrder,
				conflicts: this.predictConflicts(),
				recommendations
			};

			// Generate gate predictions
			const gatePredictions = this.generateGatePredictions();

			// Write all artifacts
			const artifacts: string[] = [];
			artifacts.push(await writer.writeAnalysis(analysisData));
			artifacts.push(await writer.writeWeaveReport(plan, mergeOrder, recommendations));
			artifacts.push(await writer.writeGatePredictions(gatePredictions));
			artifacts.push(await writer.writeExecutionLog(plan, mergeOrder));
			artifacts.push(await writer.writeMetadata(this.getLevel()));

			const message = [
				"Level 1: Artifact generation complete",
				`Generated ${artifacts.length} artifacts in ${writer.getOutputDir()}`,
				"",
				"Artifacts created:",
				...artifacts.map(a => `  - ${a}`),
				"",
				"Next steps:",
				"  - Review weave-report.md for execution recommendations",
				"  - Check gate-predictions.json for expected gate outcomes",
				"  - Use execution-log.md as a manual execution template"
			].join("\n");

			return {
				level: 1,
				success: true,
				message,
				artifacts
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				level: 1,
				success: false,
				message: `Level 1 execution failed: ${errorMessage}`
			};
		}
	}

	/**
	 * Predict potential conflicts based on file overlap analysis
	 * This is a simplified heuristic - Level 2+ will use AST-based analysis
	 */
	private predictConflicts(): ConflictPrediction[] {
		const conflicts: ConflictPrediction[] = [];

		// For now, return empty array - actual conflict detection requires
		// file analysis which is beyond Level 1 scope
		// Future: integrate with diffgraph analyzer

		return conflicts;
	}

	/**
	 * Generate gate predictions based on plan structure
	 */
	private generateGatePredictions(): GatePrediction[] {
		const predictions: GatePrediction[] = [];
		const plan = this.context.plan;

		for (const item of plan.items) {
			for (const gate of item.gates) {
				// Predict pass for all gates by default
				// Actual execution will verify these predictions
				predictions.push({
					item: item.name,
					gate: gate.name,
					expectedStatus: "pass",
					reason: "Gate defined in plan - execution required for verification"
				});
			}

			// If no gates defined, add a note
			if (item.gates.length === 0) {
				predictions.push({
					item: item.name,
					gate: "none",
					expectedStatus: "skip",
					reason: "No gates defined for this item"
				});
			}
		}

		return predictions;
	}
}
