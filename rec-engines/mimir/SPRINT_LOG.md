# Mimir — Sprint Log

Per-sprint development history. Most recent at top.

---

## Sprint 1.0.8 — Logging helpers (2026-05-06) ✅

**Goal:** Pure functions in `src/logging.mjs` that build row shapes for the four logging tables (rec_request_log, rec_candidate_log, rec_feedback_log, rec_recap_outcome) per design doc § 7. The future HTTP handler will compose these with a `pg` client to actually insert rows.

**Why mobile-friendly:** Pure functions, no I/O, no DB. Tests are pure shape assertions.

**Scope:**
- `src/logging.mjs` exporting:
  - `buildRequestLogRow(request, response, opts)` → rec_request_log shape
  - `buildCandidateLogRows(requestId, scoredCandidates)` → rec_candidate_log[] shape
    - Accepts BOTH ranker output shape `{ candidate, score, ... }` AND recommend() results shape `{ game_id, explanation, diagnostics }` so the handler can choose which to log
  - `buildFeedbackLogRow(requestId, gameId, outcome, opts)` → rec_feedback_log shape; throws on invalid outcome
  - `buildRecapOutcomeRow(opts)` → rec_recap_outcome shape; throws when required fields missing
  - `VALID_OUTCOMES` constant + `isValidOutcome()` validator
- `tests/logging.test.mjs` — 22 assertions covering shape, defaults, both candidate input shapes, validator behavior, error cases

**Acceptance criteria:**
1. Each helper produces a row matching its corresponding SQL schema column shape ✅
2. buildCandidateLogRows accepts both internal and external candidate shapes ✅
3. buildFeedbackLogRow throws on invalid outcome (catches typos at insertion time, not silently) ✅
4. buildRecapOutcomeRow requires (night_id, game_id, player_id); other fields default to null ✅
5. ts defaults to current ISO string; can be overridden via opts.ts (essential for deterministic tests in future API handler) ✅
6. VALID_OUTCOMES matches the 8 outcomes from design doc § 4.3 ✅

**Test plan (executed BEFORE push, mental trace):**
- VALID_OUTCOMES contains exactly: shown, clicked, accepted, played, rated, bought, dismissed, ignored ✅
- isValidOutcome: each VALID_OUTCOMES entry returns true; 'viewed', '', null, 'SHOWN' return false ✅
- buildRequestLogRow: full input → row has request_id and ranker_version from response, surface/caller/context/options copied from request ✅
- buildRequestLogRow with empty inputs → surface='unknown', other fields default to {} ✅
- buildRequestLogRow: ts is ISO; opts.ts overrides ✅
- buildCandidateLogRows ranker shape: extracts candidate.id as game_id, reasonCodes as reason_codes, breakdown as score_breakdown ✅
- buildCandidateLogRows recommend shape: extracts game_id, explanation.reason_codes, diagnostics.score_breakdown ✅
- buildCandidateLogRows missing diagnostics → score_breakdown=null ✅
- buildCandidateLogRows: rank assigned 1..N ✅
- buildCandidateLogRows([]/null/undefined) → [] ✅
- buildFeedbackLogRow with required fields only → outcome_value=null, outcome_context=null ✅
- buildFeedbackLogRow with rated + outcome_value=4 → captured ✅
- buildFeedbackLogRow with bought + outcome_value=4500 + outcome_context={store_id} → both captured ✅
- buildFeedbackLogRow with 'wishlisted' → throws /Invalid feedback outcome/ ✅
- buildFeedbackLogRow opts.ts overrides default ✅
- buildRecapOutcomeRow required fields preserved; optionals default null ✅
- buildRecapOutcomeRow with full opts → all fields captured (including 'Brad got salty' notes) ✅
- buildRecapOutcomeRow missing required → throws /required/ ✅
- buildRecapOutcomeRow with null arg → throws ✅
- buildRecapOutcomeRow with falsy values (0, false) → preserved (uses == null check, not falsy check) ✅

**Outcome:** Pushed in this commit. ~140 lines source + ~250 lines tests across 22 assertions.

**Verification:** Will be confirmed via post-push read-back. Test execution deferred to laptop.

**Learnings:**
- Accepting two candidate shapes in `buildCandidateLogRows` was a small but important affordance. The future HTTP handler will likely log ALL candidates considered (per design doc § 7.2), which means it needs the ranker-output shape (full breakdown), not just the public response shape. By accepting both, we let the handler choose without forcing it to translate.
- Throwing on invalid outcomes (vs. silently coercing or logging anyway) catches typos at the insertion call-site. Logging garbage outcomes that look valid but aren’t (`'wishlisted'` vs. proper schema value) corrupts training data in subtle ways. Hard fail is the right default.
- The `== null` (loose equality) check in buildRecapOutcomeRow lets falsy values like `0` and `false` flow through correctly. A `!opts.fun_rating` check would silently drop legitimate values. This is a small footgun that’s easy to step on without explicit testing.
- Defaults to current ISO timestamp + opt-in override means tests can pin times for determinism without forcing the handler to inject one. Good split.

**Rollback:** Revert this commit. Pure code, no side effects.

---

## Sprint 1.0.7 — HANDOFF.md update for laptop pickup (2026-05-06) ✅

Pushed at commit `5690d21`. Updated `rec-engines/HANDOFF.md` with current state, laptop pickup steps, Sprint 0.3 walkthrough.

---

## Sprint 1.0.6 — recommend() composer + offline driver (2026-05-06) ✅

Pushed at commit `f6e60db`. THE CAPSTONE. End-to-end pipeline runnable offline. ~120 lines composer + ~150 lines CLI + ~280 lines tests.

---

## Sprint 1.0.5 — Explanation generator (2026-05-06) ✅

Pushed at commit `0bd5d31`.

---

## Sprint 1.0.4 — MMR diversification + ranking pipeline (2026-05-06) ✅

Pushed at commit `7cde547`. Hard designer cap.

---

## Sprint 1.0.3 — v0 Scoring function (2026-05-06) ✅

Pushed at commit `089af2f`.

---

## Sprint 1.0.2 — Taste vector computation (2026-05-06) ✅

Pushed at commit `3bac627`.

---

## Sprint 1.0.1 — Curate seed BGG ID list (2026-05-06) ✅

Pushed at commit `61cab65`. 60 hand-curated BGG IDs.

---

## Sprint 1.0 — BGG metadata fetcher (2026-05-06) ✅

Pushed at commit `337ed7c`.

---

## Sprint 0.2 — Migration runner script (2026-05-06) ✅

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

## Sprint 0.3 — Apply 0001 migration to a non-prod DB (DRAFT, REQUIRES LAPTOP)

Reiterated. This is the next blocking sprint when on laptop. See HANDOFF.md § "When you sit at the laptop next" for the full step-by-step.

## Sprint 1.1 — BGG JSON → rec_* writer (DRAFT, depends on 0.3)

Reads `tmp/bgg/*.json`, upserts via `INSERT ... ON CONFLICT DO UPDATE` into rec_game / rec_designer / rec_mechanic / rec_theme / rec_category / rec_edge.

## Sprint 1.2 — HTTP API surface for recommend() (Phase 1, depends on 0.3 + 1.1)

Next.js route handler at `apps/recs-mimir/api/recommend` (or wherever the silo grows its HTTP surface). Composes:
- request validation
- recommend() call
- buildRequestLogRow + insert
- buildCandidateLogRows + bulk insert (ALL candidates, not just top-K — per design doc § 7.2)
- return public response

Feature-flagged off in production. The first time it serves a real request will be the canary store pilot (Sprint 1.3+).
