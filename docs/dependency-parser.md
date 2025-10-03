# Dependency Parser

The dependency parser extracts structured information from PR descriptions to enable automatic dependency resolution and plan generation.

## Features

### Dependency Extraction

The parser supports multiple dependency formats:

- **Depends-on**: `Depends-on: #123, #456`
- **Depends**: `Depends: PR-123, PR-456`
- **Requires**: `Requires: #123`
- **GitHub Keywords**: `Closes: #100`, `Fixes: #200`, `Resolves: #300`
- **Cross-repo**: `owner/repo#123`, `repo#456`

### Gate Overrides

Extract gate configuration from PR body:

```markdown
Skip: e2e-tests, slow-tests
Required: security-scan, performance-test
```

Alternative syntax:
```markdown
Skip-gates: test1, test2
Required-gates: gate1, gate2
```

### Metadata Extraction

#### From PR Body
- **Priority**: `Priority: high`
- **Labels**: `Labels: feature, breaking, api-change`

#### From YAML Front-Matter
```yaml
---
priority: high
epic: B1-diffgraph-planner
story_points: 8
assignee: developer1
---
```

## Usage

### Basic Parsing

```typescript
import { parsePRDescription } from "./planner/index.js";

const result = parsePRDescription(101, prBodyText);

console.log(result);
// {
//   prId: "PR-101",
//   dependencies: ["#123", "#456"],
//   gates: { skip: ["e2e-tests"], required: ["security-scan"] },
//   metadata: { priority: "high", labels: ["feature", "breaking"] }
// }
```

### With Options

```typescript
const result = parsePRDescription(101, prBodyText, {
  repository: "owner/repo",
  partialExtraction: true  // Continue on errors
});
```

### Validation

```typescript
import { validateDependencies } from "./planner/index.js";

const prs = [
  { prId: "PR-1", dependencies: ["#2"] },
  { prId: "PR-2", dependencies: ["#3"] },
  { prId: "PR-3", dependencies: [] }
];

validateDependencies(prs); // Throws on circular dependencies
```

### Normalization

```typescript
import { normalizeDependencyRef } from "./planner/index.js";

// Normalize to full format
normalizeDependencyRef("#123", "owner/repo");  // "owner/repo#123"
normalizeDependencyRef("PR-456", "owner/repo"); // "owner/repo#456"
```

## Output Format

The parser produces a structured output ready for plan generation:

```json
{
  "prId": "PR-101",
  "dependencies": ["#123", "#456"],
  "gates": {
    "skip": ["e2e-tests"],
    "required": ["security-scan"]
  },
  "metadata": {
    "priority": "high",
    "labels": ["feature", "breaking"]
  }
}
```

### Output Guarantees

- All arrays are **sorted deterministically**
- Dependencies are **deduplicated**
- Empty fields are **omitted** from output
- Consistent **stable ordering** across runs

## Examples

### Stack-based Workflow PR

```markdown
**Stack Position**: 3/5

Depends-on: #101, #102

**Changes**:
- Feature implementation
- Tests added

Required: lint, typecheck, test
Skip: deploy
```

Output:
```json
{
  "prId": "PR-103",
  "dependencies": ["#101", "#102"],
  "gates": {
    "skip": ["deploy"],
    "required": ["lint", "test", "typecheck"]
  }
}
```

### Comprehensive Template

```markdown
---
priority: high
epic: B1-diffgraph-planner
story_points: 5
---

## Dependencies
Depends-on: #75
Requires: #80

## Gates Override
Skip: e2e-tests
Required: security-scan, performance-test

## Description
Implementation details...

Labels: feature, breaking-change
```

Output:
```json
{
  "prId": "PR-101",
  "dependencies": ["#75", "#80"],
  "gates": {
    "skip": ["e2e-tests"],
    "required": ["performance-test", "security-scan"]
  },
  "metadata": {
    "priority": "high",
    "epic": "B1-diffgraph-planner",
    "story_points": 5,
    "labels": ["breaking-change", "feature"]
  }
}
```

## Integration with GitHub Client

The parser is integrated with the GitHub client for automatic dependency extraction:

```typescript
import { createGitHubClient } from "./github/client.js";

const client = await createGitHubClient({ token: process.env.GITHUB_TOKEN });
const prDetails = await client.getPRDetails(123);

console.log(prDetails.dependencies);  // Parsed from PR body
console.log(prDetails.metadata);      // Extracted metadata
console.log(prDetails.gateOverrides); // Gate configuration
```

## Error Handling

### Partial Extraction Mode

When `partialExtraction: true`, the parser returns successfully parsed data even if some parts fail:

```typescript
const result = parsePRDescription(101, prBody, { partialExtraction: true });
// Returns valid data, skips invalid parts
```

### Circular Dependency Detection

```typescript
try {
  validateDependencies(prs);
} catch (error) {
  console.error(error.message); // "Circular dependency detected involving PR-1"
}
```

## Testing

The parser has comprehensive test coverage:

- 34 core parser tests
- 13 GitHub integration tests
- Edge cases and error handling
- Real-world PR templates

Run tests:
```bash
npm test -- dependencyParser
```
