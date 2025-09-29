# Schema Documentation

This document outlines the schema architecture for lex-pr-runner, establishing the single source of truth and generation workflow.

## Schema Architecture

### Single Source of Truth: Zod Schemas

**The TypeScript Zod schemas in `src/schema.ts` are the authoritative schema definitions.**

All JSON schema files in `schemas/*.json` are **generated artifacts** derived from the Zod schemas. These generated files should never be manually edited.

### Schema Generation Workflow

Schema generation follows this pattern:

1. **Define**: Zod schemas in `src/schema.ts` (source of truth)
2. **Generate**: JSON schemas via `scripts/generate-*-schema.ts` scripts
3. **Validate**: Generated schemas against test cases
4. **Commit**: Both source and generated schemas together

#### Current Generation Scripts

- `scripts/generate-gate-schema.ts` - Generates `schemas/gate-report.schema.json`

#### Missing Generation Scripts

The following scripts need to be created to maintain schema consistency:

- `scripts/generate-plan-schema.ts` - Should generate `schemas/plan.schema.json` from Zod Plan schema
- CI integration to verify schemas are up-to-date

## Core Schemas

### Plan Schema (`src/schema.ts`)

The Plan schema defines the structure for `plan.json` files:

```typescript
// Core plan structure
export const Plan = z.object({
  schemaVersion: SchemaVersion,     // "1.x.y" format
  target: z.string().default("main"),
  policy: Policy.optional(),
  items: z.array(PlanItem).default([])
}).strict();

// Plan items with dependency resolution
export const PlanItem = z.object({
  name: z.string(),                 // Unique identifier for dependency resolution
  deps: z.string().array().default([]), // References to other item names
  gates: z.array(Gate).default([])
}).strict();
```

**Key Design Decisions:**

- `name` field is required and used for dependency resolution
- `deps` array contains references to other item names (not IDs)
- Schema is strict - no additional properties allowed
- **Note**: Current `schemas/plan.schema.json` incorrectly requires `repo`/`branch` fields that don't exist in the Zod schema

### Gate Schema

```typescript
export const Gate = z.object({
  name: z.string(),
  run: z.string(),
  cwd: z.string().optional(),
  env: z.record(z.string()).default({}),
  runtime: z.enum(["local", "container", "ci-service"]).default("local"),
  container: ContainerSpec.optional(),
  artifacts: z.array(z.string()).default([])
}).strict();
```

### Gate Report Schema

```typescript
// Defined in src/schema/gateReport.ts
export const GateReport = z.object({
  item: z.string(),
  gate: z.string(), 
  status: z.enum(["pass", "fail"]),
  duration_ms: z.number(),
  started_at: z.string(), // ISO timestamp
  stderr_path: z.string().optional(),
  stdout_path: z.string().optional(),
  meta: z.record(z.string()).optional()
});
```

## Schema Versioning

Schemas follow semantic versioning principles:

- **Major (1.x.y → 2.x.y)**: Breaking changes to structure or semantics
- **Minor (1.1.y → 1.2.y)**: Additive required fields with safe defaults  
- **Patch (1.1.1 → 1.1.2)**: Additive optional fields or documentation only

Current supported version: **1.x.y** (major version 1 only)

## Validation and Error Handling

### Zod Validation

```typescript
// Validate plan data
const result = Plan.safeParse(planData);
if (!result.success) {
  throw new SchemaValidationError(result.error.issues);
}
```

### Schema Validation Error Format

```typescript
export interface ValidationError {
  path: string;      // Dot-notation path to invalid field
  message: string;   // Human-readable error message  
  code: string;      // Zod error code
}

export class SchemaValidationError extends Error {
  public readonly issues: z.ZodIssue[];
  public readonly errors: ValidationError[];
  
  toJSON(): { valid: false; errors: ValidationError[] }
}
```

## Deterministic Behavior

All schema operations must produce deterministic outputs:

- **Canonical JSON**: Use `canonicalJSONStringify()` for stable key ordering
- **Stable timestamps**: Avoid runtime timestamps in generated schemas
- **Sorted arrays**: Dependencies and items sorted alphabetically where possible

## CLI Integration

Schema validation is exposed via CLI commands:

```bash
# Validate plan against schema
npm run cli -- schema validate plan.json

# JSON output for CI integration
npm run cli -- schema validate plan.json --json
```

Expected JSON output format:
```json
// Success
{ "valid": true }

// Failure  
{
  "valid": false,
  "errors": [
    {
      "path": "items.0.name",
      "message": "Required",
      "code": "invalid_type"
    }
  ]
}
```

## MCP Integration

The MCP server exposes schema validation through tools but does not define separate schemas. All MCP tools use the same Zod schemas defined in `src/schema.ts`.

## Future Work

1. **Schema Generation CI**: Add workflow to verify generated schemas match source
2. **Additional Generators**: Create missing generation scripts for plan schema
3. **Schema Registry**: Consider external schema registry for cross-tool compatibility
4. **Validation Performance**: Optimize schema validation for large plans