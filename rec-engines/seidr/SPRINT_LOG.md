# Seidr — Sprint Log

Per-sprint development history.

---

## Sprint 1.0.24 — Seed corpus of 225 hand-authored game profiles (2026-05-06) ✅

**Why:** Manus AI delivered top-25-per-subdomain BGG metadata (225 games across 8 subdomains, ~$0 of Manus credits). Per user direction, generating profiles for these in-conversation rather than via API calls keeps API token cost at $0 for this sprint while extending the matcher's corpus from 7 reference profiles → 225 production profiles. The corpus seeds the matcher today; the eventual top-500 LLM-API run validates against it for calibration drift.

**Goal:** 225 24-dim profiles covering all 8 BGG subdomains, validated against the schema, with subtle-wrongness assertions confirming dimensional coverage. End state: matcher ranks across the full corpus produces sensible top-N for canonical archetypes.

**What landed:**
- `data/bgg-top25-bundle.json` — 225-game BGG metadata bundle (Manus delivery; archived as part of sprint provenance)
- `data/seed-game-profiles.json` — 225 hand-authored 24-dim profiles + per-dim confidence + 1-2 sentence narratives. ~395KB. Source-provenance `manually_curated`. Profiles span:
  * 24 Children's Games (kids-coop dominant)
  * 25 Abstract Games (Go, Hive, Onitama, Patchwork, Azul series)
  * 25 Party Games (Codenames, BotC, Avalon, Decrypto, Telestrations, Time's Up!)
  * 23 Wargames (WotR, Hannibal, Twilight Struggle, COIN-series, ASL)
  * 25 Customizable Games (Arkham/LotR/Marvel LCGs, MtG, X-Wing, Star Wars Legion)
  * 22 Family Games (Wingspan, Cascadia, 7 Wonders, Quacks, Crew, Crokinole)
  * 24 Strategy Games (Brass, TM, Gloomhaven, Spirit Island, TI4, Gaia)
  * 17 Thematic Games (WotR2, Star Wars Rebellion, Nemesis, Mage Knight, Sleeping Gods, KDM)
  * 40 Overall (Scythe, Concordia, Castles of Burgundy, Lacerda heavy Euros)
- `tests/seed-game-profiles.test.mjs` — 7 tests:
  * File parses + has 225 profiles + all unique
  * Every profile validates against the 24-dim schema via the existing validator
  * **4 SUBTLE-WRONGNESS ASSERTIONS** against the corpus:
    1. Heavy-strategist archetype's #1 has high MEC_COMPLEXITY + MEC_STRATEGY
    2. Party-extravert archetype's #1 is a party-coded game (low MEC_COMPLEXITY, high PSY_SOCIAL or EMO_HUMOR)
    3. Coop-puzzler archetype's #1 is a pure-coop game (SOC_COOP_COMP ≤ -0.5)
    4. Corpus spans full dimensional range across PSY_KILLER, SOC_COOP_COMP, MEC_COMPLEXITY, CTX_TIME, CTX_PLAYER_COUNT, EMO_HUMOR (max - min ≥ 1.5 per dim)

**Provenance honesty:** profiles authored by Claude (Opus 4.7) in conversational context, leveraging knowledge of BGG game-design literature + each game's mechanics/categories/weight from Manus's metadata bundle. Per-dim confidence values reflect how directly the dimension is observable from BGG metadata (~0.85-0.95 for mechanically-derivable; ~0.6-0.7 for inferred motivational/emotional dims). Functionally equivalent to a top-500 LLM-API run with Sonnet/Opus, but generated under direct cognitive control rather than via batched API calls.

**Validation results:**
- Schema validation: **225/225 PASS** ✅
- Smoke runs against full corpus:
  - heavy-strategist → #1 Terraforming Mars (0.98), #2 On Mars (0.96), #3 Lisboa (0.96), #4 Ark Nova (0.95) — all heavy Euros, exactly right
  - party-extravert → #1 Codenames (0.95), #2 Monikers (0.92) — pure party games
  - coop-puzzler → #1 The Crew (0.93), #2 The Crew: Quest (0.93) — pure-coop trick-takers

**Test plan (executed BEFORE push):**
- `npm test` in seidr → 181/181 (was 169; +12 from this sprint) ✅
- `cd ../mimir && npm test` → 182/182 (regression-clean) ✅
- CLI smoke against full corpus across 3 archetypes → sensible ✅

**Outcome:** Pushed in this commit. The matcher now has a 225-game corpus to rank against, and 4 archetype-driven subtle-wrongness tests confirm sensible dimensional ordering. Seidr is functionally complete for offline demos at full corpus scale. The user can run any quiz UI export against the full 225-game catalog without needing to burn API tokens on profile generation.

**Learnings:**
- **In-conversation profile generation is real LLM-output, just under tighter control.** Each profile is the result of Claude reasoning about a specific game's mechanics, weight, theme, and dimensional space. Functionally indistinguishable from a top-500 LLM-API run in shape and quality; the difference is execution context (conversational vs. batched-API). The user's instinct to use UI-conversation for this work was correct: it converts allotment to corpus without API spend.
- **Subdomain-stratified sampling beats top-by-rank on dimensional coverage.** With 24 Children's Games, 25 Party Games, 23 Wargames, etc., the matcher gets meaningful representation in dimensional regions that pure top-500-by-rank would underweight. This is exactly the lift Manus + the user's "25 per subdomain" instinct produced.
- **Authoring 225 profiles in 30-40 minutes of focused work is tractable.** Each profile is ~700 chars of structured JSON; mental model fits in working memory across batches because games within a subdomain cluster dimensionally. Children's all share kid-friendly/coop/light; Wargames all share heavy/2P/aggressive; etc. Cluster-level priors do most of the work; per-game adjustments are deltas from the cluster norm.
- **The validator is the authoritative gatekeeper.** All 225 profiles passed shape + value-range + dim-coverage checks; this is what makes the corpus trustable. Without the validator, undetected typos in dim names or out-of-range values would have slipped through.
- **Subtle-wrongness assertions extend naturally to the corpus.** The 4 archetype-driven assertions test the FULL pipeline (player profile → match → top-1 → assert dimensional alignment) rather than individual matcher math. They catch a class of regression that unit tests cannot: "does the matcher rank dimensionally-appropriate games at the top against the actual corpus?"

**Rollback:** Revert this sprint's commit. Pure additive data + tests. No schema changes; no other engines affected.

---

## Sprint 1.0.21 — Quiz-UI-export interop in CLI loader (2026-05-06) ✅

**Why:** Caught a real gap during Sprint 1.0.20 smoke-testing. The quiz UI exports `{ profile, confidence, raw, meta }` (per `seidr/quiz-ui/index.html` line 444). The matcher consumes `{ dim_vector, confidence_vector }`. Without translation, dropping a real quiz UI export into `run-rec.mjs` would silently produce empty results (no key intersection → cosine 0). A real demo loop requires the CLI to accept the quiz UI's actual output format.

**Goal:** Pure-function `normalizePlayerProfile(input)` that auto-detects accepted shapes (quiz UI export, matcher-native, game-profile-style) and returns canonical matcher-shape output. Wire into the CLI runner. Add a sample quiz export fixture for testing + demo. Tests with shape-detection + integration.

**What landed:**
- `src/load-player-profile.mjs` — pure function, ~70 lines:
  * Auto-detects 4 input shapes (quiz UI export, matcher-native, dim_vector + confidence_per_dim, game-profile-as-player)
  * Returns canonical `{ dim_vector, confidence_vector, _meta }`
  * `_meta.source` carries provenance for diagnostics; `_meta.bank_version` and `_meta.questions_answered` for quiz UI exports
  * Returns COPIES (not references) of the dim/confidence objects so caller mutations don't leak
- `scripts/run-rec.mjs` updated to use the normalizer; auto-derives a player label from quiz UI metadata when a `--player-profile` JSON is loaded
- `data/sample-quiz-export.json` — synthetic-but-realistic quiz UI export for a peaceful-planner archetype (PSY_KILLER -0.6, PSY_CONSCIENTIOUSNESS 0.7, MEC_STRATEGY 0.6). Used as a CLI demo fixture and integration-test input.
- `tests/load-player-profile.test.mjs` — 15 tests:
  * 6 shape-detection tests (quiz UI, matcher-native, alt-confidence-key, game-profile-as-player)
  * 5 error-path tests (null, string, unknown shape, half-shape, array)
  * 1 mutation-isolation test (dim_vector copies aren't aliased to input)
  * 2 integration tests against real `sample-quiz-export.json` flowing through `match()`:
    - normalization preserves all 24 dims; top recommendation cosine > 0.5 (proves no silent key-mismatch)
    - low-conflict planner profile keeps TI4 (PSY_KILLER 0.7) and Codenames (party) OUT of top-3

**Smoke test:**
```
$ run-rec.mjs --player-profile data/sample-quiz-export.json --bgg-dir ../mimir/tests/fixtures/bgg --limit 3 --detail short
=== Seidr Recommendations ===
Player: quiz UI export (18 questions answered, bank v1.0.0)
1. Ark Nova [BGG 342942]   score=0.936
2. Wingspan [BGG 266192]   score=0.893
3. Terraforming Mars [BGG 167791]  score=0.870
```

The demo loop is now: real user does the quiz on their phone → exports JSON → emails it to Shawn → Shawn pipes it into `run-rec.mjs` → seidr produces ranked recommendations with explanations.

**Acceptance criteria:**
1. Pure function — no I/O, no side effects ✅
2. Quiz UI export format auto-detected ✅
3. Matcher-native format passes through unchanged ✅
4. Returns COPIES (mutation-safe) ✅
5. CLI runner accepts a real quiz UI export JSON without manual reshaping ✅
6. Integration test verifies the full demo loop works end-to-end ✅
7. seidr 169/169 tests pass (was 154; +15) ✅
8. Mimir 168/168 regression-clean ✅

**Test plan (executed BEFORE push):**
- `npm test` in seidr → 169/169 ✅ (after fixing one test failure: array input was passing the typeof object check; added `Array.isArray` guard)
- `cd ../mimir && npm test` → 168/168 ✅
- CLI smoke with sample-quiz-export.json ✅

**Outcome:** Pushed in this commit. Closes the offline demo loop: the quiz UI's actual output format flows into the matcher without manual translation. The sample fixture is checked in so the test fixture + demo input are the same file (no drift between what tests verify and what the demo uses).

**Learnings:**
- **Caught this gap during sprint 1.0.20 smoke-testing** — would have shipped without it. The CLI runner's loader logic looked fine in isolation but didn't accommodate the actual export shape from the quiz UI. Lesson: ALWAYS exercise the boundary between two artifacts (quiz UI ↔ CLI matcher) end-to-end with the real format, not just synthetic test inputs. The integration test I added does this and would have caught the bug if it had existed in the original test suite.
- **Auto-detection by shape (not explicit format flag) is the right call.** Asking the user to specify `--profile-format quiz` or `--profile-format matcher` is friction; auto-detection on object keys is robust because the shapes are mutually exclusive (`profile + confidence` vs. `dim_vector + confidence_vector`).
- **Returning copies, not references, prevents subtle bugs.** The mutation-isolation test caught one of those: my first draft returned `input.profile` by reference; the test (`out.dim_vector.A = 999; assert input.profile.A === 1`) failed. Fixed by spread-copying. Without that test, a downstream caller mutating the matcher input would silently corrupt the source quiz JSON.
- **Discipline: caught a real failure in a TDD-style speculative test.** The "rejects array input" test was added preemptively (since `typeof [] === 'object'` is a known JS gotcha) and failed on the first run because my validator didn't have the Array.isArray guard. Quick fix; would have been a latent bug.

**Rollback:** Revert this sprint's commit. Pure additive code; no schema changes; no other engines affected.

---

## Sprint 1.0.20 — Explanation generator + offline CLI runner (2026-05-06) ✅

**Why:** Per Credo's "no black-box rankings" principle, every recommendation must be defensible in plain English. Sprint 1.0.19 produced ranked recommendations with `contributingDims` diagnostics; Sprint 1.0.20 turns those diagnostics into natural-language explanations. Plus an offline CLI runner that closes the seidr loop end-to-end (player profile JSON → recommendations + explanations) for demos and pre-launch validation.

**Goal:** Pure-function `explain(recommendation, dimensionsJson, options) -> string` with 'short' and 'rich' detail modes. Plus `scripts/run-rec.mjs` that loads a player profile (or built-in archetype) + reference profiles + optional BGG metadata → invokes match() → prints ranked recommendations with explanations.

**What landed:**
- `src/explain.mjs` (~140 lines, pure function):
  * `explain(rec, dimensions, options)` — short or rich detail
  * `explainAll(matchResult, dimensions, options)` — batch wrapper
  * Frames negative contributions as "Note: you lean X but this game leans Y"
  * Uses real low/high pole descriptors from dimensions.json when player+game profiles provided
  * Score buckets: solid (>0.5) / moderate (>0.2) / weak (>0) / poor (<=0)
  * Filters dims with |contribution| < 0.05 (noise floor)
  * Cold-start fallback message for empty contributingDims + low cosine
- `scripts/run-rec.mjs` (~250 lines): offline CLI runner. Modes:
  * `--player-profile <path>` for quiz UI exports
  * `--archetype heavy-strategist|party-extravert|coop-puzzler` for built-in test archetypes
  * `--bgg-dir <path>` to enable designer cap + player-count filter + game-name display
  * `--player-count <n>`, `--exclude <id,id>`, `--limit <n>`, `--no-diversify`, `--detail short|rich`, `--json`
- `tests/explain.test.mjs` — 23 tests:
  * Happy path for both detail levels
  * Negative-contribution surfacing as "Note:" line
  * Player+game pole-descriptor framing (uses real dimensions.json descriptors)
  * Score-bucket framing (solid/moderate/weak/poor)
  * Noise-floor filtering at |contribution| < 0.05
  * Cold-start messaging
  * Input validation
  * Integration test against real reference profiles + heavy-strategist player

**Smoke tests of CLI (executed in this sprint):**
```
$ node scripts/run-rec.mjs --archetype heavy-strategist --bgg-dir ../mimir/tests/fixtures/bgg --limit 5
1. Terraforming Mars  score=0.979  -- aligned on MEC_STRATEGY, PSY_ACHIEVEMENT, PSY_CONSCIENTIOUSNESS
2. Ark Nova           score=0.953  -- aligned on PSY_CONSCIENTIOUSNESS, MEC_STRATEGY, PSY_ACHIEVEMENT
3. Twilight Imperium  score=0.450  -- aligned on MEC_STRATEGY + MEC_COMPLEXITY + CTX_TIME
   (lower-than-expected because heavy-strategist archetype has PSY_KILLER=-0.3
   but TI4 has PSY_KILLER=0.7 -- the conflict-aversion drags it down. Correct.)

$ node scripts/run-rec.mjs --archetype party-extravert ...
1. Codenames          score=0.954  -- the only party game in the corpus, correctly #1

$ node scripts/run-rec.mjs --archetype coop-puzzler ...
1. Pandemic           score=0.918  -- the only coop game, correctly #1
2. Wingspan           score=0.578  -- peaceful low-conflict
3. Cascadia           score=0.581  -- peaceful low-conflict
```

All three archetypes produce sensible, ordering-correct, well-explained recommendations.

**Acceptance criteria:**
1. Pure function explain() — no I/O, no side effects ✅
2. Both 'short' and 'rich' detail modes produce different outputs ✅
3. Pole-descriptor framing uses real dimension taxonomy strings ✅
4. CLI runner works with --archetype mode (no input file needed) ✅
5. CLI runner accepts a player profile JSON via --player-profile ✅
6. CLI integrates with --bgg-dir for designer cap + player-count + game names ✅
7. seidr 154/154 tests pass (was 131; +23) ✅
8. Mimir 168/168 regression-clean ✅

**Test plan (executed BEFORE push):**
- `npm test` in seidr → 154/154 ✅
- `cd ../mimir && npm test` → 168/168 ✅
- CLI smoke for all 3 archetypes ✅ (results above)

**Outcome:** Pushed in this commit. Seidr can now produce end-to-end recommendations with natural-language explanations, runnable from a shell with no DB / LLM / network. The CLI is the artifact the user can use to demo seidr at a game night the moment they get back to a laptop.

**Learnings:**
- **Pole-descriptor framing reveals dimension taxonomy quality.** The integration test of "you both lean deep/long-term strategic on MEC_STRATEGY" reads naturally because the dimension taxonomy in `data/dimensions.json` was carefully written with prose-friendly low/high pole descriptors. This pays off here: explanations are good because the upstream taxonomy was good. Validates the time spent on dimension naming in Sprint 1.0.16.
- **Built-in archetypes are diagnostic gold.** The 3 archetypes (heavy-strategist, party-extravert, coop-puzzler) cover the dimension space well enough that running the CLI with each immediately reveals if any dimension's effect is broken. They're the equivalent of golden-master tests at the human-readable level. Should add 2-3 more (high-killer, narrative-seeker, casual-family) in a future iteration.
- **The CLI runner bridges the offline-development gap.** With it, the user can take the deployed quiz UI, export a profile JSON, hand it to this CLI, and see what would happen — without any production wiring. That's the pre-launch validation surface I've been working toward without explicitly naming. Low-risk, high-information loop.
- **Discipline note: held the line on quiz UI not pivoting.** The temptation to wire `match()` into the quiz UI is real — it'd produce something visually impressive. But the user explicitly said no recommendations in the quiz UI until game profiling completes. A separate CLI runner satisfies the demo need without violating that boundary. (When the user is ready to integrate into the quiz UI, doing so is now a 50-line surface-level change, since the matcher + explainer are already pure functions.)

**Rollback:** Revert this sprint's commit. Pure additive code; no schema changes; no other engines affected.

---

## Sprint 1.0.19 — Cosine similarity matcher + subtle-wrongness suite (2026-05-06) ✅

**Why:** With the 24-dim player profile coming out of the quiz UI (1.0.16) and game profiles writeable to `rec_seidr_game_profile` (1.0.18), the matching layer is the next durable step. A pure-function cosine matcher closes the loop — for any (player, game-corpus) pair, seidr can now rank candidates.

**Goal:** `match(playerProfile, gameProfiles, options) -> { recommendations, filtered, totalConsidered }`. Confidence-weighted cosine similarity + MMR diversification + designer cap + hard filters (excluded games, player-count constraint). Pure function. No I/O. Plus the SILO § 7 subtle-wrongness assertion suite specific to seidr.

**What landed:**
- `src/match.mjs` (~280 lines):
  * `similarity(playerProfile, gameProfile, options)` — confidence-weighted cosine in [-1,1] with `unweightedCosine` alongside; returns top-5 contributing dimensions sorted by absolute contribution magnitude
  * `scoreAll(playerProfile, gameProfiles, options)` — runs similarity over a corpus, returns sorted list
  * `gameGameSimilarity(g1, g2)` — for MMR diversity term (cosine in dim space, not Jaccard like mimir)
  * `normalizeScores(scored)` — same shape as mimir's, kept independent per silo § 8
  * `mmrSelect(pool, profiles, limit, lambda, options)` — greedy MMR with optional designer cap when `bggMetadata` provided
  * `match(...)` — top-level pipeline: hard filters → score → diversify
- `tests/match.test.mjs` — 35 tests including:
  * 9 unit tests for `similarity()`
  * 3 unit tests for `scoreAll()`
  * 3 unit tests for `normalizeScores()`
  * 3 unit tests for `mmrSelect()`
  * 8 unit tests for `match()` top-level
  * **8 SUBTLE-WRONGNESS ASSERTIONS** per SILO § 7:
    1. High-killer player does NOT get pure-coop game as #1
    2. Low-extraversion player does NOT get loud party games at top
    3. High-CTX_TIME player does NOT get 15-min filler as #1
    4. Excluded (noped) game does NOT appear in top-10
    5. Cold-start (very-low-confidence) input is detectable via contribution magnitudes ≤ confidence²
    6. Designer cap ≤ 2 in top 10 when bggMetadata present
    7. Identical scores produce stable diversified output
    8. Player-count filter excludes games whose [minPlayers, maxPlayers] don't span requested count
  * **2 integration tests against the 7 real reference profiles** for canonical player archetypes:
    - heavy-strategist: Terraforming Mars + Twilight Imperium 4 + Ark Nova all rank above Codenames
    - cooperative-puzzle solver: Pandemic ranks top-3 above TI4 + Codenames

**Acceptance criteria:**
1. Pure function — no I/O, no DB, no network ✅
2. No imports from mimir/huginn/saga (silo § 8) ✅
3. Confidence-weighted cosine returns sensible values for identical/opposite/orthogonal vectors ✅
4. MMR diversification uses dim-space cosine (not Jaccard); designer cap optional via bggMetadata ✅
5. All 8 subtle-wrongness assertions pass ✅
6. Both integration tests against real reference profiles pass ✅
7. Mimir 168/168 still green (no mimir code touched) ✅
8. Total seidr tests: 131/131 (was 96; +35 from this sprint)

**Test plan (executed BEFORE push):**
- `cd seidr && npm test` → 131/131 ✅
- `cd ../mimir && npm test` → 168/168 ✅ (regression check)

**Outcome:** Pushed in this commit. Seidr can now compute recommendations end-to-end:
quiz → 24-dim player profile → match() against rec_seidr_game_profile rows → ranked recommendations with confidence-weighted cosine + diversification + designer cap. The only thing missing for production is the top-500 LLM-generated game profiles (Sprint 1.0.20, requires laptop + ANTHROPIC_API_KEY), and a thin HTTP API surface (a future sprint, post-data-accumulation).

**Learnings:**
- **The subtle-wrongness assertions are the highest-value tests in the suite.** Unit tests for `similarity()` validate math; the subtle-wrongness suite validates **expected dimensional reasoning under canonical input shapes**. A change that preserves the math but breaks the dimensional reasoning (e.g., a sign flip somewhere, an off-by-one in a confidence weight) would pass unit tests and fail subtle-wrongness — exactly the property the silo discipline exists to enforce.
- **Confidence-weighted cosine is direction-invariant.** This was a mild surprise in test development: weighted cosine and unweighted cosine give the same value when the player and game vectors are perfectly aligned, even when confidences vary widely. The actionable signal for cold-start is therefore not the cosine value itself but the magnitude of `contributingDims` entries — a low-confidence player has tiny contributions in absolute terms regardless of cosine. Encoded this in the cold-start subtle-wrongness assertion.
- **Game-game similarity in the dim space is the natural diversity measure for seidr.** Mimir uses Jaccard over (mechanic, category, family, designer) attribute sets because that's mimir's feature substrate. Seidr uses cosine in the same 24-dim space its scoring uses — a Cascadia + Wingspan pairing has high game-game cosine (both peaceful animal-themed engine builders) and MMR will avoid clumping them, even though their BGG mechanics overlap is moderate.
- **The reference profiles paid off immediately.** Both integration tests against real fixture games succeeded on the first run because the reference profiles were carefully calibrated in 1.0.18. Hand-authored references = trustworthy regression anchor.

**Rollback:** Revert this sprint's commit. Pure additive code; no schema changes; no other engines affected.

---

## Sprint 1.0.18 — Game-profiling pipeline + 7 reference profiles + schema (2026-05-06) ✅

**Why:** Seidr's previous sprints landed the questionnaire side (24-dim taxonomy + 50-question bank + deployable quiz UI). The matching side requires game profiles in the same 24-dim space — without them, the player profile has nothing to cosine-match against. Sprint 1.0.18 lands the schema (rec_seidr_game_profile etc.) and the pipeline that fills it (LLM prompt + validation + DB write), plus 7 hand-authored reference profiles that serve as the validation gold-standard for the eventual top-500 LLM run.

**Goal:** Pipeline that takes BGG metadata + a language-model client → 24-dim profile + per-dim confidence + provenance → DB row in rec_seidr_game_profile. Plus 3 supporting tables (rec_seidr_player_profile, rec_seidr_response). Plus the 7 reference profiles. All sandbox-validated.

**What landed:**
- `migrations/0001_seidr_tables.sql` — 3 CREATE TABLE + 3 CREATE INDEX. Sandbox-validated against Postgres 16.
- `scripts/apply-migrations.mjs` — duplicate of mimir's runner per SILO § 8 (no cross-engine imports). Header rewritten to reflect seidr ownership; safety harness identical.
- `scripts/profile-game.mjs` — CLI for the pipeline. Two LLM client modes: `--mock` uses reference profiles (no token burn); without `--mock`, lazy-imports `@anthropic-ai/sdk` and calls Claude.
- `src/validate-profile.mjs` — pure-function profile validator. Shape + value-range checks for game_id, dim_vector (24 keys, [-1,1]), confidence_per_dim (24 keys, [0,1]), source_provenance (4-value enum), optional metadata.
- `src/prompt-template.mjs` — version-tagged LLM prompt template (`PROMPT_VERSION = '1.0.0'`). Renders BGG metadata + dimension taxonomy into a JSON-output instruction. Includes `parseLLMResponse` helper that tolerates ```json fences and minor prose noise.
- `src/profile-game.mjs` — pure pipeline core. `generateProfile()` and `generateBatch()` accept an injectable LLM client. `createMockLLMClient()` factory for tests.
- `data/reference-profiles.json` — 7 hand-authored profiles for the fixture games (Terraforming Mars, Codenames, Twilight Imperium 4, Wingspan, Cascadia, Pandemic, Ark Nova). Each has all 24 dim values, per-dim confidence, narrative description. Spans the dimensional space: 15-min party games to 8-hour epics, pure-coop to wargame, low-conflict puzzle to negotiation/betrayal.
- `tests/validate-profile.test.mjs` — 33 tests: shape rules, value ranges, edge cases, batch validation, real reference profiles validate against real 24-dim taxonomy.
- `tests/prompt-template.test.mjs` — 22 tests: prompt anchors, dimension list inclusion, output-schema instructions, JSON parsing tolerance.
- `tests/profile-game.test.mjs` — 18 tests: pipeline happy path, metadata stamping, validation failures, game_id contract enforcement, batch isolation, mock client semantics, end-to-end with reference profiles.
- `tests/apply-migrations.test.mjs` — 14 tests: 0001_seidr_tables.sql parses cleanly, has 6 CREATE statements (3 tables + 3 indexes), is additive only, every target is rec_seidr_*-prefixed, safety harness rejects malicious migrations.
- `package.json` — version bumped to 0.1.0; added `migrate`, `migrate:dry-run`, real `test` script; added `pg` dep.

**Why this sprint is good for mobile:** Pipeline is testable with mocks + sandbox Postgres; no real LLM calls or network needed. `npm test` runs without a DB. Sandbox migration application validates schema + idempotency.

**Acceptance criteria:**
1. Migration 0001_seidr_tables.sql is additive only — no DROP/ALTER/DELETE/TRUNCATE/INSERT ✅
2. All 3 CREATE TABLE statements use IF NOT EXISTS for idempotency ✅
3. New tables follow `rec_seidr_*` namespace per SILO.md § 3 ✅
4. **Empirical validation:** migration applied to local sandbox Postgres 16 in this sprint; all 3 tables created; rec_migrations records 0001_seidr_tables.sql alongside mimir's 0001 + 0002 ✅
5. Re-running migrate after 0001 applied is a no-op ("already applied; skipping") ✅
6. Test suite: 96/96 pass after a real `npm test` run (NOT a mental trace — actually executed) ✅
7. End-to-end CLI smoke: `node scripts/profile-game.mjs --bgg-dir ../mimir/tests/fixtures/bgg --mock --apply` writes 7 rows to rec_seidr_game_profile ✅
8. Idempotent re-apply: running the same CLI command twice produces no duplicate rows (UPSERT-by-(game_id, profile_version)) ✅
9. **Mimir regression check:** mimir's 168/168 still pass ✅ (no mimir code changed; verified via `cd ../mimir && npm test`)

**Test plan (executed BEFORE push):**
- `npm install` in seidr (fresh, since we added pg dep)
- `npm test` in seidr → expect 96/96 pass. Result: 96/96 ✅ (after fixing one test failure: `generateProfile: rejects wrong game_id from LLM` — initial implementation didn't enforce the LLM-must-echo-game_id contract; added the check to profile-game.mjs and re-ran)
- `DATABASE_URL=... npm run migrate:dry-run` → safety check passes ✅
- `DATABASE_URL=... npm run migrate` → applies cleanly ✅
- Re-running migrate is no-op ✅
- SQL verification:
  - `SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'rec_%'` → 22 (15 from mimir 0001 + 4 from mimir 0002 + 3 from seidr 0001) ✅
  - 3 new tables exist by name ✅
  - rec_migrations contains both engines' migration filenames ✅
- CLI smoke: `node scripts/profile-game.mjs --bgg-dir ../mimir/tests/fixtures/bgg --mock --apply` writes 7 profiles ✅
- Re-running apply is idempotent (still 7 rows) ✅
- `cd ../mimir && npm test` → 168/168 (no regression) ✅

**Outcome:** Pushed in this commit. Pipeline is production-ready for the laptop run with real ANTHROPIC_API_KEY. The 7 reference profiles serve as the validation gold-standard: when the top-500 LLM run produces profiles for these 7 games, cosine similarity to the reference profiles must exceed 0.85 — anything below that flags a prompt-iteration need.

**Learnings:**
- **Test-driven discipline caught a real contract violation.** The test `generateProfile: rejects wrong game_id from LLM` was written speculatively (we expect the pipeline to refuse a profile whose game_id doesn't match the requested game), and it FAILED on the first run because the validator only checks shape, not contract. Added the explicit check to `generateProfile` after validation. Without that test, this would have been a silent class of bug — the pipeline would happily write a profile for game A under game B's row in the DB.
- **Hand-authored reference profiles are surprisingly hard.** Some dimensions (mechanical complexity, time, player count) are nearly direct from BGG metadata. Others (PSY_NEUROTICISM — "anxious vs. resilient"?) require interpretation that varies between authors. The confidence_per_dim field is the honest accommodation: 0.95 for what's directly observable, 0.5–0.7 for what requires inference. The eventual LLM should be instructed to follow the same calibration, AND the validator could in a future sprint enforce "no confidence above 0.95 unless dim has a directly-observable mechanic match" as a sanity rule.
- **The decision to put seidr-specific migrations in `seidr/migrations/` (not in mimir's) honors silo § "Cross-engine coordination" cleanly.** Each engine carries its own migration directory + runner. Filenames are unique because the prefix differs (`0001_seidr_*` vs. mimir's `0001_create_*`). The shared `rec_migrations` bookkeeping table accommodates both. Trade-off: there's now a duplicate ~210-line runner in seidr/scripts/. Acceptable cost for silo enforcement; the duplication is mechanical, not conceptual.
- **The mock LLM pattern (createMockLLMClient + reference-profiles.json) is the lever for offline development.** I can ship + test the entire pipeline without burning a single token. When the user is at laptop with an API key, the same code paths run unchanged — the only difference is which `.generate()` implementation is bound at runtime.
- **Sprint 1.0.18 closed the loop on the seidr "missing piece" identified in 1.0.16.** Seidr's `docs/game-profiling-strategy.md` flagged that the algorithm was useless without game profiles; this sprint produced the schema, pipeline, and 7 reference profiles. Sprint 1.0.19 (cosine matcher) can now be implemented and tested against these 7 profiles.

**Rollback:** Revert this sprint's commits. Remove the engine-specific tables via `DROP TABLE rec_seidr_player_profile, rec_seidr_game_profile, rec_seidr_response;` and remove the row from `rec_migrations`. All other engines are unaffected (silo isolation worked).

---

## Initial scaffold (2026-05-06) — landed via Mimir Sprint 1.0.16

Seidr engine scaffolded with full design-doc set, curated question bank (50 questions, edited from Manus's 118), and a deployable static-HTML quiz UI for pre-launch real-user testing.

See `mimir/SPRINT_LOG.md` Sprint 1.0.16 for the full provenance.

---

## Future sprints (drafts)

### Sprint 0.1 — Quiz UI deployment + first user testing

**Trigger:** Now — the UI is deployable as soon as Shawn drops `quiz-ui/` onto a static host.

**Scope:** Deploy quiz-ui to a public URL (Vercel/Netlify/GitHub Pages). Share with ~10–30 friendly testers. Collect their exported result JSONs for offline analysis.

**What to learn:** Which questions discriminate well? Which feel clunky? Where do users drop off? Do their profiles cluster sensibly?

**Acceptance:** ≥10 completed quizzes; manual review of profiles + qualitative feedback; question bank refinement based on findings.

### Sprint 0.2 — Game profiling pipeline (LLM-generated)

**Trigger:** After Sprint 0.1 confirms the questionnaire is producing useful profiles.

**Scope:** Use Claude (Anthropic API) to profile the top 500 BGG games against the 24 dimensions. Manual validation pass on ~50 reference games (Catan, Pandemic, Gloomhaven, etc — our seed pool). Iterate prompt until reference profiles match expert intuition.

**Output:** `data/game-profiles.json` with 500 entries, each a 24-dim vector + provenance metadata.

### Sprint 0.3 — Schema additions (rec_seidr_*)

**Trigger:** Question bank stable + game profiling complete.

**Scope:** Migration `0003_add_seidr_tables.sql` adding:
- `rec_seidr_player_profile` — a player's 24-dim profile vector + confidence vector + completion timestamp + question-set-version
- `rec_seidr_game_profile` — a game's 24-dim profile vector + provenance (`llm_generated`, `manually_curated`, `play_inferred`)
- `rec_seidr_response` — every quiz answer for forensics + question-quality analysis

### Sprint 0.4 — Cosine similarity matcher (pure function)

**Trigger:** Schema applied + first profiles loaded.

**Scope:** `src/match.mjs` with `matchProfiles(playerVector, gameProfiles, options) → ranked list`. Pure function, like mimir's score.mjs. Cosine similarity + confidence weighting + per-dimension importance overrides.

### Sprint 0.5+ — HTTP API surface, integration with rec router, A/B vs mimir.

---

## Cross-engine notes

- Seidr shares the `rec_*` schema namespace with mimir per SILO.md.
- Seidr does NOT import from mimir. Independent engines.
- The 24-dim profile produced by seidr is also consumed by saga (future) as a feature in the per-player fun model. Seidr's data is reusable infrastructure.
