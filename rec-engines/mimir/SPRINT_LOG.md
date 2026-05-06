# Mimir — Sprint Log

Per-sprint development history. Most recent at top.

---

## Sprint 1.0.9 — HOTFIX: explain.mjs syntax + npm test glob (2026-05-06) ✅

**Why:** Cloned the branch in a sandbox, ran `npm install` + `npm test` against the actual code. **Two bugs that mental traces missed:**

1. **`src/explain.mjs:121`** — single-quoted string with an apostrophe inside it (`'in a series you've shown interest in'`). Pure JS syntax error. Cascaded to break the loading of `tests/explain.test.mjs` AND `tests/recommend.test.mjs` (which transitively imports `explain.mjs`).
2. **`package.json` `test` script** — `node --test tests/` fails on Node 22 with MODULE_NOT_FOUND because Node tries to resolve the path as a single module. The correct invocation is `node --test tests/*.test.mjs` (shell glob expansion) or `cd tests && node --test`.

**Result before fix:** 117 of 119 testable assertions passed; 2 of 8 test files failed at module load.
**Result after fix:** **153 of 153 assertions pass.**

**Goal:** Fix both bugs and verify with a real `npm test` run (not a mental trace).

**Scope:**
- `src/explain.mjs:121` — wrap the offending string in double quotes so the apostrophe is literal: `"in a series you've shown interest in"`.
- `package.json` — change `"test": "node --test tests/"` to `"test": "node --test tests/*.test.mjs"`.
- Update SPRINT_LOG with Sprint 1.0.9 entry.

**Acceptance criteria:**
1. `npm test` runs all 153 assertions and reports `pass 153, fail 0` ✅ (verified locally via `git clone` + `npm install` + `npm test` in a sandbox).
2. No source file changes other than the one quote fix on line 121 ✅.
3. SPRINT_LOG documents the failure mode honestly so future Claudes / humans don’t repeat it.

**Test plan (executed BEFORE push):**
- `git clone -b claude/review-uoroar-platform-CuLMi https://github.com/fulluproar/afterroar.git` in a fresh sandbox.
- `cd rec-engines/mimir && npm install`.
- `npm test` after applying the two-line fix — must report 153 pass / 0 fail.
- Verified on Node 22.22.2.

**Outcome:** Locally verified `npm test` reports `pass 153, fail 0, duration_ms 311`. Push contains only the two file edits + this SPRINT_LOG update.

**Verification:** Will be confirmed via post-push read-back. The local clone+install+test cycle is the canonical proof.

**Learnings (the important part):**
- **Mental traces are necessary but not sufficient.** I traced 14 sprints worth of code mentally, and 12 of them were perfect. The two that weren’t (an apostrophe in a string literal, a Node `--test` invocation that doesn’t walk directories the way I expected) are exactly the kinds of micro-syntax/runtime details mental simulation skips. Lesson: **whenever a `npm test` round-trip is feasible, do it.** The 30 seconds of clone+install+test would have caught both bugs at sprint 1.0.5 and 1.0.2 respectively.
- **The SILO discipline of "verify post-state before declaring complete" is what saved this.** Sprint 1.0.6 was declared complete after a directory listing. That’s not enough — the right "post-state" for a code sprint is also "the test suite passes." Updating my own discipline going forward: post-state = directory listing AND tests green when tests are runnable.
- **The bug location is a meta-data point.** The apostrophe bug was on line 121 of an ~250-line file. The sentence was the only one in the entire file using a contraction inside a single-quoted string. My mental trace skimmed over it because the structure looked the same as the surrounding patterns. Real review (or a parser) doesn’t skim.
- **One bug cascades to multiple test files.** explain.mjs failing to parse made BOTH `tests/explain.test.mjs` AND `tests/recommend.test.mjs` (which imports explain via recommend.mjs) fail at module-load. A single broken file in a small project takes a chunk of unrelated tests with it. Worth knowing.

**Rollback:** Revert this commit to restore the broken state. Don’t.

---

## Sprint 1.0.8 — Logging helpers (2026-05-06) ✅

Pushed at commit `dacc20b`. Pure functions for log row construction. 22 assertions.

---

## Sprint 1.0.7 — HANDOFF.md update for laptop pickup (2026-05-06) ✅

Pushed at commit `5690d21`.

---

## Sprint 1.0.6 — recommend() composer + offline driver (2026-05-06) ✅

Pushed at commit `f6e60db`. THE CAPSTONE. End-to-end pipeline runnable offline.

---

## Sprint 1.0.5 — Explanation generator (2026-05-06) ✅

Pushed at commit `0bd5d31`. **Contained the apostrophe bug fixed in 1.0.9.**

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

## Sprint 0.2 — Migration runner script (2026-05-06) ✅

Pushed at commit `df30ac0`. **Contained the npm test script bug fixed in 1.0.9** — the bug shipped here but only became user-visible in Sprint 1.0.9 because earlier sprints didn’t have a real test suite running.

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

Reiterated. See HANDOFF.md § "When you sit at the laptop next".

## Sprint 1.1 — BGG JSON → rec_* writer (DRAFT, depends on 0.3)

Reiterated.

## Sprint 1.2 — HTTP API surface for recommend() (Phase 1, depends on 0.3 + 1.1)

Reiterated.
