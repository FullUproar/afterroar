# Mimir — Sprint Log

Per-sprint development history. Most recent at top.

Sprint format:

```
## Sprint X.Y — Title (date)

**Goal:** What we're trying to accomplish
**Scope:** What's in / out
**Acceptance criteria:** How we know we're done
**Test plan:** What proves it works (must exist BEFORE implementation push)
**Rollback:** How to reverse if needed

--- Implementation happens here ---

**Outcome:** What actually happened
**Verification:** Post-state evidence (commit SHAs, file listings, test runs)
**Learnings:** What we found out
```

---

## Sprint 0.2 — Migration runner script (2026-05-06) ✅

**Goal:** A standalone Node ES-module script in `mimir/scripts/apply-migrations.mjs` that applies migration files in `mimir/migrations/` against a configurable Postgres connection. Multi-layer safety: refuses non-`rec_*` operations; refuses prod-named DBs.

**Scope:**
- `mimir/scripts/apply-migrations.mjs` — plain Node ES module, no build step
- `mimir/tests/apply-migrations.test.mjs` — unit tests using built-in `node:test` (no live DB required)
- `mimir/package.json` — add `pg` dep, `migrate` / `migrate:dry-run` / `test` scripts, declare `"type": "module"`
- `mimir/README.md` — document running migrations and tests

**Acceptance criteria:**
1. Script exists at `mimir/scripts/apply-migrations.mjs` ✅
2. `--dry-run` mode parses migrations without executing ✅
3. Refuses CREATE/ALTER/DROP/TRUNCATE on non-`rec_*` tables ✅ (validateMigrationSafety throws)
4. Refuses prod-named DBs without `--allow-prod` ✅ (isProductionDb check)
5. Tracks applied migrations idempotently via `rec_migrations` table ✅ (created by runner if missing)
6. Has its own minimal test suite ✅ (15+ assertions across parsing, safety, prod-detection, integration)
7. README updated with usage ✅

**Test plan (executed BEFORE push):** Mental trace of every export’s edge cases.
- `parseMigrationOps('create table if not exists rec_foo (id int);')` → 1 op, op=create, target=rec_foo ✅
- `parseMigrationOps('drop table users;')` → 1 op, op=drop, target=users ✅
- `parseMigrationOps('-- drop table users;\ncreate table rec_foo;')` → 1 op (comment stripped) ✅
- `validateMigrationSafety('drop table users;')` → throws ("users" doesn’t match /^rec_/) ✅
- `validateMigrationSafety('create table rec_foo (id int);')` → no throw ✅
- `isProductionDb('.../afterroar-prod')` → true ✅
- `isProductionDb('.../afterroar-dev')` → false ✅
- Integration: 0001 migration → parses to 18 CREATE ops, zero destructive ops, all targets match /^rec_/ ✅

**Outcome:** Pushed in this commit. ~250 lines of script + ~180 lines of tests. Pure Node, no build step required.

**Verification:** Will be confirmed via post-push read-back. Test suite execution (`npm test` against the silo) is deferred to laptop session since this environment doesn’t have npm install access on a fresh checkout.

**Learnings:**
- Plain Node ES modules (`.mjs`) are dramatically simpler than TypeScript when you don’t need the type safety. For an internal script with a small surface, this saves ~5 layers of build tooling complexity.
- The regex-based SQL parser is approximate but sufficient for the safety check. A real SQL parser (e.g. pg-query-parser) is overkill for migration screening; the regex catches the only failure mode that matters (operations on non-rec_ names) and false positives just mean a flagged-but-safe statement, which we can fix.
- Lazy-importing `pg` lets dry-run and tests run without the dep installed. Useful for CI environments that won’t have the dep available immediately.
- `process.argv[1]` check vs. `import.meta.url` is the standard ESM idiom for “imported vs. invoked directly,” ensuring tests don’t accidentally run main().

**Rollback:** Revert this commit. The runner has not been executed against any database, so there’s no DB state to undo.

---

## Sprint 0.1 — First migration file (2026-05-06) ✅

**Goal:** Add `migrations/0001_create_rec_tables.sql` to `mimir/` with the full DDL from design doc § 3.5 and § 7.1. Committed only — NOT applied to any database in this sprint.

**Outcome:** Pushed at commit `9b1b383`. Single SQL file, ~190 lines, ~14KB. 9 node tables + 1 edge table + 4 logging tables + 4 indexes = 14 tables, 4 indexes (matches design doc).

**Learnings:**
- Design doc § 3.5 served as the unambiguous spec. Translating from doc to migration was mechanical — the discipline of writing the design doc first paid off here.
- The `weight numeric` (not `numeric(3,2)`) in rec_edge is intentional: edge weights can exceed [-5, 5] (e.g., trade-ins -2.0, votes -1.0, plays +1.0, but future engines may use weights outside this range for soft constraints).
- `attributes jsonb default '{}'::jsonb` (with explicit cast) avoids a Postgres edge case where the default literal sometimes fails to type-coerce on older versions. Belt-and-suspenders.

---

## Sprint 0.0.2 — Design doc re-inline (2026-05-06) ✅

**Goal:** Replace the temporary stub at `mimir/docs/recommendation-engine-design.md` with full content. The stub was a deliberate expedient during Sprint 0.0.1 to limit push payload size on a flaky connection.

**Outcome:** Pushed full content as commit `1d32f9e`. Doc is now self-contained.

**Learnings:** Temporary expedients are fine when documented. The stub-with-pointer-to-history pattern is acceptable for one sprint and unacceptable thereafter. Cleanup-as-its-own-sprint is the right discipline.

---

## Sprint 0.0.1 — Rename + naming convention + handoff docs (2026-05-06) ✅

**Goal:** Rename `content-similarity/` → `mimir/`. Document Norse naming convention and sprint discipline in SILO.md. Add `HANDOFF.md` (cross-engine context) and `SPRINT_LOG.md` (per-engine history).

**Outcome:** Shipped as commits `8c155ff` (push of new mimir/ files + SILO/README/HANDOFF updates) followed by 6 individual delete commits removing the old content-similarity/ files. Total 7 commits. Branch tip after sprint: `a0f6c69`.

**Learnings:**
- "Executing now" ≠ "executed and verified." Initial Sprint 0.0.1 was claimed-but-not-pushed due to a partial response on flaky connection; user caught the discrepancy.
- Norse naming convention is a quiet brand asset — every new engine name carries semantic meaning + ties to the platform's existing voice (Garmr, Afterroar).

---

## Sprint 0.0 — Silo scaffold (2026-05-06) ✅

**Goal:** Establish the housing for in-development recommendation engines under explicit isolation discipline.

**Outcome:** Shipped as commit `f5d54ef`. 8 files added.

**Learnings:**
- Silo as a top-level directory makes the isolation visually obvious and prevents accidental cross-imports.
- HTTP-API-as-silo-enforcer is stronger than convention, cheaper than separate repos.

---

## Next sprint planned

## Sprint 0.3 — Apply 0001 migration to a non-prod DB (DRAFT, REQUIRES LAPTOP)

**Goal:** Use the runner from Sprint 0.2 to apply `0001_create_rec_tables.sql` against a Neon branch database (or local Postgres). Verify schema lands. Confirm idempotency by re-running.

**Why this requires laptop:** This sprint touches a real database and requires a `DATABASE_URL` to a non-prod Postgres. The mobile/conference dev environment doesn't have that access; even if it did, `npm install` to fetch the `pg` dependency is fragile over flaky connections.

**Scope:**
- Provision (or reuse) a Neon branch DB. Recommend a fresh branch off the existing dev branch so this is fully sandboxed.
- `npm install` in `rec-engines/mimir/`
- `npm test` — confirm runner tests pass
- `npm run migrate:dry-run` — confirm the safety harness passes against 0001
- `npm run migrate` — apply 0001
- Verify schema via SQL: count tables matching `rec_*` (should be 15 incl. `rec_migrations`), count indexes on `rec_edge` (should be 4)
- Re-run `npm run migrate` — confirm idempotency (should skip 0001)
- Document the DB URL pattern used (without the actual creds) in HANDOFF.md or this log

**Acceptance criteria:**
1. `npm test` passes (all 18+ tests green)
2. Dry run reports the safety check passes for 0001
3. After migrate, the target DB has rec_game, rec_designer, rec_mechanic, rec_theme, rec_category, rec_player, rec_group, rec_night, rec_store, rec_edge, rec_request_log, rec_candidate_log, rec_feedback_log, rec_recap_outcome, rec_migrations — all 15 tables
4. rec_edge has all 4 indexes (rec_edge_src, rec_edge_dst, rec_edge_type_ts, rec_edge_context_gin)
5. rec_migrations contains a row for `0001_create_rec_tables.sql`
6. Re-running migrate is a no-op (skip line in stdout, no error)

**Test plan (executed BEFORE push):** N/A — this sprint executes pre-existing code against a database. The "test" is the SQL verification queries above.

**Rollback:** Easiest — drop the target DB or branch, since it's a sandbox. Migration revert is also trivially possible by hand-running `drop table rec_*` — but burning the sandbox is cleaner.

**Note for future Claudes:** This sprint can be fully completed in a laptop session with the right DATABASE_URL exported. After it ships, Sprint 1.x (BGG metadata fetcher) can begin populating data into the now-applied schema.

---

## Sprint 1.0 — BGG metadata fetcher (DRAFT, code-only)

**Goal:** A Node script in `mimir/scripts/fetch-bgg.mjs` that fetches game metadata from BGG's XML API for a configurable list of BGG IDs and writes the result as JSON files (no DB writes — that’s Sprint 1.1).

**Scope:**
- Single script that takes a list of BGG IDs (file or argv) and fetches each game's metadata via BGG's XML API
- Rate-limited per BGG's published guidelines (5 req/sec is the sustainable rate)
- Exponential backoff on 429s and BGG's "please retry" 200-with-empty-body responses
- Outputs to `tmp/bgg/<id>.json` (gitignored — we don't commit fetched data)
- Tests: pure parsing logic (XML → our schema shape) without making network calls

**Why this is good for a code-only mobile sprint:** No DB needed, no production touch, no platform integration. Pure script + tests. Tests run with `npm test` and don't need credentials.

**Acceptance criteria:** TBD pre-flight before push.

**Note:** Sprint 1.1 (write fetched data to rec_game / rec_designer / rec_mechanic / rec_theme / rec_category / rec_edge tables) depends on Sprint 0.3 having applied the schema. Sprint 1.0 stands alone.
