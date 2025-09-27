import { Plan, PlanItem } from "./plan.js";

function formatItemsTable(items: PlanItem[]): string {
	if (items.length === 0) {
		return "| id | branch | sha | needs | strategy |\n|---|---|---|---|---|\n| (no items) | | | | |";
	}
	
	let table = "| id | branch | sha | needs | strategy |\n|---|---|---|---|---|\n";
	
	for (const item of items) {
		const sha = item.sha || "(current)";
		const needs = item.needs.length > 0 ? item.needs.join(", ") : "(none)";
		const strategy = item.strategy || "rebase-weave";
		
		table += `| ${item.id} | ${item.branch} | ${sha} | ${needs} | ${strategy} |\n`;
	}
	
	return table;
}

function formatLevels(levels: number[][]): string {
	if (levels.length === 0) {
		return "No levels computed";
	}
	
	const levelStrings = levels.map((level, index) => 
		`Level ${index}: [${level.join(", ")}]`
	);
	
	return levelStrings.join("\n");
}

export function generateSnapshot(plan: Plan): string {
	return `# Runner Snapshot

## Inputs

- Target: \`${plan.target}\`
- Items count: ${plan.items.length}
- Content hash: \`${plan.contentHash || "(not computed)"}\`

## Levels

${formatLevels(plan.levels || [])}

## Items

${formatItemsTable(plan.items)}

## Notes

- Plan computed with deterministic topological sorting
- Levels indicate execution order (items in same level can run in parallel)
- Content hash ensures plan stability for unchanged inputs
`;
}