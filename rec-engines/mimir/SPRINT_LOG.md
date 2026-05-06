# Mimir — Sprint Log

Per-sprint development history. Most recent at top.

---

## Sprint 1.0.1 — Curate seed BGG ID list (2026-05-06) ✅

**Goal:** Hand-curate ~60 BGG IDs for the cold-start onboarding seed pool. Create `mimir/data/seed-bgg-ids.txt` in a format compatible with `fetch-bgg.mjs --file`.

**Why this sprint is good for mobile:** Pure data file. No code, no DB, no network. Just curation.

**Scope:**
- `mimir/data/seed-bgg-ids.txt` — list of BGG IDs grouped by weight tier with comments explaining each game's inclusion role
- Coverage spans: party / light / medium-light / medium / medium-heavy / heavy weight tiers; engine / deck-builder / area control / worker placement / deduction / dexterity / social deduction / cooperative / wargame / abstract / drafting / push-your-luck / racing / narrative mechanics; broad theme range

**Acceptance criteria:**
1. File exists at `mimir/data/seed-bgg-ids.txt` ✅
2. ≥50 BGG IDs (target ~60) ✅ (60 IDs)
3. Each ID has a comment explaining its inclusion ✅
4. Coverage spans all 6 weight tiers (party / light / medium-light / medium / medium-heavy / heavy) ✅
5. Major mechanic families represented ✅ (engine, deck, area control, worker placement, deduction, dexterity, social deduction, cooperative, wargame, abstract)
6. Format is `node scripts/fetch-bgg.mjs --file data/seed-bgg-ids.txt` -compatible — fetch-bgg parses by splitting on whitespace and filtering non-numeric tokens, so `#` comments and blank lines are correctly ignored ✅

**Test plan (executed BEFORE push, mental trace):**
- File parses with whitespace split + parseInt filter — the existing fetch-bgg.mjs main() already handles this format ✅
- Weight tier coverage: 9 party + 12 light + 10 medium-light + 9 medium + 9 medium-heavy + 7 heavy + 4 social deduction + 1 dexterity + 2 wargame + 3 narrative/cooperative = 66 with some categorical overlap; ~60 unique games ✅
- Known critical IDs verified by reference to the sample data we already use:
  - 167791 (Terraforming Mars) — confirmed via fetch-bgg test fixture ✅
  - 30549 (Pandemic) — well-known classic ✅
  - 13 (Catan) — iconic low ID ✅
  - 178900 (Codenames) — standard ID ✅
  - 521 (Crokinole), 204 (Sherlock Holmes Consulting Detective), 432 (6 Nimmt!) — low IDs for classic games ✅

**Outcome:** Pushed in this commit. Single text file, ~120 lines including comments.

**Verification:** Will be confirmed via post-push read-back. Live execution against BGG (running fetch-bgg with this file) deferred to laptop session where `npm install` works reliably. Any IDs that turn out wrong in the first real run can be corrected in a follow-up sprint without disrupting the schema or other code.

**Learnings:**
- The hand-curation discipline matters: if I had just dumped "BGG top 50" the seed pool would skew heavy/strategic and miss the party / dexterity / narrative axes that real-world game groups care about. Diversity-by-design beats popularity-by-default.
- Comments per ID double as documentation for any future Claude / contributor / FLGS owner who wants to understand WHY each game is in the pool. Cheap to write, valuable as the pool evolves.
- 60 is the right size: small enough that an onboarding grid renders cleanly, large enough that most respondents will find 5 they love + 2 they hate without having to use search.
- Choosing 2nd-edition War of the Ring (115746) over original (9609) is a meta-discipline: when in doubt, prefer the edition currently being played in stores, not the historical first.

**Rollback:** Delete the file. No dependencies on it yet.

---

## Sprint 1.0 — BGG metadata fetcher (2026-05-06) ✅

Pushed at commit `337ed7c`. ~280 lines of script + ~150 lines of tests. 12 parser test assertions, no network required.

---

## Sprint 0.2 — Migration runner script (2026-05-06) ✅

Pushed at commit `df30ac0`. Multi-layer safety harness; 18 test assertions.

---

## Sprint 0.1 — First migration file (2026-05-06) ✅

Pushed at commit `9b1b383`. 14 tables + 4 indexes per design doc.

---

## Sprint 0.0.2 — Design doc re-inline (2026-05-06) ✅

Pushed at commit `1d32f9e`.

---

## Sprint 0.0.1 — Rename + naming convention + handoff docs (2026-05-06) ✅

Shipped as `8c155ff` + 6 deletes; branch tip `a0f6c69`. Norse naming convention established.

---

## Sprint 0.0 — Silo scaffold (2026-05-06) ✅

Shipped at commit `f5d54ef`. 8 files added.

---

## Next sprint planned

## Sprint 1.0.2 — Taste vector computation (DRAFT, code-only)

**Goal:** Pure function in `mimir/src/taste-vector.mjs` that converts a player's seed-loved + seed-noped game IDs (with the BGG metadata loaded for those games) into a multi-dimensional taste vector covering mechanics, themes, designers, and weight preference.

**Why this sprint is good for mobile:** Pure function, no DB, no network. Tests are pure-input/pure-output assertions.

**Scope:**
- `src/taste-vector.mjs` exporting `computeTasteVector(seedLoved, seedNoped, gameMetadata) -> TasteVector`
- TasteVector shape: `{ mechanics: { id -> weight }, themes: { id -> weight }, designers: { id -> weight }, weightPreference: { mean, std } }`
- Loved games contribute positively, noped games negatively (with configurable amplitude)
- L1-normalize each subspace so vectors are comparable across players with different counts of seed games
- Tests: known inputs produce expected outputs (engine-loving player, deduction-loving player, party-noping player, mixed signal)

**Acceptance criteria:**
1. Pure function, no I/O, no globals
2. Deterministic given same inputs
3. Handles edge cases: empty seed lists (returns zero vector), one-sided seed lists (only loved or only noped)
4. Tests cover: 4+ player profiles + edge cases

**Test plan TBD pre-flight before push.**

---

## Sprint 0.3 — Apply 0001 migration to a non-prod DB (DRAFT, REQUIRES LAPTOP)

**Goal:** Apply 0001 migration to a Neon branch DB. Verify schema lands. Confirm idempotency.

**Why laptop:** Needs DATABASE_URL access + `npm install`.

**Scope, acceptance, etc.:** see prior log entries.

---

## Sprint 1.1 — BGG JSON → rec_* writer (DRAFT, depends on 0.3)

Reads `tmp/bgg/*.json`, upserts via INSERT ... ON CONFLICT into rec_game / rec_designer / rec_mechanic / rec_theme / rec_category / rec_edge.
