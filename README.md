# lex-pr — PR Runner & Merge Pyramid

> **Tagline:** Fan‑out tasks as multiple PRs in parallel, then build a merge pyramid from the blocks. Compute dependency order, run gates locally, and merge cleanly.

## Quickstart

### Python CLI
```bash
# Create & activate venv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install (editable) + dev tools
pip install -e ".[dev]"
```

### TypeScript CLI
```bash
# Install dependencies
npm install

# Run CLI commands
npm run cli -- <command>
```

## Commands

### Python CLI
```bash
# Validate a plan (non-JSON and JSON modes)
lex-pr schema validate plan.json
lex-pr schema validate plan.json --json

# Show merge order (levels)
lex-pr merge-order plan.json --json

# Gate runner (stub in v1)
lex-pr gate
```

### TypeScript CLI
```bash
# Create a plan
npm run cli -- plan

# Show dependency levels for a plan
npm run cli -- levels plan.json
npm run cli -- levels plan.json --json

# Environment checks
npm run cli -- doctor
```

## Dependency DAG and Levelization

The project includes robust dependency DAG building with:

- **Cycle Detection**: Detects and reports dependency cycles with clear error messages
- **Missing Node Validation**: Catches references to non-existent dependencies  
- **Kahn's Algorithm**: Uses Kahn's algorithm with deterministic tie-breaking (alphabetical sorting)
- **Level Grouping**: Groups items into levels by distance from dependency roots
- **Deterministic Output**: Consistent results across multiple runs

### Example

Given items with dependencies A→B→C and A→D:

```json
{
  "target": "main",
  "items": [
    {"id": 1, "branch": "feat/a", "needs": []},
    {"id": 2, "branch": "feat/b", "needs": [1]}, 
    {"id": 3, "branch": "feat/c", "needs": [2]},
    {"id": 4, "branch": "feat/d", "needs": [1]}
  ]
}
```

Results in deterministic levels:
- Level 0: feat/a
- Level 1: feat/b, feat/d  
- Level 2: feat/c

## Notes
- Deterministic > clever. Outputs are sorted for stable diffs.
- `schemas/plan.schema.json` is the source of truth for validation.
- TypeScript implementation uses numeric IDs with `needs[]` arrays
- Python implementation supports string names with `deps[]` arrays