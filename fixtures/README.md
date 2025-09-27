# Golden Test Fixtures

These fixtures are extracted from the Python prototype implementation to ensure TypeScript implementation parity.

## Plan Fixtures

- `plan-simple.json` - Basic plan with simple dependencies (expected levels: [[1,3], [2]])
- `plan-cycle.json` - Plan with circular dependency (should error)
- `plan-unknown-dep.json` - Plan with missing dependency reference (should error)
- `plan-invalid-schema.json` - Malformed plan JSON (should error on schema validation)

## Expected Results ✅ VERIFIED

### plan-simple.json merge-order levels:
```json
[
  [1, 3],
  [2]
]
```

### plan-with-gates.json merge-order levels:
```json
[
  [1],
  [2]
]
```

### Error cases:
- `plan-cycle.json` → CycleError: "dependency cycle detected" ✅
- `plan-unknown-dep.json` → UnknownDependencyError: "unknown dependency '999' for item '1'" ✅
- `plan-invalid-schema.json` → ValidationError: "items: Expected array, received string" ✅## Gate Result Samples

TODO: Extract from Python implementation when available
