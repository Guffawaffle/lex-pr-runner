# CLI/MCP Design Specification

This document defines the "good" target state for CLI outputs and MCP tool I/O, establishing stable contracts for structured outputs, error handling, and JSON schema validation.

## CLI Design Principles

### Universal JSON Support
All CLI commands **MUST** support `--json` flag for machine-readable output:
- JSON output goes to stdout only
- Human-readable messages/progress go to stderr  
- Exit codes remain consistent regardless of output format
- JSON structures use deterministic key ordering via `canonicalJSONStringify()`

### Stable Output Structures
All JSON outputs **MUST** follow these rules:
- Object keys sorted alphabetically at all levels
- Arrays preserve authored/semantic order (no arbitrary sorting)
- Timestamps in ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- All JSON ends with single newline for consistent file artifacts

### CLI Command Specifications

#### Plan Generation: `plan [options]`
**JSON Output Structure:**
```typescript
interface PlanOutput {
  schemaVersion: string;  // "1.x.y" format
  target: string;         // branch name
  items: PlanItem[];      // sorted by name
  policy?: Policy;        // optional policy config
}
```

**Flags:**
- `--json`: Output plan to stdout, write nothing else
- `--out <dir>`: Directory for artifacts (plan.json, snapshot.md)
- `--dry-run`: Show generation plan without writing files

#### Schema Operations: `schema <subcommand>`
**Validation Output (`schema validate`):**
```typescript
interface ValidationOutput {
  valid: boolean;
  schemaVersion?: string;     // if valid
  errors?: ValidationError[]; // if invalid, sorted by path
}

interface ValidationError {
  path: string;      // dot notation: "items.0.name"
  message: string;   // human readable
  code: string;      // machine readable: "required", "invalid_type", etc.
  value?: unknown;   // offending value if relevant
}
```

#### Merge Order: `merge-order [file]`
**JSON Output:**
```typescript
interface MergeOrderOutput {
  levels: string[][];  // array of parallel execution levels
  totalItems: number;  // convenience count
}
```

#### Execution: `execute [file]`
**JSON Output:**
```typescript
interface ExecutionOutput {
  planSummary: {
    schemaVersion: string;
    target: string;
    totalItems: number;
  };
  executionState: {
    completedItems: string[];     // sorted by name
    failedItems: string[];        // sorted by name  
    blockedItems: string[];       // sorted by name
    eligibleForMerge: string[];   // sorted by name
  };
  gateResults: GateResult[];      // sorted by item name, then gate name
  allGreen: boolean;
  duration: number;               // total execution time in ms
}
```

#### Status: `status [file]`
**JSON Output:**
```typescript
interface StatusOutput {
  plan: {
    schemaVersion: string;
    target: string;
    totalItems: number;
  };
  mergeEligibility: {
    eligible: boolean;
    reason?: string;              // if not eligible
    readyItems: string[];         // sorted by name
    blockedItems: string[];       // sorted by name
  };
  lastExecution?: {
    timestamp: string;            // ISO 8601
    allGreen: boolean;
    duration: number;
  };
}
```

#### Report Aggregation: `report <dir>`
**JSON Output:**
```typescript
interface ReportOutput {
  summary: {
    allGreen: boolean;
    totalGates: number;
    passCount: number;
    failCount: number;
    duration: number;             // total duration in ms
  };
  itemResults: ItemResult[];      // sorted by item name
}

interface ItemResult {
  item: string;
  status: "pass" | "fail" | "partial";
  gates: GateResult[];            // sorted by gate name
}

interface GateResult {
  gate: string;
  status: "pass" | "fail";
  duration: number;               // ms
  exitCode?: number;
  startedAt: string;              // ISO 8601
  artifacts?: string[];           // paths, sorted
}
```

## MCP Server Design

### Tool Contracts
All MCP tools **MUST** return structured results with consistent error handling:

#### `plan.create`
**Input Schema (Zod):**
```typescript
const PlanCreateArgs = z.object({
  json: z.boolean().default(false),
  outDir: z.string().optional(),
  target: z.string().optional()
});
```

**Output Schema:**
```typescript
interface PlanCreateResult {
  success: boolean;
  plan?: Plan;                    // if successful
  outDir?: string;               // if files written
  error?: StructuredError;       // if failed
}
```

#### `gates.run`  
**Input Schema:**
```typescript
const GatesRunArgs = z.object({
  planPath: z.string().optional(),
  onlyItem: z.string().optional(),
  onlyGate: z.string().optional(),
  outDir: z.string().optional(),
  timeout: z.number().int().min(1000).default(30000)
});
```

**Output Schema:**
```typescript
interface GatesRunResult {
  success: boolean;
  execution?: {
    items: ItemExecutionResult[];  // sorted by name
    allGreen: boolean;
    duration: number;
    outDir?: string;
  };
  error?: StructuredError;
}
```

#### `merge.apply`
**Input Schema:**
```typescript
const MergeApplyArgs = z.object({
  planPath: z.string().optional(),
  dryRun: z.boolean().default(true),
  force: z.boolean().default(false)
});
```

**Output Schema:**
```typescript
interface MergeApplyResult {
  success: boolean;
  merge?: {
    allowed: boolean;
    dryRun: boolean;
    itemsProcessed: string[];      // sorted by merge order
    message: string;
  };
  error?: StructuredError;
}
```

### MCP Error Handling
All MCP tools use consistent error structure:
```typescript
interface StructuredError {
  code: string;          // LEXPR_xxx format
  message: string;       // human readable
  details?: object;      // additional context
  timestamp: string;     // ISO 8601
}
```

## Zod Schema Types (Names Only)

The following Zod types will be introduced for JSON Schema generation:

### CLI Output Schemas
- `PlanOutput` - Plan command JSON output
- `ValidationOutput` - Schema validation results  
- `ValidationError` - Individual validation errors
- `MergeOrderOutput` - Merge order computation results
- `ExecutionOutput` - Gate execution results
- `StatusOutput` - Plan status and merge eligibility
- `ReportOutput` - Gate report aggregation
- `ItemResult` - Per-item execution results
- `GateResult` - Individual gate execution results

### MCP Tool Schemas  
- `PlanCreateArgs` / `PlanCreateResult` - Plan creation tool
- `GatesRunArgs` / `GatesRunResult` - Gate execution tool
- `MergeApplyArgs` / `MergeApplyResult` - Merge application tool
- `ItemExecutionResult` - Item-level execution state
- `StructuredError` - Consistent error responses

### Core Domain Schemas (Existing, Enhanced)
- `Plan` - Enhanced with optional metadata
- `PlanItem` - Enhanced with execution tracking
- `Policy` - Enhanced with retry/override configs
- `Gate` - Enhanced with timeout/retry options
- `ExecutionState` - Enhanced with timestamps
- `MergeEligibility` - New schema for merge readiness

## JSON Schema Generation Target

These schemas will be generated into `schema/` directory:
- `cli-output.json` - All CLI output formats
- `mcp-tools.json` - MCP tool input/output contracts  
- `domain-model.json` - Core plan/gate/execution schemas
- `error-taxonomy.json` - Structured error format definitions

## Ordering Guarantees

### Arrays That Must Be Sorted
- `items[]` in plans - sorted by `name`
- `errors[]` in validation - sorted by `path`
- `completedItems[]`, `failedItems[]`, `blockedItems[]` - sorted by `name`
- `gateResults[]` - sorted by `item` then `gate`
- `itemResults[]` - sorted by `item`

### Arrays That Preserve Semantic Order
- `levels[][]` in merge order - preserves dependency topology
- `gates[]` within items - preserves authored order in plan
- `artifacts[]` - preserves filesystem order

### Objects Always Sorted
All object keys sorted alphabetically via `canonicalJSONStringify()` at all nesting levels.

## Backwards Compatibility

- All existing CLI commands retain current behavior by default
- `--json` flag is additive - doesn't change existing outputs  
- Exit codes remain unchanged (0, 1, 2)
- MCP tools maintain existing signatures but enhance result structures
- Schema version remains 1.x.y with additive changes only

## Implementation Notes

This is a **design specification only** - no implementation is included. The actual implementation will:

1. Add missing `--json` flags to all commands
2. Implement Zod schemas for all output types
3. Generate JSON Schema files from Zod definitions  
4. Add structured error handling throughout
5. Ensure deterministic ordering in all outputs
6. Add comprehensive validation for MCP tool inputs