# lex-pr — PR Runner & Merge Pyramid

> **Tagline:** Fan‑out tasks as multiple PRs in parallel, then build a merge pyramid from the blocks. Compute dependency order, run gates locally, and merge cleanly.

## Quickstart

```bash
# Create & activate venv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install (editable) + dev tools
pip install -e ".[dev]"

# Install Node.js dependencies
npm install
```

## Commands

### CLI Commands

```bash
# Generate deterministic plan and snapshot
npm run cli -- plan
npm run cli -- plan --inputs .smartergpt --out .smartergpt/runner

# Environment sanity checks
npm run cli -- doctor
```

### Validation Commands (Python)

```bash
# Validate a plan (non-JSON and JSON modes)
lex-pr schema validate plan.json
lex-pr schema validate plan.json --json

# Show merge order (levels)
lex-pr merge-order plan.json --json

# Gate runner (stub in v1)
lex-pr gate
```

### Testing & Development

```bash
# Run all tests
npm test

# Run determinism tests specifically
npm run test:determinism

# Test determinism via CLI (integration test)
npm run test:determinism:cli

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Determinism

**Core Promise:** Deterministic artifacts only.

- `plan.json` and `snapshot.md` are byte-identical across runs with identical inputs
- Use `LEX_PR_DETERMINISTIC_TIME` environment variable to override timestamps for testing
- All outputs are sorted for stable diffs
- Environment-specific data is captured but doesn't affect determinism when inputs are the same

### Testing Determinism

```bash
# Quick test via npm script
npm run test:determinism:cli

# Manual test with custom inputs
LEX_PR_DETERMINISTIC_TIME="2024-01-01T12:00:00.000Z" npm run cli -- plan --inputs custom/inputs --out /tmp/test1
LEX_PR_DETERMINISTIC_TIME="2024-01-01T12:00:00.000Z" npm run cli -- plan --inputs custom/inputs --out /tmp/test2
diff /tmp/test1/plan.json /tmp/test2/plan.json  # Should show no differences
```

## Input Files

The planner reads configuration from `.smartergpt/` directory:

- **`stack.yml`** (highest priority): Complete PR stack definition
- **`scope.yml`**: Query scope and selectors
- **`deps.yml`**: Dependency relationships
- **`gates.yml`**: Gate definitions and requirements

## Output Files

- **`plan.json`**: Machine-readable merge plan
- **`snapshot.md`**: Human-readable snapshot with inputs and environment

## Notes
- Deterministic > clever. Outputs are sorted for stable diffs.
- `schemas/plan.schema.json` is the source of truth for validation.