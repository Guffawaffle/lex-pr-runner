/**
 * Autopilot base classes - Level 0 (report-only) and extensible interface
 */

import { Plan } from "../schema.js";
import { computeMergeOrder } from "../mergeOrder.js";

export interface AutopilotContext {
	plan: Plan;
	profilePath: string;
	profileRole: string;
}

export interface AutopilotResult {
	level: number;
	success: boolean;
	message: string;
	artifacts?: string[];
}

/**
 * Base autopilot class - Level 0 provides report-only functionality
 */
export abstract class AutopilotBase {
	protected context: AutopilotContext;

	constructor(context: AutopilotContext) {
		this.context = context;
	}

	abstract getLevel(): number;
	abstract execute(): Promise<AutopilotResult>;

	/**
	 * Compute merge order for the plan
	 */
	protected computeMergeOrder(): string[][] {
		return computeMergeOrder(this.context.plan);
	}

	/**
	 * Generate recommendations based on plan analysis
	 */
	protected generateRecommendations(): string[] {
		const recommendations: string[] = [];
		const plan = this.context.plan;
		const levels = this.computeMergeOrder();

		if (levels.length > 1) {
			recommendations.push(`Plan has ${levels.length} levels - consider parallel execution for efficiency`);
		}

		const totalGates = plan.items.reduce((sum, item) => sum + item.gates.length, 0);
		if (totalGates > 0) {
			recommendations.push(`${totalGates} gates defined - ensure all gates pass before merging`);
		}

		const itemsWithDeps = plan.items.filter(item => item.deps.length > 0);
		if (itemsWithDeps.length > 0) {
			recommendations.push(`${itemsWithDeps.length} items have dependencies - follow merge order strictly`);
		}

		return recommendations;
	}
}

/**
 * Level 0 autopilot - Report-only mode
 * Analyzes plan and provides recommendations without generating artifacts
 */
export class AutopilotLevel0 extends AutopilotBase {
	getLevel(): number {
		return 0;
	}

	async execute(): Promise<AutopilotResult> {
		const levels = this.computeMergeOrder();
		const recommendations = this.generateRecommendations();

		const message = [
			"Level 0: Report-only analysis complete",
			`Plan has ${this.context.plan.items.length} items in ${levels.length} levels`,
			"",
			"Recommendations:",
			...recommendations.map(r => `  - ${r}`)
		].join("\n");

		return {
			level: 0,
			success: true,
			message
		};
	}
}
