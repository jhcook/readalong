
# GEMINI Agent Instructions (Global)

Gemini must treat `.agent/` as the authoritative governance system for this
entire monorepo.

## Core Directives
- No code generation unless a Story in `.agent/stories/` is in COMMITTED state.
- Enforce all ADRs in `.agent/adrs/`.
- Enforce architecture + compliance guardrails.
- Follow workflows in `.agent/workflows/`.
- Run preflight checks before implementation.
- Defer language/framework rules to per‑app GEMINI.md files.

## Summary
Gemini must read, obey, and enforce the global governance model defined in
`.agent/`, and apply app‑specific rules when working inside mobile/, web/, or
backend/.

