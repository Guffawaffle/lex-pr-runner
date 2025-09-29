# Error Codes and Taxonomy

This document defines the structured error taxonomy for lex-pr-runner, establishing machine-readable error codes and their mapping to CLI exit codes.

## Error Code Structure

All structured errors use the format: `LEXPR_<category><number>`

- **LEXPR_1xx**: User errors (bad inputs, configuration mistakes)
- **LEXPR_2xx**: Environment/configuration errors (missing files, permissions)  
- **LEXPR_3xx**: Internal errors (system failures, unexpected conditions)

## CLI Exit Code Mapping

### Standard Exit Codes
- **0**: Success - operation completed without errors
- **1-9**: General failures - unexpected errors, system issues
- **10-19**: Configuration errors - environment, permissions, missing dependencies
- **20+**: User input errors - invalid plans, schema violations, cycles

### Detailed Mapping
| Exit Code | Category | Description |
|-----------|----------|-------------|
| 0 | Success | Operation completed successfully |
| 1 | System | Unexpected runtime errors, crashes |
| 2 | System | Network failures, I/O errors |
| 3 | System | Process timeouts, resource exhaustion |
| 10 | Environment | Missing configuration files |
| 11 | Environment | File permission errors |
| 12 | Environment | Git repository issues |
| 13 | Environment | Package manager problems |
| 14 | Environment | Missing required tools/binaries |
| 20 | User Input | Schema validation failures |
| 21 | User Input | Plan parsing errors |
| 22 | User Input | Dependency cycle detection |
| 23 | User Input | Unknown dependency references |
| 24 | User Input | Gate configuration errors |
| 25 | User Input | Policy validation failures |

## Error Code Definitions

### LEXPR_1xx - User Errors

#### Schema and Plan Validation
- **LEXPR_101**: `INVALID_SCHEMA_VERSION` - Unsupported or malformed schema version
- **LEXPR_102**: `PLAN_PARSE_ERROR` - JSON parsing failure in plan.json
- **LEXPR_103**: `SCHEMA_VALIDATION_FAILED` - Plan doesn't match schema requirements
- **LEXPR_104**: `MISSING_REQUIRED_FIELD` - Required field absent from plan
- **LEXPR_105**: `INVALID_FIELD_TYPE` - Field has wrong data type
- **LEXPR_106**: `INVALID_FIELD_VALUE` - Field value outside allowed range/options

#### Dependencies and Structure  
- **LEXPR_111**: `DEPENDENCY_CYCLE` - Circular dependency detected in plan
- **LEXPR_112**: `UNKNOWN_DEPENDENCY` - Item references non-existent dependency
- **LEXPR_113**: `EMPTY_PLAN` - Plan contains no items to process
- **LEXPR_114**: `DUPLICATE_ITEM_NAME` - Multiple items with same name
- **LEXPR_115**: `INVALID_ITEM_NAME` - Item name violates naming rules
- **LEXPR_116**: `ORPHANED_ITEM` - Item unreachable due to dependency structure

#### Gate Configuration
- **LEXPR_121**: `INVALID_GATE_COMMAND` - Gate run command is malformed
- **LEXPR_122**: `GATE_TIMEOUT_INVALID` - Timeout value out of valid range
- **LEXPR_123**: `UNKNOWN_GATE_TYPE` - Unsupported gate type specified
- **LEXPR_124**: `GATE_CONFIG_INVALID` - Gate configuration violates requirements
- **LEXPR_125**: `RETRY_CONFIG_INVALID` - Retry settings are misconfigured

#### Policy Validation
- **LEXPR_131**: `POLICY_VALIDATION_FAILED` - Policy configuration is invalid
- **LEXPR_132**: `REQUIRED_GATES_MISSING` - Item missing required gates from policy
- **LEXPR_133**: `WORKER_COUNT_INVALID` - maxWorkers setting out of range
- **LEXPR_134**: `MERGE_RULE_INVALID` - Merge rule configuration is malformed
- **LEXPR_135**: `ADMIN_OVERRIDE_INVALID` - Admin override settings are malformed

### LEXPR_2xx - Environment/Configuration Errors

#### File System
- **LEXPR_201**: `FILE_NOT_FOUND` - Required file missing from filesystem
- **LEXPR_202**: `FILE_PERMISSION_DENIED` - Insufficient permissions to read/write file
- **LEXPR_203**: `DIRECTORY_NOT_FOUND` - Required directory missing
- **LEXPR_204**: `DIRECTORY_NOT_WRITABLE` - Cannot write to output directory
- **LEXPR_205**: `DISK_SPACE_INSUFFICIENT` - Not enough disk space for operation
- **LEXPR_206**: `FILE_LOCKED` - File is locked by another process

#### Git Repository
- **LEXPR_211**: `GIT_REPO_NOT_FOUND` - Not in a git repository
- **LEXPR_212**: `GIT_BRANCH_NOT_FOUND` - Target branch doesn't exist
- **LEXPR_213**: `GIT_UNCOMMITTED_CHANGES` - Working directory has uncommitted changes
- **LEXPR_214**: `GIT_REMOTE_UNREACHABLE` - Cannot connect to git remote
- **LEXPR_215**: `GIT_MERGE_CONFLICT` - Merge conflict prevents operation
- **LEXPR_216**: `GIT_AUTHENTICATION_FAILED` - Git authentication failed

#### Environment Setup
- **LEXPR_221**: `NODE_VERSION_UNSUPPORTED` - Node.js version incompatible
- **LEXPR_222**: `NPM_INSTALL_FAILED` - Package installation failed
- **LEXPR_223**: `BINARY_NOT_FOUND` - Required binary missing from PATH
- **LEXPR_224**: `ENVIRONMENT_VARIABLE_MISSING` - Required env var not set
- **LEXPR_225**: `PROFILE_DIR_INVALID` - LEX_PROFILE_DIR is invalid/inaccessible
- **LEXPR_226**: `WORKSPACE_CORRUPTED` - Workspace in inconsistent state

#### Network and External Services
- **LEXPR_231**: `NETWORK_UNREACHABLE` - Network connectivity issues
- **LEXPR_232**: `API_RATE_LIMITED` - External API rate limit exceeded
- **LEXPR_233**: `SERVICE_UNAVAILABLE` - External service temporarily down
- **LEXPR_234**: `AUTHENTICATION_EXPIRED` - API tokens/credentials expired
- **LEXPR_235**: `SSL_CERTIFICATE_ERROR` - SSL/TLS certificate validation failed

### LEXPR_3xx - Internal Errors

#### Runtime Failures
- **LEXPR_301**: `UNEXPECTED_ERROR` - Unhandled exception or runtime error
- **LEXPR_302**: `ASSERTION_FAILED` - Internal assertion/invariant violated
- **LEXPR_303**: `MEMORY_EXHAUSTED` - Out of memory during operation
- **LEXPR_304**: `STACK_OVERFLOW` - Call stack exceeded limits
- **LEXPR_305**: `DEADLOCK_DETECTED` - Resource deadlock in concurrent operations
- **LEXPR_306**: `TIMEOUT_EXCEEDED` - Internal operation timeout

#### Data Corruption
- **LEXPR_311**: `STATE_CORRUPTED` - Execution state is inconsistent
- **LEXPR_312**: `CACHE_CORRUPTED` - Cache data is invalid/corrupted
- **LEXPR_313**: `ARTIFACT_CORRUPTED` - Generated artifact is malformed
- **LEXPR_314**: `SERIALIZATION_FAILED` - Cannot serialize/deserialize data
- **LEXPR_315**: `CHECKSUM_MISMATCH` - Data integrity check failed

#### Concurrency Issues
- **LEXPR_321**: `RACE_CONDITION` - Concurrent access caused inconsistency
- **LEXPR_322**: `RESOURCE_CONTENTION` - Resource conflict between operations
- **LEXPR_323**: `WORKER_CRASHED` - Background worker process crashed
- **LEXPR_324**: `QUEUE_OVERFLOW` - Task queue exceeded capacity
- **LEXPR_325**: `SEMAPHORE_ERROR` - Semaphore/lock operation failed

## Error Response Format

All structured errors follow this JSON schema:

```typescript
interface StructuredError {
  code: string;          // LEXPR_xxx format
  message: string;       // Human-readable description
  category: "user" | "environment" | "internal";
  severity: "error" | "warning" | "info";
  timestamp: string;     // ISO 8601 format
  context?: {            // Additional error context
    command?: string;    // CLI command that failed
    file?: string;       // File related to error
    line?: number;       // Line number if applicable
    field?: string;      // Schema field that failed validation
    value?: unknown;     // Invalid value that caused error
  };
  suggestions?: string[]; // Actionable remediation steps
  documentation?: string; // Link to relevant docs
}
```

## Error Examples

### User Error Example
```json
{
  "code": "LEXPR_111",
  "message": "Circular dependency detected: feat-a → feat-b → feat-a",
  "category": "user",
  "severity": "error", 
  "timestamp": "2024-01-15T10:30:00.000Z",
  "context": {
    "command": "plan",
    "file": "plan.json",
    "field": "items[].deps"
  },
  "suggestions": [
    "Remove circular dependency by updating deps in plan.json",
    "Use 'npm run cli -- merge-order plan.json' to visualize dependencies"
  ],
  "documentation": "https://docs.example.com/dependency-cycles"
}
```

### Environment Error Example  
```json
{
  "code": "LEXPR_201",
  "message": "Plan file not found: /path/to/plan.json",
  "category": "environment",
  "severity": "error",
  "timestamp": "2024-01-15T10:30:00.000Z", 
  "context": {
    "command": "execute",
    "file": "/path/to/plan.json"
  },
  "suggestions": [
    "Run 'npm run cli -- plan' to generate plan.json",
    "Check file path and permissions",
    "Ensure working directory is correct"
  ]
}
```

### Internal Error Example
```json
{
  "code": "LEXPR_301", 
  "message": "Unexpected error during gate execution",
  "category": "internal",
  "severity": "error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "context": {
    "command": "execute",
    "gate": "test-unit",
    "item": "feature-auth"
  },
  "suggestions": [
    "Try running the command again",
    "Check system resources and disk space",
    "Report this issue with the error details"
  ]
}
```

## CLI Integration

### JSON Mode Error Output
When `--json` flag is used, errors are output as JSON to stdout:
```bash
npm run cli -- plan --json
# On error:
{"error": {...StructuredError}, "success": false}
```

### Human-Readable Mode
Standard CLI error output to stderr with colored formatting:
```bash
npm run cli -- plan
# On error:
Error LEXPR_111: Circular dependency detected: feat-a → feat-b → feat-a

Suggestions:
  • Remove circular dependency by updating deps in plan.json
  • Use 'npm run cli -- merge-order plan.json' to visualize dependencies

See: https://docs.example.com/dependency-cycles
```

## MCP Server Integration

MCP tools wrap all errors in consistent `StructuredError` format and return as part of tool response rather than throwing exceptions:

```typescript
// MCP tool response format
interface ToolResponse {
  success: boolean;
  result?: any;        // Tool-specific result data
  error?: StructuredError;
}
```

## Implementation Guidelines

1. **Error Creation**: Use factory functions for consistent error creation
2. **Context Preservation**: Always include relevant context (file, line, field)
3. **Actionable Suggestions**: Provide specific remediation steps
4. **Documentation Links**: Reference relevant documentation when available
5. **Logging**: Log internal errors with full stack traces for debugging
6. **Graceful Degradation**: Attempt partial success when possible
7. **Error Aggregation**: Collect multiple validation errors instead of failing fast