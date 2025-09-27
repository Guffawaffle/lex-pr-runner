# lex-pr — PR Runner & Merge Pyramid

> **Tagline:** Fan‑out tasks as multiple PRs in parallel, then build a merge pyramid from the blocks. Compute dependency order, run gates locally, and merge cleanly.

## Quickstart

```bash
# Create & activate venv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install (editable) + dev tools
pip install -e ".[dev]"
```

## Commands

```bash
# Validate a plan (non-JSON and JSON modes)
lex-pr schema validate plan.json
lex-pr schema validate plan.json --json

# Show merge order (levels)
lex-pr merge-order plan.json --json

# Gate runner (stub in v1)
lex-pr gate
```

## Notes
- Deterministic > clever. Outputs are sorted for stable diffs.
- `schemas/plan.schema.json` is the source of truth for validation.