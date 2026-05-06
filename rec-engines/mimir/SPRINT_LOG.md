# Mimir — Sprint Log

Per-sprint development history. Most recent at top.

---

## Sprint 1.0.10 — Sandbox end-to-end validation + fixtures + integration tests (2026-05-06) ✅

**Why:** With sandbox approval to spin up a local Postgres + run end-to-end without touching real infrastructure, we validated the entire Phase 0 pipeline empirically. **Sprint 0.3 ("apply migration to non-prod DB") is now effectively done in a sandbox** — the runner, schema, and safety harness all work against a real Postgres 16. The user still needs to apply against their own Neon branch when at the laptop, but the migration code is now empirically proven.

**Goal:**
1. Validate the migration runner end-to-end against a real local Postgres.
2. Validate the offline driver against hand-crafted BGG fixtures.
3. Lock in realistic-data validation by adding fixtures + integration tests to the test suite.

**Why this sprint is special:** Earlier sprints used mental traces. Sprint 1.0.9 caught two bugs that mental traces missed (apostrophe in single-quoted string + npm test glob). This sprint ran ACTUAL CODE against ACTUAL POSTGRES and ACTUAL fixture files, which is the only way to be sure.

**Scope:**
- `tests/fixtures/bgg/*.json` — 7 hand-crafted BGG-shaped game fixtures (Terraforming Mars, Wingspan, Cascadia, Codenames, Pandemic, Ark Nova, Twilight Imperium 4)
- `tests/integration.test.mjs` — 6 end-to-end pipeline tests against the fixtures
- SPRINT_LOG.md — this entry, capturing the validation results

**Sandbox validation results (the actual proof, not committed but documented):**

```
=== Sprint 0.3 EFFECTIVELY VALIDATED in sandbox ===
local Postgres: 16.13 (Ubuntu)
DATABASE_URL: postgresql://mimir_test:localtest@localhost:5432/mimir_dev

STEP 1: npm run migrate:dry-run
  Found 1 migration file(s): 0001_create_rec_tables.sql
  ✓ 0001_create_rec_tables.sql passes safety check
  Dry run complete. No DB changes made.

STEP 2: npm run migrate
  Found 1 migration file(s): 0001_create_rec_tables.sql
  ✓ 0001_create_rec_tables.sql passes safety check
  → applying 0001_create_rec_tables.sql
    ✓ committed
  All migrations applied successfully.

STEP 3: schema verification
  rec_table_count: 15 (14 from 0001 + rec_migrations from runner) ✓
  rec_edge indexes: rec_edge_pkey, _src_id_dst_..._key, _src, _dst,
                    _type_ts, _context_gin (6 total) ✓
  rec_migrations: 1 row for 0001_create_rec_tables.sql ✓

STEP 4: idempotency (re-run npm run migrate)
  - 0001_create_rec_tables.sql already applied; skipping ✓

STEP 5: safety harness rejects malicious migration
  Created tmp 0002_TEST_BAD with `drop table users;`
  Output: 'Migration runner failed: 0002_TEST_BAD failed safety
    check: Safety check failed: migration attempts to drop non-rec_
    object "users".' ✓

STEP 6: prod-name guard rejects -prod URL
  DATABASE_URL=...mimir_test@.../afterroar-prod
  Output: 'Migration runner failed: Refusing to run against
    production-like database (URL contains prod/production/-live).
    Pass --allow-prod to override.' ✓

STEP 7: state unchanged after rejected attempts
  rec_table_count: still 15 ✓
  rec_migrations: still 1 row ✓
```

**Offline driver smoke test results:**

```
npm run run-rec -- --loved 167791,266192 --noped 178900 \
                   --players 4 --minutes 90 --explain rich

  1. Wingspan        score=5.862  conf=0.90  (loved)
  2. Terraforming Mars score=5.104 conf=0.90  (loved)
  3. Pandemic        score=4.339  conf=0.90  (cooperative + medium-light)
  4. Cascadia        score=4.339  conf=0.90  (tile-laying + drafting)
  5. Twilight Imperium score=2.164 conf=0.90 (length_violated flagged)
  6. Ark Nova        score=4.041  conf=0.90  (MMR pushed it down for diversity)
  7. Codenames       score=-10.000 conf=1.0  ("on your no-list")
```

Observations:
- Codenames hard-vetoed and ranked last with veto language ✅
- TI4 ranked below shorter games and emits `length_violated` reason ✅
- Ark Nova has higher score than TI4 but appears AFTER it due to MMR diversification (similar mechanic profile to Wingspan/TM seeds) ✅ — this is correct behavior, MMR is doing real work.
- Engine games rank top for engine-lover seed ✅

**Open observation worth noting** (not a bug, but a UX consideration for Sprint 1.x): the player’s seed-loved games appear at top of recommendations. v0 doesn’t filter them out. UX-wise we may want to exclude `seed_loved` from results in a wrapper (don’t recommend a game the player just told us they love). Not a Phase 0 issue — the recommender is correctly scoring them; the surface using it can apply the filter.

**Acceptance criteria:**
1. Local Postgres validation passes all 7 steps above ✅
2. Offline driver produces sensible recommendations for at least one realistic seed combination ✅
3. 7 game fixtures committed to `tests/fixtures/bgg/` ✅
4. Integration test suite exists and passes ✅ (6/6 new tests pass)
5. Total test suite count: 153 + 6 = 159, all green ✅

**Test plan (executed BEFORE push):**
- `git clone -b claude/review-uoroar-platform-CuLMi`
- `cd rec-engines/mimir && npm install`
- Set up local Postgres + dev DB
- Run all 7 migration validation steps — all pass
- Hand-craft 7 BGG fixtures into `tmp/bgg/`
- Run `npm run run-rec` with engine-lover seed — sensible output
- Copy fixtures to `tests/fixtures/bgg/`
- Add `tests/integration.test.mjs` with 6 assertions
- Run `npm test` — 159/159 pass

**Outcome:** Pushed in this commit. 7 fixtures + 1 integration test file + SPRINT_LOG entry.

**Verification:** Will be confirmed via post-push fresh-clone read-back.

**Learnings:**
- The local-Postgres validation took ~5 minutes and caught zero bugs in the migration code. That’s actually the IMPORTANT result — the test plan executed correctly because the code was right. The hotfix in 1.0.9 means I now trust the test suite, and end-to-end validation confirms it.
- The offline driver output is genuinely good for v0. The MMR + designer cap is doing real work; the explanation generator is producing readable English; the hard veto is unmissable. The AI-window investment paid off.
- **Hand-crafted fixtures are valuable for integration tests but expensive to author.** 7 fixtures took ~10 minutes. Worth it for the locked-in behavior they validate; not worth scaling beyond a representative set. When fetch-bgg is reachable from the laptop, real fixtures from `tmp/bgg/` will replace these for offline eval; integration tests can stay on the hand-crafted set for determinism.
- The user’s Neon DB needs the same migration applied. Path forward unchanged from HANDOFF.md § "When you sit at the laptop next."

**Rollback:** Revert this commit. The fixtures + integration tests are additive; no production code touched.

---

## Sprint 1.0.9 — HOTFIX: explain.mjs syntax + npm test glob (2026-05-06) ✅

Pushed at commit `7b3e85e`. Two bugs caught by real `npm test` execution after sandbox clone+install. Apostrophe in single-quoted string (line 121 of explain.mjs) + `node --test tests/` not walking directory in Node 22. Result: 153/153 pass.

---

## Sprint 1.0.8 — Logging helpers (2026-05-06) ✅

Pushed at commit `dacc20b`.

---

## Sprint 1.0.7 — HANDOFF.md update for laptop pickup (2026-05-06) ✅

Pushed at commit `5690d21`.

---

## Sprint 1.0.6 — recommend() composer + offline driver (2026-05-06) ✅

Pushed at commit `f6e60db`. THE CAPSTONE.

---

## Sprint 1.0.5 — Explanation generator (2026-05-06) ✅ (with apostrophe bug, fixed in 1.0.9)

Pushed at commit `0bd5d31`.

---

## Sprint 1.0.4 — MMR diversification + ranking pipeline (2026-05-06) ✅

Pushed at commit `7cde547`.

---

## Sprint 1.0.3 — v0 Scoring function (2026-05-06) ✅

Pushed at commit `089af2f`.

---

## Sprint 1.0.2 — Taste vector computation (2026-05-06) ✅

Pushed at commit `3bac627`.

---

## Sprint 1.0.1 — Curate seed BGG ID list (2026-05-06) ✅

Pushed at commit `61cab65`.

---

## Sprint 1.0 — BGG metadata fetcher (2026-05-06) ✅

Pushed at commit `337ed7c`.

---

## Sprint 0.2 — Migration runner script (2026-05-06) ✅ (with npm test glob bug, fixed in 1.0.9)

Pushed at commit `df30ac0`.

---

## Sprint 0.1 — First migration file (2026-05-06) ✅

Pushed at commit `9b1b383`.

---

## Sprint 0.0.2 — Design doc re-inline (2026-05-06) ✅

Pushed at commit `1d32f9e`.

---

## Sprint 0.0.1 — Rename + Norse convention + handoff docs (2026-05-06) ✅

`8c155ff` + 6 deletes; branch tip `a0f6c69`.

---

## Sprint 0.0 — Silo scaffold (2026-05-06) ✅

`f5d54ef`.

---

## Next sprint planned

## Sprint 0.3 — Apply 0001 migration to user’s Neon branch (REQUIRES LAPTOP, but EMPIRICALLY VALIDATED in sandbox)

**Note:** Sprint 1.0.10 effectively completed Sprint 0.3 against a local Postgres. The migration code, schema, safety harness, and idempotency are all empirically proven. The remaining work is just "apply against your Neon branch" — same steps as documented in HANDOFF.md § "When you sit at the laptop next."

**Confidence level:** High. The runner has been adversarially tested (rejects malicious migrations and prod-named DBs).

## Sprint 1.1 — BGG JSON → rec_* writer (DRAFT, depends on 0.3 against real Neon)

Reiterated.

## Sprint 1.2 — HTTP API surface for recommend() (Phase 1, depends on 0.3 + 1.1)

Reiterated.
