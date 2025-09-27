# lex-pr — PR Runner & Merge Pyramid

> **Tagline:** Fan‑out tasks as multiple PRs in parallel, then build a merge pyramid from the blocks. Compute dependency order, run gates locally, and merge cleanly.

## Quickstart

```bash
# Install dependencies
npm install

# Run CLI commands
npm run cli -- plan --help
```

## Commands

```bash
# Generate plan artifacts (plan.json + snapshot.md)
npm run cli -- plan [--out <dir>]  # default: .smartergpt/runner

# Environment and config sanity checks
npm run cli -- doctor
```

### Plan Artifacts

The `plan` command generates two files:

- **`plan.json`**: Machine-readable plan with target, items, levels, and content hash
- **`snapshot.md`**: Human-readable snapshot with sections for Inputs, Levels, Items table, and Notes

Both files are deterministic and hash-stable - running the command multiple times with unchanged inputs produces identical artifacts.

## Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Build
npm run build
```

## Notes
- Deterministic > clever. Outputs are sorted for stable diffs.
- `schemas/plan.schema.json` is the source of truth for validation.
- Plan artifacts use topological sorting to compute execution levels