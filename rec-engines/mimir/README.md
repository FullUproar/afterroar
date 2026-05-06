# Mimir — Foundation Recommendation Engine

*Mimir, Norse god of wisdom and knowledge, guardian of the well of all knowledge. Odin gave an eye to drink from it. Engines that come after stand on what this one knows.*

---

The foundation rec engine for the Afterroar platform. Scores games by metadata similarity (mechanics, themes, designers, weight, length, player count). No internal play data required — runs entirely on BGG metadata + per-player onboarding seed input.

## Why this engine exists

Phase 0 of the platform recommendation roadmap. This engine ships before the network has any plays, votes, or trades. It's the cold-start baseline that:

1. Provides a working recommendation surface from day 1.
2. Establishes the API contract that future engines (`huginn`, `muninn`, `saga`, `norns`) will implement.
3. Captures logging signal that future engines train on.
4. Serves as the always-available fallback when richer engines have insufficient data for a specific caller.

It's deliberately the dumbest possible reasonable engine. **It is not the differentiator. Future engines are.** Mimir's job is to be present, correct, and observable while better engines are being built around it.

## What's inside

- `migrations/` — SQL DDL for `rec_*` tables (game, designer, mechanic, theme, category, edge, request_log, candidate_log, feedback_log) [Sprint 0.1]
- `src/` — TypeScript implementation: BGG fetcher, ranker, API endpoints [later sprints]
- `tests/` — Test suite including the SILO-required subtle-wrongness assertions [later sprints]
- `docs/recommendation-engine-design.md` — The architectural design doc (full spec for all engines)
- `SPRINT_LOG.md` — Sprint history for this engine

## Current phase

**Phase 0 — Scaffolding.** Directory exists, design doc and sprint log are in place, no executable code yet. Schema not applied to any database.

Next: Sprint 0.1 — first migration file with the `rec_*` table DDL. See `SPRINT_LOG.md` for the running plan.

## Graduation criteria (out of silo)

Mimir graduates from silo when ALL of these are true:

1. **End-to-end execution works.** `recommend(seed_game_id) → ranked list with explanations` returns sensible results for at least 30 distinct seed games (manual eyeball review).
2. **Performance.** Latency P99 < 500ms for `limit=10` requests against the full 5000-game dataset.
3. **Subtle-wrongness suite passes** (per SILO.md § 7):
   - Noped games never appear in recs
   - Player count constraints respected
   - Length constraints respected
   - Diversity prevents single-designer monocultures (≤2 from same designer in top 10)
   - Cold-start cases produce low-confidence responses, not nonsense
4. **Logging is complete.** Every request, candidate, score, and outcome captured.
5. **One canary store has used it for ≥1 week** with feature flag enabled, recommendation acceptance rate ≥60%, no reported quality issues.

Until all five are met, Mimir stays in silo.

## Reading order for new contributors / future Claudes

1. [`../HANDOFF.md`](../HANDOFF.md) — cross-engine context
2. [`../SILO.md`](../SILO.md) — silo rules + sprint discipline + naming convention
3. [`./SPRINT_LOG.md`](./SPRINT_LOG.md) — sprint history for this engine
4. [`./docs/recommendation-engine-design.md`](./docs/recommendation-engine-design.md) — full architectural spec
5. This README — engine-specific context
6. `migrations/` and `src/` — implementation

## Open questions specific to Mimir

- BGG API rate limit posture — confirmed limit and backoff strategy not yet documented
- Seed game pool curation (the ~50–100 games shown to new players in onboarding) — needs human-in-loop pass
- Hand-tuned weight values for the scoring function (`w1` through `w9` in design doc § 5.1) — initial values to be set in implementation, refined via offline eval
- Confidence score calibration — what threshold below which we return "insufficient data" instead of a list
