# Runner Snapshot

## Inputs

- Target: `main`
- Items count: 2
- Content hash: `d60d5f54931d19be98b799fc9ed158060e6a0716656d3afc630e27bf0efd2218`

## Levels

Level 0: [1]
Level 1: [2]

## Items

| id | branch | sha | needs | strategy |
|---|---|---|---|---|
| 1 | feat/a | (current) | (none) | rebase-weave |
| 2 | feat/b | (current) | 1 | rebase-weave |


## Notes

- Plan computed with deterministic topological sorting
- Levels indicate execution order (items in same level can run in parallel)
- Content hash ensures plan stability for unchanged inputs
