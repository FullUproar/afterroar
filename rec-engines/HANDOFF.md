# Rec Engines — Handoff Document

**Purpose:** Cross-session context restoration. When you sit down at a laptop after working on mobile (or vice versa), read this + the active engine's `SPRINT_LOG.md` to restore full context.

**Last updated:** 2026-05-06 (during Sprint 0.0.1)

---

## What `rec-engines/` is

The siloed home for experimental recommendation engines. Each engine is a subdirectory with its own README, sprint log, schema, code, and tests. Production code never imports from here — integration is via HTTP only. See [`SILO.md`](./SILO.md) for the rules.

## Why this exists

The platform's long-term differentiator is recommendation quality across three surfaces (HQ game-night picker, Passport library, POS buy-side). Multiple algorithmic approaches will be implemented as separate engines and A/B tested against each other in production. This directory is the development sandbox.

Full architectural rationale: [`mimir/docs/recommendation-engine-design.md`](./mimir/docs/recommendation-engine-design.md).

## Current state (high level)

| Engine | Phase | Status | Last sprint |
|---|---|---|---|
| `mimir` | Phase 0 | Scaffolding | Sprint 0.0.1 — directory rename + Norse convention docs |

No executable code yet in any engine. Schema not applied to any database. No production traffic.

## Working agreement (sprint discipline)

Every sprint follows this cadence:

1. **Pre-flight** in chat AND committed to the engine's `SPRINT_LOG.md`: goal, scope, acceptance criteria, test plan, rollback recipe.
2. **Test plan written BEFORE implementation.**
3. **Build.**
4. **Verify** by executing the test plan.
5. **Push** with full-context commit message.
6. **Post-state verification** — read back from the repo to confirm.
7. **Post-mortem** in `SPRINT_LOG.md`.

Details in [`SILO.md`](./SILO.md) § "Sprint discipline".

## How to resume work

1. Read this file for high-level state.
2. Read [`SILO.md`](./SILO.md) for the rules (naming convention, sprint discipline, subtle-wrongness assertions).
3. Read the active engine's `SPRINT_LOG.md` for detailed history.
4. Read the active engine's `README.md` for engine-specific context (graduation criteria, open questions).
5. The next sprint is documented in the engine's `SPRINT_LOG.md` under "Next sprint planned" (or, if absent, propose one in chat with full pre-flight before pushing).

## Active engine

Currently active: **`mimir/`** (the only engine).

## Cross-engine notes

- **Schema sharing:** `rec_*` tables defined in `mimir/migrations/` are shared by all engines. Engine-specific tables get the engine name prefixed (e.g., `rec_huginn_pageranks`).
- **Branch:** all rec-engines work currently happens on `claude/review-uoroar-platform-CuLMi`.
- **Repo:** `fulluproar/afterroar` (the Afterroar monorepo).

## Pending decisions / questions

See individual engine READMEs for engine-specific open questions. Cross-engine open questions:

- **Where does the rec router live?** Probably `apps/me` (Passport) or a new `packages/rec-router/`. Not built yet, not needed until Phase 1.
- **Who owns the seed game pool?** A curated list of ~50–100 games for cold-start onboarding. BGG top 200 with diversity heuristics is the v0 source; human curation pass deferred.
- **BGG API rate limit posture.** Need to confirm published limits and our backoff strategy before scaling the metadata fetcher.
