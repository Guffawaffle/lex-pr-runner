---
applyTo: "**/tests/**/*.spec.ts"
---

# Test files — Copilot instructions

- Use **Vitest**; name tests `*.spec.ts`.
- Keep tests isolated and deterministic; avoid time/race flakiness.
- Prefer explicit ordering and stable fixtures; no network calls.
- Run locally with `npm test`; ensure CI passes without additional flags.