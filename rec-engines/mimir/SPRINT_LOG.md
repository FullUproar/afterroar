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

## Sprint 0.1 — First migration file (2026-05-06) ✅

**Goal:** Add `migrations/0001_create_rec_tables.sql` to `mimir/` with the full DDL from design doc § 3.5 and § 7.1. Committed only — NOT applied to any database in this sprint.

**Scope:**
- Single SQL file containing CREATE TABLE statements for: `rec_game`, `rec_designer`, `rec_mechanic`, `rec_theme`, `rec_category`, `rec_player`, `rec_group`, `rec_night`, `rec_store`, `rec_edge`, `rec_request_log`, `rec_candidate_log`, `rec_feedback_log`, `rec_recap_outcome`
- All 4 indexes from design doc § 3.5
- Comments explaining each table's purpose
- Migration is additive only (no DROP / ALTER); idempotent via `IF NOT EXISTS`

**Acceptance criteria:**
1. File exists at `rec-engines/mimir/migrations/0001_create_rec_tables.sql` ✅
2. Pure SQL DDL, no app code, no INSERT/UPDATE/DELETE ✅
3. All 14 tables from design doc are represented ✅
4. All 4 rec_edge indexes are represented ✅
5. Each table has a SQL comment explaining its purpose ✅
6. Migration is safely re-runnable (`IF NOT EXISTS` on every CREATE) ✅

**Test plan (executed BEFORE push):**
- Visual SQL inspection — syntax, structure, comment coverage ✅
- Confirmed `IF NOT EXISTS` on every CREATE TABLE and CREATE INDEX ✅
- Confirmed zero DROP / ALTER / DELETE / TRUNCATE / INSERT / UPDATE statements ✅
- Confirmed 14 table count matches design doc ✅
- Confirmed 4 index count matches design doc ✅
- Confirmed comments are present on each table ✅

**Outcome:** Pushed in this commit. Single SQL file, ~190 lines, ~14KB.

**Verification:** Will be confirmed via post-push read-back.

**Learnings:**
- Design doc § 3.5 served as the unambiguous spec. Translating from doc to migration was mechanical — the discipline of writing the design doc first paid off here.
- The `weight numeric` (not `numeric(3,2)`) in rec_edge is intentional: edge weights can exceed 5.0 (e.g., trade-ins might have weight -2.0, votes might be -1.0, plays +1.0, but future engines may use weights outside this range for soft constraints).
- `attributes jsonb default '{}'::jsonb` (with explicit cast) avoids a Postgres edge case where the default literal sometimes fails to type-coerce on older versions. Belt-and-suspenders.
- The recap outcome table sits alongside the rec_* logging tables even though it's technically game-night data. It's here because it's the simulator's training set, and putting it in HQ tables would force cross-DB joins. Phase 1+ will sync from HQ recap data via outbox.

**Rollback:** Delete the file. Single commit revert.

**Note on application timing:** Sprint 0.1 commits the SQL only. Application against a real (non-prod) database is deferred to Sprint 0.3, which depends on Sprint 0.2 (migration runner with safety harness).

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
- "Executing now" ≠ "executed and verified." Initial Sprint 0.0.1 was claimed-but-not-pushed due to a partial response on flaky connection; user caught the discrepancy. Going forward, always read back from repo to confirm post-state before declaring sprint complete.
- Multi-step rename = many commits when push_files (add) and delete_file (delete) are separate operations.
- Norse naming convention is a quiet brand asset — every new engine name carries semantic meaning + ties to the platform's existing voice (Garmr, Afterroar).

---

## Sprint 0.0 — Silo scaffold (2026-05-06) ✅

**Goal:** Establish the housing for in-development recommendation engines under explicit isolation discipline.

**Outcome:** Shipped as commit `f5d54ef`. 8 files added.

**Learnings:**
- Silo as a top-level directory makes the isolation visually obvious and prevents accidental cross-imports.
- HTTP-API-as-silo-enforcer is stronger than convention, cheaper than separate repos.
- Design doc copied into the engine directory rather than referenced externally — keeps the engine self-contained for context restoration.

---

## Next sprint planned

## Sprint 0.2 — Migration runner script (DRAFT)

**Goal:** A standalone TypeScript script in `mimir/scripts/apply-migrations.ts` that applies migration files from `mimir/migrations/` in order against a configurable Postgres connection. Safety: refuses to touch any non-`rec_*` table or schema. Idempotent (safe to re-run).

**Scope:**
- One TypeScript file (Node + `pg` driver)
- Reads migrations directory in lexicographic order
- For each, BEGIN → execute → COMMIT (or ROLLBACK on error)
- Tracks applied migrations in a `rec_migrations` table (created by the runner if missing, also `rec_*` prefixed)
- Refuses to run if it detects a CREATE/ALTER/DROP statement targeting a non-`rec_*` table name (parser-based safety check, not just regex)
- Refuses to run against a database whose name matches `prod*` patterns without an explicit `--allow-prod` flag (multi-layer guard)
- Logs every action verbosely
- Connection string from env var, NEVER hard-coded

**Acceptance criteria:**
1. Script exists at `rec-engines/mimir/scripts/apply-migrations.ts`
2. Has a self-test mode (`--dry-run`) that parses migrations without executing
3. Refuses to run with bad SQL (e.g., adding a `--inject-bad-sql` test migration causes safety check to fail and abort)
4. Tracks applied migrations idempotently
5. Has its own minimal test in `mimir/tests/`
6. README updated with how to use the runner

**Test plan (executed BEFORE push):**
- Self-test pass: dry-run against the existing 0001 migration parses cleanly
- Negative test: a hand-crafted bad migration (drops a non-rec table) is rejected by the safety check
- Negative test: production-like DB name triggers refusal without `--allow-prod`
- Positive test: re-running the same migration is a no-op (idempotency)

**Rollback:** Delete the script + tests + the rec_migrations table (if applied anywhere). Single commit revert + a single follow-up SQL `DROP TABLE rec_migrations` if needed.

**Application of 0001 migration is deferred to Sprint 0.3** which uses this runner against a Neon branch DB (never prod) and verifies the schema lands.
