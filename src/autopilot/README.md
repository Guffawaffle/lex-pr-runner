# Autopilot Module

This module provides the automation level system for lex-pr-runner's merge-weave execution.

## Overview

The autopilot system defines five levels of automation (0-4), allowing teams to incrementally adopt automation while maintaining safety and control.

## Files

- `types.ts` - Core types, enums, schemas, and validation logic
- `index.ts` - Module exports

## Usage

```typescript
import { 
  AutopilotLevel, 
  parseAutopilotConfig, 
  hasCapability 
} from './autopilot/index.js';

// Parse CLI options into config
const config = parseAutopilotConfig({
  maxLevel: 3,
  openPr: true,
  branchPrefix: 'integration/'
});

// Check capabilities
if (hasCapability(config, 'branches')) {
  // Create integration branches
}
```

## Key Concepts

### Autopilot Levels

- **Level 0**: Report only - safe for CI, no side effects
- **Level 1**: Artifact generation - creates detailed execution plans
- **Level 2**: PR annotations - posts status updates to PRs
- **Level 3**: Integration branches - creates branches and PRs
- **Level 4**: Full automation - end-to-end merge-weave

### Validation

The module enforces strict validation rules:

- Level must be 0-4 (integer)
- `--open-pr` requires level 3+
- `--close-superseded` requires level 4
- `--comment-template` requires level 2+

### Configuration

Configuration is parsed from CLI flags and validated for:
1. Schema compliance (via Zod)
2. Logical consistency (flag dependencies)
3. Safety boundaries

## Testing

See `tests/autopilot.spec.ts` for comprehensive test coverage:
- Level validation
- Config parsing
- Flag combinations
- Edge cases

Run tests:
```bash
npm test -- tests/autopilot.spec.ts
```

## Documentation

User-facing documentation is in `docs/autopilot-levels.md`.

## Future Work

Planned enhancements:
- Capability-based execution (Level 0 implementation)
- Progress tracking and rollback
- Adaptive level selection based on success rate
- Integration with GitHub Actions workflows
