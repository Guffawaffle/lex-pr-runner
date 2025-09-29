# GitHub Copilot Instructions for lex-pr-runner

## Naming Quick Reference

Use canonical terms per [`docs/TERMS.md`](../docs/TERMS.md):

- **lex-pr-runner (project/repo)**: The repository you're reading
- **Runner CLI (core runner)**: TypeScript command-line app under `src/**`
- **MCP server (adapter)**: Optional read-only adapter at `src/mcp/server.ts`
- **Workspace profile**: Portable example profile under `.smartergpt/**`

Always use the exact tagline when referencing the project:
**Fan-out tasks as multiple PRs in parallel, then build a merge pyramid from the blocks. Compute dependency order, run gates locally, and merge cleanly.**

Follow imperative commit style ("Add…", "Fix…", "Update…") with optional prefixes (`runner:`, `mcp:`, `schema:`, `tests:`, `ci:`, `docs:`, `workspace:`).