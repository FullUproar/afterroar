# Rec Engines — Handoff Document

**Purpose:** Cross-session context restoration. When you sit down at a laptop after working on mobile (or vice versa), read this + the active engine's `SPRINT_LOG.md` to restore full context.

**Last updated:** 2026-05-06 (post Sprint 1.0.6, end of mobile session)

---

## What `rec-engines/` is

The siloed home for experimental recommendation engines. Each engine is a subdirectory with its own README, sprint log, schema, code, and tests. Production code never imports from here — integration is via HTTP only. See [`SILO.md`](./SILO.md) for the rules.

## Why this exists

The platform's long-term differentiator is recommendation quality across three surfaces (HQ game-night picker, Passport library, POS buy-side). Multiple algorithmic approaches will be implemented as separate engines and A/B tested against each other in production. This directory is the development sandbox.

Full architectural rationale: [`mimir/docs/recommendation-engine-design.md`](./mimir/docs/recommendation-engine-design.md).

## Current state (high level)

| Engine | Phase | Status | Last sprint |
|---|---|---|---|
| `mimir` | Phase 0 | **Mobile-buildable portion COMPLETE.** End-to-end pipeline runnable offline. Awaiting laptop session for Sprint 0.3 (apply migration to Neon). | Sprint 1.0.6 — recommend() composer + offline driver |

## What’s in mimir/ right now

A full Phase 0 v0 content-similarity recommender, all in plain Node ES modules, zero build step:

**Schema layer:**
- `migrations/0001_create_rec_tables.sql` — 14 tables + 4 indexes (per design doc § 3.5 + § 7.1). NOT YET APPLIED to any DB.
- `scripts/apply-migrations.mjs` — migration runner with multi-layer safety harness.

**BGG ingestion:**
- `scripts/fetch-bgg.mjs` — BGG XML API metadata fetcher with polite rate limiting.
- `data/seed-bgg-ids.txt` — 60 hand-curated BGG IDs across weight tiers + mechanics.

**Pipeline (pure functions):**
- `src/taste-vector.mjs` — `computeTasteVector(loved, noped, gameMetadata)`
- `src/score.mjs` — `scoreCandidate(candidate, taste, context)` per design doc § 5.1
- `src/rank.mjs` — `rankCandidates(...)` with MMR diversification + hard designer cap
- `src/explain.mjs` — `explain(scored, candidate, taste)` reason-code-driven templates
- `src/recommend.mjs` — `recommend(request, gameMetadata)` per design doc § 4 contract

**Offline driver:**
- `scripts/run-rec.mjs` — CLI for human-in-loop eval. Loads `tmp/bgg/`, takes seed picks, prints recommendations.

**Tests:**
- ~120 assertions across 7 test files (`tests/*.test.mjs`)
- 12+ SUBTLE-WRONGNESS guards per SILO.md § 7
- All tests run with `npm test` (no DB or network required)

## When you sit at the laptop next, do this

```bash
cd rec-engines/mimir

# 1. Install deps
npm install

# 2. Run the test suite. ALL TESTS SHOULD PASS. If any fail, that’s
#    the first thing to debug — the mobile sprint discipline relied
#    on mental tracing, so a fresh test run is the canonical proof.
npm test

# 3. Fetch BGG metadata for the seed pool (~1 minute)
npm run fetch-bgg -- --file data/seed-bgg-ids.txt

# 4. Run an offline recommendation as a smoke test
npm run run-rec -- --loved 167791,266192 --noped 178900 --players 4 --minutes 90 --explain rich

# 5. EYEBALL THE OUTPUT. Manually evaluate ~10–20 different seed
#    combinations. The recommender is supposed to be "defensible for
#    >80% of cases" before moving past internal validation
#    (per mimir/README.md graduation criteria #3).
```

If the offline driver produces sensible output, the next blocking sprint is:

## Sprint 0.3 — Apply 0001 migration to a non-prod DB (laptop required)

**Why blocking:** Sprint 1.1 (BGG JSON → rec_* writer) and everything downstream needs the schema applied somewhere.

**Steps:**
1. Provision (or reuse) a Neon branch DB. Recommend a fresh branch off your existing dev branch so this is fully sandboxed. **Do NOT use a production-named DB — the runner refuses anyway, but verify in the connection URL.**
2. Set `DATABASE_URL` env var.
3. `npm run migrate:dry-run` — confirm safety harness passes.
4. `npm run migrate` — apply 0001.
5. Verify schema via SQL:
   ```sql
   select count(*) from information_schema.tables where table_schema='public' and table_name like 'rec_%';
   -- expect 15 (14 from 0001 + rec_migrations created by runner)
   select indexname from pg_indexes where tablename = 'rec_edge';
   -- expect: rec_edge_src, rec_edge_dst, rec_edge_type_ts, rec_edge_context_gin
   select * from rec_migrations;
   -- expect one row for 0001_create_rec_tables.sql
   ```
6. Re-run `npm run migrate` to confirm idempotency (should print "already applied; skipping").
7. Update `mimir/SPRINT_LOG.md` — mark Sprint 0.3 complete with the verification SQL output.

After 0.3, Sprint 1.1 (BGG → rec_* writer) is unblocked.

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
3. Read `mimir/SPRINT_LOG.md` for detailed history.
4. Read `mimir/README.md` for engine-specific context (graduation criteria, open questions).
5. The next sprint is documented in `mimir/SPRINT_LOG.md` under "Next sprint planned".

## Active engine

Currently active: **`mimir/`** (the only engine).

## Branch & repo

- **Branch:** `claude/review-uoroar-platform-CuLMi` (in `fulluproar/afterroar`)
- **Branch tip after Sprint 1.0.6:** `f6e60db` (will be `1.0.7` after this commit)
- **No PR open yet.** When ready to merge, the silo can graduate selectively (engine by engine, feature by feature) per SILO.md § 5.

## Cross-engine notes

- **Schema sharing:** `rec_*` tables defined in `mimir/migrations/` are shared by all engines. Engine-specific tables get the engine name prefixed (e.g., `rec_huginn_pageranks`).
- **Naming convention:** Norse mythology. Future engines: `huginn` (PPR), `muninn` (embeddings), `saga` (simulator), `norns` (gene-graph), `yggdrasil` (federated).
- **Sprint discipline applies to all engines.** Each engine maintains its own `SPRINT_LOG.md`.

## Pending decisions / questions

See individual engine READMEs for engine-specific open questions. Cross-engine open questions:

- **Where does the rec router live?** Probably `apps/me` (Passport) or a new `packages/rec-router/`. Not built yet, not needed until Phase 1.
- **Who curates the seed game pool?** Currently 60 IDs hand-curated by Claude during Sprint 1.0.1. Needs a human-in-loop pass to validate IDs and adjust based on real FLGS feedback.
- **BGG API rate limit posture.** Need to confirm published limits and our backoff strategy before scaling the metadata fetcher beyond ~5,000 games.
- **Recap structured field set.** The simulator engine (`saga`, future) trains on per-night per-player fun ratings + outcomes. HQ’s recap UI needs structured-with-optional-freeform fields, decided BEFORE the recap UI v1 ships, because retrofitting structured fields onto recaps that already happened is painful.

## Cumulative session footprint (mobile session ending 2026-05-06)

For reference, the following sprints landed in this single mobile session under TDD discipline (test plan written before each implementation push):

- Sprint 0.0: silo scaffold (`f5d54ef`)
- Sprint 0.0.1: rename + Norse convention + handoff docs (`8c155ff` + 6 deletes → tip `a0f6c69`)
- Sprint 0.0.2: design doc re-inline (`1d32f9e`)
- Sprint 0.1: first migration file (`9b1b383`)
- Sprint 0.2: migration runner with safety harness (`df30ac0`)
- Sprint 1.0: BGG metadata fetcher (`337ed7c`)
- Sprint 1.0.1: curated seed BGG ID list (`61cab65`)
- Sprint 1.0.2: taste vector computation (`3bac627`)
- Sprint 1.0.3: v0 scoring function (`089af2f`)
- Sprint 1.0.4: MMR + designer cap ranking (`7cde547`)
- Sprint 1.0.5: explanation generator (`0bd5d31`)
- Sprint 1.0.6: recommend() composer + offline driver (`f6e60db`)
- Sprint 1.0.7: this HANDOFF.md update (current commit)

13 sprints, ~120 test assertions, ~1.5k lines of source code, ~2k lines of tests + docs. All on flaky conference WiFi.
