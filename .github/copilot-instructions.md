# GitHub Copilot Instructions for lex-pr-runner

**North Star:** *Fan-out tasks as multiple PRs in parallel, then build a merge pyramid from the blocks. Compute dependency order, run gates locally, and merge cleanly.*

## Naming Quick Reference

Use canonical terms per [`docs/TERMS.md`](../docs/TERMS.md):

- **lex-pr-runner (project/repo)**: The repository you're reading
- **Runner CLI (core runner)**: TypeScript command-line app under `src/**`
- **MCP server (adapter)**: Optional read-only adapter at `src/mcp/server.ts`
- **Workspace profile**: Portable example profile under `.smartergpt/**`

## Architecture guardrails
- **Two-track separation (firm):**
  - **Core runner**: `src/**` (CLI, core logic, packaging, MCP adapter). Never store user/work artifacts.
  - **Workspace example**: `.smartergpt/**` is a portable example profile only. Track: `intent.md`, `scope.yml`, `deps.yml`, `gates.yml`, `pull-request-template.md`. **Ignore**: `.smartergpt/runner/`, `cache/`, `deliverables/`. Deliverables are posted as a **PR comment**, not committed.
- **Language:** TypeScript only. Remove dead Python wiring when nearby but do not rewrite history.

## Build & test
- **Node:** 20 LTS.
- **Install:** `npm ci`
- **Common scripts:**
  - Lint: `npm run lint`
  - Types: `npm run typecheck`
  - Test: `npm test`
  - Build: `npm run build`
- **Determinism check:** After `npm run build && npm run format`, the tree must be clean: `git diff --exit-code`.

## PR conventions
- **One PR = One chat.** Keep scope tight and acceptance criteria explicit.
- Add a **"How to verify"** section (exact commands + expected outcomes).
- **Commit style**: imperative mood ("Add…", "Fix…", "Update…") with optional prefixes (`runner:`, `mcp:`, `schema:`, `tests:`, `ci:`, `docs:`, `workspace:`).
- Prefer **plan + tests first** when requested (it's common here).

## Tasks Copilot should prioritize
- CI hygiene, docs, small refactors, test coverage, schema changes, CLI ergonomics, non-critical bug fixes.
- Avoid broad/ambiguous migrations, cross-repo designs, or anything requiring secrets or production credentials.

## Coding notes
- Outputs and ordering must be **stable/deterministic** (no random, time-dependent ordering; sort explicitly).
- Keep runtime deps minimal. Dev/test deps OK when justified in the PR.
- Never commit secrets or auth tokens. Do not modify branch protections.

## Directory quick map
- `src/` – core library & CLI.
- `schema/` – generated schemas kept in sync with source (CI verifies).
- `tests/` – Vitest unit/integration tests (`*.spec.ts`).
- `.github/` – workflows, repo instructions.
- `.smartergpt/` – portable example profile (see guardrails above).
