# Saga — Algorithmic Design Notes

Notes specific to the forward-simulator engine. The architectural design doc that applies to ALL engines lives at `../mimir/docs/recommendation-engine-design.md`. This document elaborates saga's specific algorithmic choices and their justifications.

---

## What saga is

Saga is a **risk-aware game-night recommender driven by Monte Carlo simulation of a per-player fun model.** Operationally:

```
For each candidate game G in the candidate pool:
  For each simulation s in 1..N (typically N=1000):
    sample game-outcome variables for game G with this group
    sample interaction effects (alpha problem, kingmaking, AP, etc.)
    for each player p in the group:
      compute predicted_fun(p, G, sampled_outcome, sampled_interaction, context)
    record per-player fun vector for simulation s
  
  Aggregate the N per-player fun vectors into:
    - expected_fun_per_player (mean)
    - fun_variance_per_player
    - P(player p has fun ≥ 4)
    - P(any player has fun ≤ 2)        ← the "miserable time" guardrail
    - P(group geometric mean fun ≥ 3.5) ← the "everyone happy" headline metric
  
  Score G by a risk-aware aggregation (configurable per surface)

Rank candidates by score; apply diversification + designer cap; return top-K.
```

The two models that get trained:

1. **Per-player fun model** `f(player_features, game_features, sampled_outcome, context) → fun ∈ [1,5]`
2. **Game outcome model** `g(game_features, group_features) → distribution over outcome variables`

Each is fit on recap data (per Sprint 1.0.13's recap data spec), with seidr's 24-dim profile providing player priors.

## Why this works (and why nothing else does it)

The recommendation problem in tabletop is fundamentally **multi-agent** in a way movies, music, and books are not. A single book recommendation has one consumer; a single game recommendation has 2–7 consumers whose enjoyment is *coupled by the game itself*. A game that's perfect for one player can be miserable for another at the same table — and a recommender that ignores this fails systematically.

The other engines (mimir, huginn, seidr) approximate the multi-agent problem by aggregating taste vectors across the group. Saga doesn't approximate it — it simulates it. Each simulation step instantiates a hypothetical game-night with this specific group, samples random factors, and computes per-player fun directly. The aggregation happens AFTER simulation, not before.

This matters because:

- **Variance is a first-class output.** A game with mean fun 4.2 and variance 0.1 is dramatically better than a game with mean 4.4 and variance 1.2. The first is reliably good for everyone; the second produces a 4 and a 5 in 70% of nights and a 2 + 5 in 30%. Aggregated taste-vector approaches can't see this. Saga can.
- **Tail risk is detectable.** "P(any player has fun ≤ 2)" — the miserable-time probability — is the single most actionable metric for FLGS event recommendations. A store running a game-night for 12 strangers cannot afford a 30% chance of one walkout. Saga directly computes this; nothing else can.
- **Game dynamics are explicit.** Catan's randomness in resource production, Twilight Imperium's runaway-leader risk, Wingspan's low-conflict pacing — these are properties of the games themselves, not of any individual player. Saga's game outcome model captures them as model parameters fit from recap data.

## Per-player fun model: architecture

### Functional form

```
predicted_fun(p, G, outcome, ctx) =
  baseline_fun(G, ctx)                          # game's base appeal in this context
  + player_baseline_offset(p)                   # this player's tendency to rate higher/lower
  + Σ_d  w_d · player_dim(p,d) · game_dim(G,d)  # 24-dim feature interaction (per dimension framework)
  + role_outcome_term(p, outcome)               # did p win? was p kingmaker? did p run away?
  + interaction_term(p, group, ctx)             # alpha-problem, AP-trigger, energy-mismatch
  + ε
```

Each term is fit from recap data via regularized regression (saga is **not** a deep model in v0; interpretability matters more than marginal accuracy gains, per the Credo's "no black-box rankings" principle).

The 24-dim feature-interaction term is the largest coefficient block (24 weights × player-dim × game-dim products). Sprint 1.0.16 (seidr) provides player_dim values directly via the 24-dim profile. Sprint 1.0.18 (game profiling, planned) provides game_dim values via LLM-generated profiles.

### Why regularized regression and not a neural network

1. **Recap data is small.** Even at 6 months and 3000 records, that's ~12 records per active player on average. Neural networks fit noise at this scale.
2. **Interpretability matters.** When saga says "I predict you'll like this," the explanation surface needs to extract WHY ("you scored high on PSY_ACHIEVEMENT, this game scores high on PSY_ACHIEVEMENT, that interaction term is your largest positive contributor"). Regression coefficients are directly interpretable; learned embeddings are not.
3. **Subtle-wrongness is easier to detect.** A regression coefficient of -0.8 on a feature means "this feature subtracts 0.8 stars from predicted fun." We can audit: does that match domain intuition? Does it produce reasonable predictions for edge cases? With learned embeddings, audit is much harder.
4. **Cold-start is gracefully handled.** A player with zero recap data fits the population baseline + their seidr-derived 24-dim profile dotted into the regression weights. A player with 30 recap records gets a personalized `player_baseline_offset` and possibly per-player coefficient adjustments. The handoff from "all-prior" to "personalized" is a smooth interpolation (regularized regression with shrinkage toward the prior).

We can revisit this in saga v2 once we have ≥30k recap records and per-player records ≥50. At that scale, a learned representation may add value. Premature today.

### Per-player adjustment

Each player gets:
- A scalar `player_baseline_offset` (their "rating dispenser" tendency)
- Optionally (if they have ≥30 recap records), per-dimension weight adjustments — so a player who systematically rates high on AES_THEMATIC games more than the population predicts gets a boosted weight there.

Without seidr profile + sufficient recap, the player gets the population baseline + their seed-loved/noped pool's implied profile.

## Game outcome model: architecture

### What "outcomes" we sample

Per game-night simulation, we sample:

- **Final score distribution** — winner identity, score spread (decisive vs. tight)
- **Runaway leader event** — did one player open a clear lead before turn N? (Yes/No, with parameters fit from recap recall data)
- **Kingmaker event** — did a non-winning player's late-game choice determine the winner?
- **AP (analysis-paralysis) event** — did one player's deliberation slow the table noticeably?
- **Comeback event** — did the leader-at-midpoint NOT win?
- **Decision-density** — was the game decision-rich or decision-sparse for the time it took?
- **Player elimination** — was anyone eliminated before game end? (Some games have this; recap captures it)
- **Memorable moment** — was there a "play of the night" anyone will retell?

These are the dimensions that recap UI v1 (Sprint 1.0.13) was specified to capture. The list grew to match what the per-player fun model needs as inputs to its `outcome` argument.

### Per-game parameters

Each game G in saga's corpus has:

- `kingmaker_propensity` ∈ [0,1] — base rate at this game's group sizes
- `runaway_leader_propensity` — how often does one player open an unrecoverable lead
- `score_decisiveness` — typical winning margin
- `ap_trigger_rate` — how often does this game trigger AP in players who are AP-prone
- `eliminate_player_event_rate` — for games that eliminate (Diplomacy, BSG, etc.)

Each parameter is a fit from recap data, regularized toward a prior derived from BGG metadata (game weight, mechanics, family).

### Conditioning on group

The above parameters depend on group size (Catan-with-3 vs. Catan-with-4 has very different kingmaking dynamics). Recap data captures group size as a structured field, so the conditional `param(game, group_size)` is fitted directly per game where data permits and falls back to game-level prior otherwise.

Group composition matters too — a group of 4 strangers plays differently than 4 close friends — but encoding this requires more data than v0 will have. Saga v1 fits parameters per (game, group_size); saga v2 may add a group-affinity term once recap data permits.

## Integration with the dimension framework

Sprint 1.0.15 added 4 node types: `rec_personality_profile`, `rec_emotion`, `rec_cognitive_profile`, `rec_context_type`. Sprint 1.0.16 specified the 24 dimensions and how seidr extracts them from a player questionnaire. Sprint 1.0.18 (planned) generates 24-dim profiles for the top 500 games.

For saga, this gives **direct, interpretable feature inputs** for the per-player fun model. The largest block of coefficients in `f(...)` is the 24-dim feature-interaction term; without the dimension framework, that whole block doesn't exist and the model collapses to (game-baseline + player-baseline + outcome + interaction). The 24-dim block is the bulk of saga's predictive power for callers with seidr profiles.

This is why Sprint 1.0.15 + 1.0.16 are saga's most important upstream dependencies — more important than the simulator code itself, because the simulator is mechanical and the features are everything.

## Integration with seidr

Seidr produces a player profile in the same 24-dim space saga's per-player fun model consumes. **Saga's cold-start latency is a direct function of seidr coverage.**

| Player has recap records | Player has seidr profile | Saga model uses |
|---|---|---|
| 0 | No | Population baseline + game features only |
| 0 | Yes | Population baseline + 24-dim interaction (full feature power) |
| 1–5 | Yes | Above + light per-player adjustment shrunk toward seidr prior |
| 6–30 | Yes | Above + meaningful per-player adjustment |
| 30+ | Either | Personalized model with seidr as residual prior |

**Without seidr coverage, saga's cold-start floor is ~20 recap records** — i.e., 20 game-nights before saga produces useful predictions for that player. With seidr coverage, the floor is ~3 recaps. This is the single biggest reason seidr exists: not as a primary engine, but as priors that compress saga's training requirement by 7×.

This dependency direction is intentional: seidr graduates first (post-Sprint 1.0.18 game profiling), gathers profiles, and saga's training data accumulates against that prior.

## Integration with the rec router

Saga returns a per-candidate score plus diagnostic metadata (variance, tail-risk probability, per-player predicted fun, top-3 outcome-conditional fun explanations). The rec router (production-side, future) decides:

- **Cold caller (no recap, no quiz):** route to mimir; ignore saga.
- **Quiz-only caller (no recap, has seidr):** route to mimir + seidr; saga returns cold-start scores but with very wide variance bands; rec router may de-weight saga.
- **Warm caller (5+ recaps):** saga is primary. Mimir + huginn + seidr provide complementary scores for ensemble + explanation augmentation.
- **Hot caller (30+ recaps):** saga's personalized model is primary; other engines provide bias correction + explanation only.
- **Group recommendation (multiple players with mixed data status):** the per-group simulation handles mixed-data players naturally — each player's fun is predicted from whatever data exists for them, and the aggregation over the group surfaces tail risk regardless of which player has thin data.

Saga's API contract surfaces all of this as part of the response so the rec router can make routing decisions without re-running models.

## Subtle-wrongness assertions specific to saga

Per SILO.md § 7, every engine must catch its specific failure modes. Saga's:

1. **Miserable-time guardrail.** Top-K recommendations must satisfy P(any player has fun ≤ 2) ≤ 0.3.
2. **Calibration.** Recommendations rated "high expected fun" by saga should be rated ≥4/5 in their actual recap ≥75% of the time. (This is a graduation criterion, not an in-suite assertion, because it requires production data.)
3. **Variance honesty.** A game with insufficient recap data must return wide variance bands — not a confident-looking point estimate. The rec router must be able to tell "saga doesn't know" apart from "saga predicts mediocre."
4. **Player-count honoring.** Simulations are run only at the actual group size requested. If a candidate game is rated highly at 3p but unrated at 5p, saga must NOT return a 5p recommendation by extrapolating — it returns "insufficient data."
5. **Cold-start safety.** A caller with no recap data and no seidr profile gets a low-confidence response. Saga must NOT return confident scores against the population baseline alone.
6. **Negative-edge respect.** A player who voted-nope or traded-in game G must not see G in their next 10 recommendations from saga, even if the predicted fun for the rest of the group is high. (This is a hard filter applied AFTER saga ranking, not an in-model constraint, because saga's per-player fun term should produce the right answer organically — but the hard filter is the safety net.)
7. **Designer-cap honoring** (per SILO.md § 7). Saga's diversification step caps any single designer at 2 in top 10.

## What saga is NOT

- **Not a replacement for mimir.** Mimir handles cold start; saga is useless cold.
- **Not a graph traversal.** Saga doesn't walk graphs. The graph is mimir's domain (and huginn's). Saga's input substrate is *features* (24-dim profiles + game outcome parameters + recap-derived player adjustments), not a graph.
- **Not a black-box neural model.** Saga is intentionally interpretable regression + Monte Carlo. We may revisit in v2; not in v1.
- **Not a single-shot prediction.** Saga returns a distribution. The recommendation surface must aggregate that distribution into a score (and may surface variance to the user as "we're 80% confident this will be a great night for everyone").

## Open design questions

1. **Simulation count N.** N=1000 is a reasonable default but the latency budget at N=1000 × 50 candidates × per-player-evaluation is tight. Phase 1: profile actual latency; consider N=200 with importance sampling on candidates that score high in initial passes.
2. **Re-training cadence.** Per-player adjustments should retrain on a rolling window (e.g., last 90 days) to capture taste drift. Game outcome models can retrain less often. Frequency budget: weekly vs. on-recap-arrival?
3. **Group-affinity term.** When saga has enough data to model "this group plays well together with games of type X" — when does that become tractable, and is it worth the model complexity?
4. **Multi-store generalization.** Is a per-player fun model fit on FLGS A's recaps usable for FLGS B's players? Probably yes for the population-level terms, no for per-player offsets. Yggdrasil (federated cross-store) is the future engine that addresses this; saga v1 stays per-store.
5. **Surface contract.** What variance/risk metadata does saga return alongside the score? The rec router needs enough to make informed routing decisions but not so much it has to re-implement model intuition.
