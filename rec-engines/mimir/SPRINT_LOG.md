# Mimir — Sprint Log

Per-sprint development history. Most recent at top.

---

## Sprint 1.0.15 — Schema extension for dimension framework (4 new node types) (2026-05-06) ✅

**Why:** Manus AI delivered a 24-page research synthesis on tabletop recommendation graph dimensions — well-grounded, well-cited, largely complementary to our work. Surfaces four real gaps in our current schema: Personality Profile, Emotion, Cognitive Profile, and Context Type as first-class node types.

Additionally, Manus is in parallel developing a "this vs that" player questionnaire that will produce edges into these node types. **Sprint 1.0.15 is the prerequisite schema for absorbing the questionnaire output.** Without it, the questionnaire has nowhere to write player profile data.

**Goal:** Add four new node tables via migration `0002_extend_rec_tables.sql`. Pure additive schema. No existing tables changed. No existing behavior changed. Forward-compatible with Manus’s questionnaire output.

**Why this sprint is good for mobile:** Schema-only. No code changes. Verifiable end-to-end via local Postgres.

**Scope:**
- `mimir/migrations/0002_extend_rec_tables.sql` — 4 CREATE TABLE statements:
  - `rec_personality_profile` (Bartle, OCEAN, SDT, Yee — archetype/trait nodes)
  - `rec_emotion` (MDA aesthetics + emotional palette)
  - `rec_cognitive_profile` (working memory, attention, processing speed, spatial, verbal, social cognition)
  - `rec_context_type` (party-night, family-night, hobby-group, couples, etc.)
- `mimir/tests/apply-migrations.test.mjs` — 4 new integration tests: 0002 parses cleanly, has 4 CREATE statements, has zero destructive ops, listMigrationFiles finds both 0001 and 0002 in lex order
- `mimir/docs/dimension-framework-integration.md` — substantive doc explaining how Manus’s framework integrates with our schema, what each new node type is for, what each future engine (mimir, huginn, muninn, saga, norns) gains, what we explicitly DON’T absorb (biometric, longitudinal cognitive load, inferred moral state)

**Acceptance criteria:**
1. Migration 0002 exists and is additive only — no DROP/ALTER/DELETE/TRUNCATE/INSERT ✅
2. All 4 CREATE statements use IF NOT EXISTS for idempotency ✅
3. New tables follow `rec_*` namespace per SILO.md § 3 ✅
4. Test suite includes integration tests for 0002 ✅ (168/168 pass post-add)
5. **Empirical validation:** migration applied to local sandbox Postgres 16; all 4 tables created; rec_migrations records both 0001 and 0002 ✅
6. Re-running migrate after 0002 applied is a no-op (skipping both) ✅ (verified)
7. Integration doc explains the framework absorption + questionnaire roadmap ✅

**Test plan (executed BEFORE push):**
- Local sandbox clone, npm install
- Add migration + tests + integration doc
- `npm test` → expect 164 → 168 (4 new tests). Result: 168/168 pass ✅
- `npm run migrate:dry-run` → both migrations pass safety check ✅
- `npm run migrate` → 0001 skipped (already applied), 0002 applied successfully ✅
- SQL verification:
  - `select count(*) from information_schema.tables where table_name like 'rec_%'` → 19 (15 from before + 4 new) ✅
  - 4 new tables exist by name ✅
  - rec_migrations contains both 0001 and 0002 rows ✅

**Outcome:** Pushed in this commit. ~110-line migration + ~80 lines of new tests + ~200-line integration doc.

**Verification:** Will be confirmed via post-push fresh-clone + npm test (expect 168/168 pass).

**Learnings:**
- The schema as designed in Sprint 0.1 anticipated this case correctly. `rec_edge` doesn’t need any changes — it accepts `(src_type, dst_type, edge_type)` of any combination, so new node types just slot into existing edge mechanics. The early architectural choice to make edges first-class records (not foreign-key tangles) paid off here.
- Adding 4 nearly-identical node tables is a sign that perhaps a more abstract design (single "taxonomy" table with discriminator) could replace them. But: each table has slightly different shape (rec_context_type has min/max player count + duration; rec_emotion has category; rec_personality_profile has framework + archetype). The cost of premature abstraction here exceeds the cost of the four small tables. We can refactor later if the asymmetry causes friction.
- Schema migrations are the cheapest possible Phase 0 forward-compatibility move. We bought significant capability (saga acceleration, questionnaire integration, huginn cold-start solution, norns gene-graph seeding) for one ~110-line SQL migration.
- The integration doc is more important than the migration. Future contributors (and future Claude instances) need to understand WHY the four tables exist and what they unlock. ~200 lines of careful documentation makes the schema decision self-justifying.
- **Mimir engine list goes from 19 to 19 — wait, that’s 15 + 4 = 19.** Yes, the schema now has 19 rec_* tables. Schema is forward-compatible with the breakthrough engine roadmap.

**Rollback:** Revert this commit. The migration is additive; reverting drops the 4 new tables but leaves nothing else affected. If the migration was already applied to a real DB, manually `DROP TABLE rec_personality_profile, rec_emotion, rec_cognitive_profile, rec_context_type;` and remove the row from `rec_migrations`. Both restorations are clean.

---

## Sprint 1.0.14 — Saga scaffold (DEFERRED — see notes)

Deferred until after the dimension framework integration. The reason: saga’s design-notes draft would have been written without knowledge of Manus’s research; rewriting after the fact wastes effort. With Sprint 1.0.15 done, saga’s scaffold can incorporate the new node types from day one.

---

## Sprint 1.0.13 — Recap data spec for HQ recap UI v1 (2026-05-06) ✅

Pushed at commit `610eb35`. Formal contract for HQ recap UI v1 — the structured fields HQ must capture so saga has training data when it activates.

---

## Sprint 1.0.12 — Scaffold huginn (second engine, validates silo pattern) (2026-05-06) ✅

Pushed at commit `524e774`.

---

## Sprint 1.0.11 — exclude_seeds option (UX fix from smoke test) (2026-05-06) ✅

`790426c`.

---

## Sprint 1.0.10 — Sandbox e2e validation + fixtures + integration tests (2026-05-06) ✅

`45b584a`.

---

## Sprint 1.0.9 — HOTFIX: explain.mjs + npm test glob (2026-05-06) ✅

`7b3e85e`.

---

## Sprint 1.0.8 — Logging helpers (2026-05-06) ✅ (`dacc20b`)
## Sprint 1.0.7 — HANDOFF.md update (2026-05-06) ✅ (`5690d21`)
## Sprint 1.0.6 — recommend() composer + offline driver (2026-05-06) ✅ (`f6e60db`)
## Sprint 1.0.5 — Explanation generator (2026-05-06) ✅ (`0bd5d31`)
## Sprint 1.0.4 — MMR + designer cap (2026-05-06) ✅ (`7cde547`)
## Sprint 1.0.3 — v0 Scoring function (2026-05-06) ✅ (`089af2f`)
## Sprint 1.0.2 — Taste vector computation (2026-05-06) ✅ (`3bac627`)
## Sprint 1.0.1 — Curate seed BGG ID list (2026-05-06) ✅ (`61cab65`)
## Sprint 1.0 — BGG metadata fetcher (2026-05-06) ✅ (`337ed7c`)
## Sprint 0.2 — Migration runner script (2026-05-06) ✅ (`df30ac0`)
## Sprint 0.1 — First migration file (2026-05-06) ✅ (`9b1b383`)
## Sprint 0.0.2 — Design doc re-inline (2026-05-06) ✅ (`1d32f9e`)
## Sprint 0.0.1 — Rename + Norse convention + handoff docs (2026-05-06) ✅ (`8c155ff` + 6 deletes)
## Sprint 0.0 — Silo scaffold (2026-05-06) ✅ (`f5d54ef`)

---

## Next sprint planned

## Sprint 1.0.16 — Saga scaffold (incorporating dimension framework) (DRAFT)

Now that 1.0.15 has landed the new node types, saga’s scaffold can incorporate them from day one. Will mirror huginn (Sprint 1.0.12) but with substantively richer design notes given saga is the breakthrough engine.

## Sprint 0.3 — Apply 0001 + 0002 migrations to user’s Neon branch (REQUIRES LAPTOP)

Note: 0002 added in this sprint. When applying to real Neon, both 0001 and 0002 will run cleanly. Sandbox-validated.

## Sprint 1.1 — BGG JSON → rec_* writer (DRAFT, depends on 0.3)

## Sprint 1.2 — HTTP API surface for recommend() (Phase 1, depends on 0.3 + 1.1)

## Sprint 1.3 — Seed taxonomies for personality/emotion/cognitive/context (DRAFT)

When Manus’s questionnaire output stabilizes, write a seed migration that populates the four new node tables with the canonical taxonomy entries (Bartle’s 4, OCEAN’s 5, MDA’s 8, Manus’s 6 cognitive dimensions, ~10 named contexts). Pure data migration; no schema changes.
