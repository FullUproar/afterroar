# Rec Engines — Handoff Document

**Purpose:** Cross-session context restoration. When you sit down at a laptop after working on mobile (or vice versa), read this + the active engine's `SPRINT_LOG.md` to restore full context.

**Last updated:** 2026-05-06 (post Sprint 1.0.24, seidr seed corpus of 225 hand-authored game profiles)

---

## ⏱️ First 5 minutes on the laptop — exact commands

These three steps verify the repo is in the state this doc describes. If any test count differs, **stop and debug before proceeding** — something drifted between the mobile session and your laptop.

```bash
# 1. Pull the branch
cd <your-afterroar-checkout>
git fetch origin claude/review-uoroar-platform-CuLMi
git checkout claude/review-uoroar-platform-CuLMi
git log -1 --oneline   # most recent commit; the seed-corpus + doc-refresh sprints (1.0.24 + handoff polish)

# 2. Verify mimir tests
cd rec-engines/mimir
npm install --silent
npm test               # EXPECT 182/182 PASS

# 3. Verify seidr tests
cd ../seidr
npm install --silent
npm test               # EXPECT 181/181 PASS
```

If both pass, you're in sync with this doc and can proceed with the laptop-only work below.

---

## 🎯 What's left (laptop-only work, in priority order)

### 1. Apply migrations to your Neon dev branch — **biggest unblocker**

Mimir has 3 migrations + seidr has 1, all sandbox-validated against local Postgres 16. Apply to a NON-PROD Neon branch.

```bash
# From rec-engines/mimir
DATABASE_URL='postgres://your-neon-dev...' npm run migrate:dry-run  # safety check first
DATABASE_URL='postgres://your-neon-dev...' npm run migrate          # applies 0001 + 0002 + 0003

# From rec-engines/seidr
DATABASE_URL='postgres://your-neon-dev...' npm run migrate:dry-run
DATABASE_URL='postgres://your-neon-dev...' npm run migrate          # applies 0001_seidr_tables

# Verify (psql or Neon console)
SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'rec_%';
# Expect: 22 (15 from mimir 0001, 4 from mimir 0002, 3 from seidr 0001)
# Plus rec_migrations for bookkeeping = 23

SELECT (SELECT count(*) FROM rec_personality_profile) AS personality,
       (SELECT count(*) FROM rec_emotion) AS emotion,
       (SELECT count(*) FROM rec_cognitive_profile) AS cognitive,
       (SELECT count(*) FROM rec_context_type) AS context_type;
# Expect: 12 / 14 / 6 / 10  (42 seed taxonomy rows from mimir 0003)

SELECT filename FROM rec_migrations ORDER BY filename;
# Expect: 0001_create_rec_tables.sql, 0001_seidr_tables.sql,
#         0002_extend_rec_tables.sql, 0003_seed_taxonomies.sql

# Confirm idempotency: re-running both migrate commands should print
# "already applied; skipping" for every file.
```

The runner refuses any URL containing `prod`/`production`/`-live` unless you pass `--allow-prod` (don't, in Phase 0).

### 2. Real BGG fetch from your residential IP (optional)

This datacenter's IP was 403'd by BGG. From your laptop:

```bash
cd rec-engines/mimir
npm run fetch-bgg -- --file data/seed-bgg-ids.txt
# Pulls the 60 hand-curated seed IDs into tmp/. Polite rate-limited; should
# work cleanly from a residential IP. Confirm User-Agent + 202-retry behavior.
```

### 3. Real-user quiz testing (offline; no API tokens needed)

Seidr is fully runnable end-to-end against the **225-game seed corpus**.

```bash
cd rec-engines/seidr

# Open the deployable quiz UI locally
open quiz-ui/index.html
# OR serve via http for cleaner exports
cd quiz-ui && python -m http.server 8000  # then visit http://localhost:8000

# Real demo loop:
# 1. User takes the 18-question quiz on their phone
# 2. They Copy or Download the resulting JSON
# 3. You feed it back through the CLI:
node scripts/run-rec.mjs \
  --player-profile <their-quiz-export.json> \
  --game-profiles data/seed-game-profiles.json \
  --bgg-dir ../mimir/tests/fixtures/bgg \
  --limit 10 --detail rich
```

Sample inputs to sanity-check the loop:
- `--player-profile data/sample-quiz-export.json` (synthetic peaceful planner)
- `--archetype heavy-strategist` / `--archetype party-extravert` / `--archetype coop-puzzler`

### 4. Optional: top-500 LLM-API run for full corpus

The pipeline at `seidr/scripts/profile-game.mjs` is ready. With your Anthropic API key + Manus's `seidr/data/bgg-top25-bundle.json` (already in repo), you could re-generate the 225 profiles via API for calibration drift detection, OR extend to top-500 with additional BGG metadata.

```bash
ANTHROPIC_API_KEY=sk-ant-... node scripts/profile-game.mjs \
  --bgg-file <single-game-json> --model claude-sonnet-4-6 \
  --apply  # writes to rec_seidr_game_profile if DATABASE_URL set
```

Note: the pipeline currently expects one BGG JSON file per game (or `--bgg-dir`). The Manus bundle is a single-array JSON; you'd need to split it, OR extend the CLI to accept `--bgg-bundle` (~10-line change, deferred).

---

## Current state (high level)

| Engine | Phase | Tests | Last sprint |
|---|---|---|---|
| `mimir` | Phase 0 — end-to-end validated against local Postgres + real fixture data | **182/182** | Sprint 1.0.22 — seed taxonomies + parser detects INSERT/DELETE/UPDATE |
| `huginn` | Phase 0 scaffold-only; deferred to Phase 1+ (≥50 active users with real edges) | scaffold | Sprint 1.0.12 |
| `seidr` | Phase 0 — research + quiz UI + LLM pipeline + 225-game seed corpus + cosine matcher + explanation generator + offline CLI runner; **end-to-end runnable** | **181/181** | Sprint 1.0.24 |
| `saga` | Phase 0 — architecture locked in 3 design docs; implementation deferred until graduation thresholds met (≥3000 recap records, ~12-18mo post-launch) | scaffold + architecture | Sprint 1.0.17 |

**Schema state:** 23 `rec_*` tables defined across 4 migrations (3 in mimir, 1 in seidr). 42 seed-taxonomy rows. Sandbox-validated against Postgres 16 in this datacenter. Not yet on user's Neon.

**Branch:** `claude/review-uoroar-platform-CuLMi` in `fulluproar/afterroar`. Tip: `44c3c8b` (Sprint 1.0.24).

## Doc reading order

1. **This file** — high-level state + first-5-minutes commands
2. [`QUICKSTART.md`](./QUICKSTART.md) — 60-second "I want to see seidr work" guide
3. [`SILO.md`](./SILO.md) — silo rules, naming convention, sprint discipline (the constitution)
4. [`README.md`](./README.md) — short engine-list summary
5. [`mimir/SPRINT_LOG.md`](./mimir/SPRINT_LOG.md) — full mimir sprint history (most recent at top)
6. [`seidr/SPRINT_LOG.md`](./seidr/SPRINT_LOG.md) — full seidr sprint history
7. [`saga/SPRINT_LOG.md`](./saga/SPRINT_LOG.md) — saga sprint history (architecture docs only)
8. [`mimir/docs/recommendation-engine-design.md`](./mimir/docs/recommendation-engine-design.md) — architectural design doc that informs all engines

## What's in mimir/ right now

A full Phase 0 v0 content-similarity recommender, all in plain Node ES modules, zero build step. **182/182 tests pass on Node 22.22.2.**

**Schema layer:**
- `migrations/0001_create_rec_tables.sql` — 14 tables + 4 indexes (per design doc § 3.5 + § 7.1). Sandbox-validated against Postgres 16 in Sprint 1.0.10.
- `migrations/0002_extend_rec_tables.sql` — 4 dimension-framework node tables (`rec_personality_profile`, `rec_emotion`, `rec_cognitive_profile`, `rec_context_type`). Sandbox-validated in Sprint 1.0.15.
- `migrations/0003_seed_taxonomies.sql` — 42 seed taxonomy rows (Bartle 4 + OCEAN 5 + SDT 3 + MDA 8 + emotional palette 6 + cognitive 6 + context 10). Sandbox-validated in Sprint 1.0.22.
- `scripts/apply-migrations.mjs` — migration runner with multi-layer safety harness (CREATE/ALTER/DROP/TRUNCATE/INSERT/DELETE/UPDATE detection, prod-name guard, idempotent bookkeeping).

**BGG ingestion:**
- `scripts/fetch-bgg.mjs` — BGG XML API metadata fetcher with polite rate limiting. Datacenter IP 403'd by BGG; works fine from residential / cloud IPs.
- `data/seed-bgg-ids.txt` — 60 hand-curated BGG IDs across weight tiers + mechanics.

**Pipeline (pure functions):**
- `src/taste-vector.mjs`, `src/score.mjs`, `src/rank.mjs`, `src/explain.mjs`, `src/recommend.mjs`, `src/logging.mjs` — content-similarity recommender.

**Offline driver:**
- `scripts/run-rec.mjs` — CLI for human-in-loop eval. Smoke-tested in Sprint 1.0.10.

**Tests (182):**
- 12+ SUBTLE-WRONGNESS guards per SILO.md § 7
- 6 integration tests against `tests/fixtures/bgg/` (7 hand-crafted game fixtures)
- Parser tests for all DDL + DML ops (Sprint 1.0.22)
- 6 integration tests for migration 0003 (data-only, all rec_seidr_*-prefixed targets, dedupe, etc.)

## What's in seidr/ right now

End-to-end profile-driven recommendation engine, runnable today against a 225-game corpus. **181/181 tests pass.**

**Schema:**
- `migrations/0001_seidr_tables.sql` — 3 engine-specific tables (`rec_seidr_player_profile`, `rec_seidr_game_profile`, `rec_seidr_response`). Sandbox-validated in Sprint 1.0.18.

**Data corpus:**
- `data/dimensions.json` — 24-dimension taxonomy (PSY/SOC/MEC/AES/CTX/EMO clusters)
- `data/question-bank.json` — 50 curated quiz questions (38 from Manus AI's research, edited; 12 new)
- `data/reference-profiles.json` — 7 hand-authored reference profiles (validation gold-standard)
- `data/bgg-top25-bundle.json` — 225 BGG metadata records (Manus AI delivery, archived)
- `data/seed-game-profiles.json` — **225 hand-authored 24-dim profiles** (Sprint 1.0.24, the matcher's corpus)
- `data/sample-quiz-export.json` — synthetic quiz UI export for the demo loop

**Source modules (pure functions):**
- `src/validate-profile.mjs` — profile schema validator
- `src/prompt-template.mjs` — LLM prompt template (`PROMPT_VERSION = '1.0.0'`)
- `src/profile-game.mjs` — pipeline core: `generateProfile()`, `generateBatch()`, `createMockLLMClient()`
- `src/match.mjs` — cosine similarity matcher with MMR diversification + designer cap + subtle-wrongness assertions
- `src/explain.mjs` — natural-language explanation generator (short + rich detail modes)
- `src/load-player-profile.mjs` — auto-detects 4 input shapes (quiz UI export, matcher-native, etc.)

**Quiz UI (deployable):**
- `quiz-ui/index.html` — self-contained ~580 line static app
- `quiz-ui/dimensions.json`, `quiz-ui/question-bank.json` — runtime copies
- Drop-in deployable to Vercel/Netlify/GitHub Pages or `python -m http.server`

**CLI runners:**
- `scripts/profile-game.mjs` — LLM-driven profile generation (mock + Anthropic SDK)
- `scripts/run-rec.mjs` — offline matcher + explainer with built-in archetypes
- `scripts/apply-migrations.mjs` — duplicate of mimir's runner per silo § 8 (no cross-engine imports)

**Tests (181):**
- 33 validator tests
- 22 prompt-template tests
- 18 profile-game pipeline tests
- 14 migration runner tests (incl. INSERT/DELETE/UPDATE coverage)
- 35 matcher tests (incl. **8 SUBTLE-WRONGNESS assertions**)
- 23 explain tests
- 15 load-player-profile tests
- 7 seed-game-profiles tests (incl. **4 corpus-scale subtle-wrongness assertions**)
- 6 cross-suite integration tests against the 7 reference profiles

## Working agreement (sprint discipline)

Every sprint follows this cadence:

1. **Pre-flight** in chat AND committed to the engine's `SPRINT_LOG.md`: goal, scope, acceptance criteria, test plan, rollback recipe.
2. **Test plan written BEFORE implementation.**
3. **Build.**
4. **Verify** by executing the test plan. **"Executed" ≠ "verified" — verification means actually running the code (npm test, smoke test, etc.), not just rereading it.**
5. **Push** with full-context commit message.
6. **Post-state verification** — read back from the repo to confirm.
7. **Post-mortem** in `SPRINT_LOG.md`.

Details in [`SILO.md`](./SILO.md) § "Sprint discipline".

## Sandbox validation evidence (for trust)

Each schema migration was applied to a fresh local Postgres 16 in this datacenter before push:

- **Sprint 1.0.10** — mimir 0001 applies cleanly; rec_migrations row recorded; idempotent re-apply; safety harness rejects `drop table users`; prod-name guard refuses prod-named URLs.
- **Sprint 1.0.15** — mimir 0002 applies cleanly atop 0001; 19 rec_* tables; both 0001+0002 in rec_migrations.
- **Sprint 1.0.18** — seidr 0001 applies cleanly; 22 rec_* tables (mimir 19 + seidr 3); rec_migrations carries all three filenames; partial index on rec_seidr_game_profile (WHERE superseded=false) confirmed.
- **Sprint 1.0.22** — mimir 0003 applies cleanly; 42 seed-taxonomy rows in 4 tables (12/14/6/10); ON CONFLICT DO NOTHING idempotent; safety harness now rejects `INSERT INTO users` (non-rec target).
- **Sprint 1.0.24** — 225 hand-authored profiles validated against schema (`validateProfiles` returns ok=true for all); cosine matcher produces sensible top-N for canonical archetypes against full corpus.

Adversarial harness tests (in suite + run interactively):
- Malicious `DROP TABLE users` rejected before DB call ✅
- Malicious `INSERT INTO users (...)` rejected before DB call ✅
- DATABASE_URL containing `prod`/`production`/`-live` rejected by prod-name guard ✅

## Cross-engine notes

- **Schema sharing:** `rec_*` tables are shared. mimir-owned tables go in `mimir/migrations/`; engine-specific tables (e.g., `rec_seidr_*`) go in that engine's own `migrations/`. Filenames must be unique across engines (mimir uses `000N_*`, seidr uses `0001_seidr_*`).
- **Runners are duplicated, not shared.** Per SILO § 8, each engine carries its own copy of `scripts/apply-migrations.mjs`. Functionally identical; bookkeeping (`rec_migrations`) is shared.
- **Naming convention:** Norse mythology. Engines on disk: `mimir`, `huginn`, `seidr`, `saga`. Future: `muninn` (embeddings), `norns` (gene-graph), `yggdrasil` (federated cross-store).
- **Sprint discipline applies to all engines.** Each engine maintains its own `SPRINT_LOG.md`.

## Pending decisions / questions (for the laptop session to resolve or punt on)

- **Where does the rec router live?** Probably `apps/me` (Passport) or a new `packages/rec-router/`. Not built yet, not needed until Phase 1.
- **Who curates the seed game pool?** 225 games via Manus + Sprint 1.0.24's hand-authored profiles is a good Phase 0 corpus. Need a human-in-loop validation pass on ~10-20 reference games when you have time.
- **Recap structured field set.** The simulator engine (`saga`, future) trains on per-night per-player fun ratings + outcomes. HQ's recap UI must capture the structured fields specified in `mimir/docs/recap-data-spec.md` BEFORE the recap UI v1 ships. (Sprint 1.0.13 specified the contract; HQ team execution is a separate work stream.)
- **UX consideration noted in Sprint 1.0.10 smoke test:** the recommender currently returns seed-loved games in results. The wrapping surface (HQ picker, etc.) probably wants to filter them out — Sprint 1.0.11 added `exclude_seeds` option for that.
- **Top-500 LLM run vs. 225 seed corpus.** Sprint 1.0.24 produced 225 hand-authored profiles in-conversation (no API tokens). For deeper coverage you'd run the API pipeline against more games, but the 225 corpus is sufficient for offline real-user testing today.

## Cumulative session footprint (mobile sessions ending 2026-05-06)

24 sprints under TDD discipline. Most recent first:

- Sprint 1.0.24: seidr seed corpus of 225 hand-authored game profiles (`44c3c8b`) — current
- Sprint 1.0.23: rec-engines QUICKSTART.md (`3d30992`)
- Sprint 1.0.22: mimir 0003 seed taxonomies + parser detects INSERT/DELETE/UPDATE (`d0bc3fa`)
- Sprint 1.0.21: seidr quiz-UI-export interop in CLI loader (`587a603`)
- Sprint 1.0.20: seidr explanation generator + offline CLI runner (`a2dab2b`)
- Sprint 1.0.19: seidr cosine matcher + 8 subtle-wrongness assertions + 2 integration tests (`b745c5a`)
- Sprint 1.0.18: seidr game-profiling pipeline + 7 reference profiles + schema (`45ec173`)
- Sprint 1.0.17: saga scaffold + 3 architecture docs (`4b4520a`)
- Sprint 1.0.16: seidr scaffold + research artifacts + deployable quiz UI (5 commits, `c60771e` → `62f0279`)
- Sprint 1.0.15: schema extension — 4 dimension-framework node tables (`b6cb0b6`)
- Sprint 1.0.14: saga scaffold — DEFERRED (rolled into 1.0.17)
- Sprint 1.0.13: recap data spec for HQ recap UI v1 (`610eb35`)
- Sprint 1.0.12: huginn scaffold — second engine validates silo pattern (`524e774`)
- Sprint 1.0.11: exclude_seeds option (UX fix from smoke test) (`790426c`)
- Sprint 1.0.10: sandbox end-to-end validation + fixtures + integration tests
- Sprint 1.0.9: HOTFIX explain.mjs + npm test glob (`7b3e85e`) — caught by real test run
- Sprint 1.0.8: logging helpers (`dacc20b`)
- Sprint 1.0.7: HANDOFF.md update (`5690d21`)
- Sprint 1.0.6: recommend() composer + offline driver (`f6e60db`)
- Sprint 1.0.5: explanation generator (`0bd5d31`)
- Sprint 1.0.4: MMR + designer cap ranking (`7cde547`)
- Sprint 1.0.3: v0 scoring function (`089af2f`)
- Sprint 1.0.2: taste vector computation (`3bac627`)
- Sprint 1.0.1: curated seed BGG ID list (`61cab65`)
- Sprint 1.0: BGG metadata fetcher (`337ed7c`)
- Sprint 0.2: migration runner with safety harness (`df30ac0`)
- Sprint 0.1: first migration file (`9b1b383`)
- Sprint 0.0.2 / 0.0.1 / 0.0: silo scaffold + Norse rename + design doc

~5.7k lines of source code, ~12k+ lines of tests + docs + data. End-state: mimir **182/182**, seidr **181/181**; migration runners validated against real Postgres; four engines registered (mimir running with seeded taxonomies, huginn scaffold, seidr end-to-end with 225-game corpus, saga architecture-locked); **23 rec_* tables in schema with 42 seed-taxonomy rows**, sandbox-validated, not yet on user's Neon. **Seidr fully runnable end-to-end via `scripts/run-rec.mjs --game-profiles data/seed-game-profiles.json`.**
