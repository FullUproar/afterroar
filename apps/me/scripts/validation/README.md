# Rec Engine Validation Suite

Hand-authored test personas + harness scripts to validate the Heimdall recommendation engine end-to-end. Built so we can answer "is the engine actually surfacing the right games?" with evidence rather than vibes.

## When to run

- After a major orchestrator change (matcher tweaks, new aggregation strategy, signal-boost adjustments)
- After the LLM tail run lands new game profiles into `rec_seidr_game_profile`
- Before declaring "rec quality looks good" to anyone

## Files

| File | Purpose |
|---|---|
| `personas.mjs` | The persona library — 18 hand-authored archetypes with profiles, confidences, and expected fits. Single source of truth. |
| `seed-personas.mjs` | Writes personas to `rec_seidr_player_profile` under `validate-test-*` IDs. Idempotent (drops + re-inserts). |
| `validate-single.mjs` | Hits `/api/quiz/recommend` per persona (anonymous — no DB needed). Asserts expected fits, prints markdown report. |
| `validate-groups.mjs` | Hits `/api/recs/games` with multi-player payloads. Compares `min` vs `mean` aggregation; produces evidence for the egalitarian default. |
| `cleanup.mjs` | Deletes all `validate-test-*` rows from `rec_seidr_player_profile`, `rec_seidr_user_game_signal`, `rec_seidr_recommendation_event`. |

## Test isolation

Every persona's `player_id` is prefixed `validate-test-` (constant `TEST_ID_PREFIX` in `personas.mjs`). Every notes field carries `VALIDATION TEST PERSONA — auto-managed by scripts/validation/`. Cleanup filters by the prefix.

This means test personas are visible in prod but trivially filterable. Acceptable pre-launch; if we want stricter isolation later, we can move them to a separate schema or DB.

## Typical flow

```bash
# 1. Single-player validation (no DB writes; fastest signal)
node scripts/validation/validate-single.mjs --report=tmp/single.md

# 2. Seed personas to DB so group validation has them
DATABASE_URL=... node scripts/validation/seed-personas.mjs

# 3. Group validation (needs the API key with recs:read scope)
API_KEY=ar_live_... node scripts/validation/validate-groups.mjs --report=tmp/groups.md

# 4. When done — clean up
DATABASE_URL=... node scripts/validation/cleanup.mjs
```

## Interpreting results

**Single-player report:**
- ✓ PASS = all hard assertions held
- ⚠ PASS = passed but with soft warnings (e.g. one rec from a discouraged subdomain — noteworthy, not a failure)
- ✗ FAIL = a hard assertion failed (wrong subdomain dominance, blocked games appeared, playing-time median outside range)
- Each failure includes specific detail. Eyeball the top-K list — sometimes a "failure" is actually the engine being smarter than the hand-written assertion.

**Group report:**
- The headline metric is the **floor gap** = (`min` aggregation's worst-player score) − (`mean` aggregation's worst-player score) on the top rec.
- Positive floor gap = `min` raised the floor for the worst-off player. Our claim holds.
- Near-zero floor gap = same picks under both strategies (overlapping group — no aggregation needed; either works).
- Negative floor gap = `mean` somehow beat `min` for the worst-off player. Investigate: probably a degenerate scenario (single-player group, etc.).
- Aggregate across all scenarios should show `min` winning in the conflict-y groups (Wargamer + Family, Strategist + Party Host).

## Evolving the personas

The current 18 personas are my opinionated baselines. Manus is doing public-forum research to refine the expected-fits with real-world player taste data — when that lands, the `expectations` blocks in `personas.mjs` are the natural home for those upgrades.

Adding a new persona:
1. Edit `personas.mjs`, add to the `PERSONAS` array
2. Re-run seed + validation
3. Cleanup is automatic (the prefix catches anything)

## Calibration notes

- Specific BGG-ID `shouldAppear` assertions are SOFT (warnings, not failures) because the corpus may not yet contain a given game. Once the LLM tail run lands and the corpus grows to 2600 games, we can promote some of those soft assertions to hard.
- Subdomain assertions are tuned for the BGG taxonomy: Strategy / Family / Party / Wargame / Thematic / Customizable / Children / Abstract.
- "Blocked subdomain" tolerates 1 cross-genre rec (a single Wargame in a Family Player's top-12 is weird but not a system failure); 2+ is a hard fail.
- `subdomainOneOf` requires majority (>50%) of top-K in the allowed set — strict enough to catch real drift, loose enough to allow surprise picks.
