# Content Similarity Rec Engine

The foundation rec engine. Scores games by metadata similarity (mechanics, themes, designers, weight, length, player count). No internal play data required — runs entirely on BGG metadata + per-player onboarding seed input.

## Why this engine exists

Phase 0 of the platform recommendation roadmap. This engine ships before the network has any plays, votes, or trades. It's the cold-start baseline that:

1. Provides a working recommendation surface from day 1.
2. Establishes the API contract that future engines (PPR, embeddings, simulator, gene-graph) will implement.
3. Captures logging signal that future engines train on.
4. Serves as the always-available fallback when richer engines have insufficient data for a specific caller.

It's deliberately the dumbest possible reasonable engine. **It is not the differentiator. Future engines are.** Its job is to be present, correct, and observable while better engines are being built around it.

## What's inside

- `migrations/` — SQL DDL for `rec_*` tables (game, designer, mechanic, theme, category, edge, request_log, candidate_log, feedback_log) [forthcoming, Sprint 0.1]
- `src/` — TypeScript implementation: BGG fetcher, ranker, API endpoints [forthcoming, later sprints]
- `tests/` — Test suite including the SILO-required subtle-wrongness assertions [forthcoming]
- `docs/recommendation-engine-design.md` — The architectural design doc (full spec for all engines)

## Current phase

**Phase 0 — Scaffolding.** Directory exists, design doc is in place, no executable code yet. Schema not applied to any database.

## Sprint roadmap

Following the design doc § 6.1 + the sprint discipline established in the platform planning conversation:

- ~~Sprint 0.0~~ — Scaffold silo (this commit). ✅
- Sprint 0.1 — First migration file: `rec_*` tables DDL. Committed only, not applied.
- Sprint 0.2 — Standalone migration runner script (silo-only, never touches non-`rec_*` tables).
- Sprint 0.3 — Apply migrations against a non-prod database. Verify tables. Test rollback.
- Sprint 1.x — BGG metadata fetcher (50-game smoke test → backfill to 5,000).
- Sprint 2.x — Internal `recommend()` SQL function + admin test endpoint.
- Sprint 3.x — First user-facing surface (single-pilot rollout under feature flag).

(Numbering not strict — sprints can be subdivided as small as needed per the discipline.)

## Graduation criteria (out of silo)

This engine graduates from silo when ALL of these are true:

1. **End-to-end execution works.** `recommend(seed_game_id) → ranked list with explanations` returns sensible results for at least 30 distinct seed games (manual eyeball review by Shawn).
2. **Performance.** Latency P99 < 500ms for `limit=10` requests against the full 5000-game dataset.
3. **Subtle-wrongness suite passes** (per SILO.md § 7):
   - Noped games never appear in recs.
   - Player count constraints respected.
   - Length constraints respected.
   - Diversity prevents single-designer monocultures (≤2 from same designer in top 10).
   - Cold-start cases produce low-confidence responses, not nonsense.
4. **Logging is complete.** Every request, candidate, score, and outcome captured. Verified by counting log rows after a test session.
5. **One canary store has used it for ≥1 week** with feature flag enabled, recommendation acceptance rate ≥60%, no reported quality issues.

Until all five are met, this engine stays in silo. Graduation event = a single PR that wires the rec router (production-side) to call this engine's API for a small percentage of traffic.

## Reading order for new contributors / future Claudes

1. [`../SILO.md`](../SILO.md) — silo rules
2. [`docs/recommendation-engine-design.md`](./docs/recommendation-engine-design.md) — full architectural spec
3. This README — context for this specific engine
4. `migrations/` and `src/` — implementation

## Open questions specific to this engine

- BGG API rate limit posture — confirmed limit and backoff strategy not yet documented
- Seed game pool curation (the ~50–100 games shown to new players in onboarding) — needs human-in-loop pass
- Hand-tuned weight values for the scoring function (`w1` through `w9` in design doc § 5.1) — initial values to be set in implementation, refined via offline eval
- Confidence score calibration — what threshold below which we return "insufficient data" instead of a list
