# Legacy Python Prototype

**REFERENCE ONLY - DO NOT USE IN PRODUCTION**

This directory contains the original Python implementation of lex-pr-runner, preserved for:
- Test fixture extraction
- Algorithm reference
- Golden test cases for TypeScript implementation

The active implementation is now in TypeScript at `src/`.

## Contents

- `py-prototype/` - Original Python CLI implementation with Typer
- `py-tests/` - Original Python tests with pytest

## Migration Status

The TypeScript implementation in `src/` provides:
- `lex-pr schema validate` - Plan JSON schema validation
- `lex-pr merge-order` - DAG building and levelization
- `lex-pr gate` - Gate execution with JSON output
- `lex-pr merge` - Merge orchestration (dry-run default)

Once all golden fixtures are extracted and TypeScript tests pass, this directory can be removed.