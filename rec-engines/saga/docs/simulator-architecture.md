# Saga — Simulator Architecture

The Monte Carlo machinery that drives saga's predictions. This document specifies the simulation step, the runtime data flow, and the latency budget. Read after `design-notes.md`.

---

## Simulation step (one game-night, one candidate)

A single simulation produces a per-player fun vector. Inputs are deterministic inputs + a sampled outcome.

```
Inputs (deterministic):
  G               — candidate game (with its game outcome model parameters)
  group           — list of players (with their per-player fun model parameters)
  context         — { player_count, time_available_min, time_of_day,
                      energy_level, has_kids, alcohol_present, ... }
  rng_seed        — reproducibility for tests + audit logs

Sampled (this simulation):
  outcome ← sample_outcome(G, group, context, rng):
    {
      winner_id          ← weighted by player skill priors + game's variance
      score_decisive     ← bernoulli(G.score_decisiveness)
      runaway_leader     ← bernoulli(G.runaway_leader_propensity, conditioned on group_size)
      kingmaker_event    ← bernoulli(G.kingmaker_propensity, conditioned on group_size + skill_spread)
      ap_event           ← bernoulli(G.ap_trigger_rate, conditioned on group's max ap_susceptibility)
      comeback_event     ← bernoulli(G.comeback_rate)
      decision_density   ← gaussian(G.decision_density_mean, G.decision_density_std)
      memorable_moment   ← bernoulli(0.3)  # population baseline; refine later
      duration_min       ← gaussian(G.duration_mean[group_size], G.duration_std[group_size])
                           clamped to [G.duration_min, G.duration_max]
      eliminations       ← list of player_ids eliminated, derived from G.eliminate_player_event_rate
    }

Per-player fun (deterministic given outcome):
  for each p in group:
    role_outcome_term(p, outcome) =
      + win_bonus           if winner_id == p.id
      + close_loss_bonus    if not winner & score_decisive == 0
      - blowout_loss_penalty if not winner & score_decisive == 1
      - kingmade_penalty    if kingmaker_event & winner != p
      - eliminated_penalty  if p.id in eliminations
      ...
    
    interaction_term(p, group, outcome, ctx) =
      - alpha_problem_penalty   if group has player with alpha_propensity > 0.7 AND p has low_assertive
      - ap_exhaust_penalty      if ap_event & p has low_patience
      + memorable_bonus         if memorable_moment & p has high_narrative_appetite
      ...
    
    fun[p] = baseline_fun(G, ctx)
           + p.player_baseline_offset
           + Σ_d  w_d · p.dim[d] · G.dim[d]
           + role_outcome_term(p, outcome)
           + interaction_term(p, group, outcome, ctx)
           + ε ~ N(0, σ²)
    
    fun[p] = clamp(fun[p], 1, 5)

Output: per-player fun vector for this simulation: [fun_p1, fun_p2, ..., fun_pK]
```

`baseline_fun(G, ctx)`, `player_baseline_offset(p)`, and the weight vector `w_d` are model parameters fit from recap data.

## Aggregating N simulations

Run the simulation step N times (typically N=1000 with different `rng_seed`) and aggregate:

```
Per-candidate output:
  expected_fun_per_player[p]      = mean over simulations of fun[p]
  fun_variance_per_player[p]      = variance over simulations of fun[p]
  P_high_fun[p]                   = fraction of simulations where fun[p] ≥ 4
  P_misery[p]                     = fraction of simulations where fun[p] ≤ 2
  
  group_aggregates:
    expected_group_fun_geomean    = mean over simulations of geomean(fun across group)
                                    (geomean penalizes any player having low fun)
    P_everyone_happy              = fraction of simulations where min(fun across group) ≥ 3.5
    P_anyone_miserable            = fraction of simulations where min(fun across group) ≤ 2
                                    (the headline tail-risk metric)
    
  per_outcome_breakdown:
    {
      "won_by_p1":              fraction of simulations × mean fun per player in those sims
      "kingmaker_event":        fraction × mean per-player fun
      "ap_event":               fraction × mean per-player fun
      "memorable":              fraction × mean per-player fun
      ...
    }
    (these surface to the explanation generator: "in 35% of simulations someone
    kingmade and your fun dropped 0.8 stars — be careful with this one")
```

The explanation generator uses `per_outcome_breakdown` to produce natural-language explanations grounded in specific predicted dynamics ("there's a 30% chance of an AP-triggered slowdown that hurts Jordan's predicted fun"). This is qualitatively different from mimir's rule-based templates and forms saga's primary explanation surface.

## Ranking

For each candidate G in the candidate pool, run the above. Score by a configurable risk-aware aggregation; a default that has worked in pilot designs:

```
score(G) = 
    expected_group_fun_geomean(G)            # primary: how good is this game on average
  - λ_misery · P_anyone_miserable(G)         # punish tail risk
  - λ_variance · variance_across_group(G)    # punish fun-spread (one player loves it, one hates it)
  + λ_memorable · P(memorable_moment | G)    # reward distinctive nights
```

Defaults: `λ_misery = 1.5`, `λ_variance = 0.3`, `λ_memorable = 0.2`. These are tunable per surface (e.g., "FLGS event for strangers" sets `λ_misery = 3.0`; "experienced gaming group" sets `λ_misery = 0.5`).

After per-candidate scoring:
1. Apply hard filters: player-count, exclude-loved-already, exclude-noped, exclude-traded-in, time-budget
2. Apply MMR diversification + designer cap (per SILO.md § 7)
3. Return top-K with metadata

## Latency budget

A single simulation step is dominated by the `Σ_d w_d · p.dim[d] · G.dim[d]` term: 24 dims × |group| players. For a 5-player group, that's 120 multiplications + adds per simulation per candidate. Plus ~5 boolean events sampled, plus the role/interaction terms.

Estimated single-simulation cost: ~1µs in tight JavaScript / WASM. For N=1000 simulations × 50 candidates × 5-player group:

```
50 * 1000 * (~5µs) = 250ms per request
```

This fits within saga's <2000ms budget with comfortable headroom. The actual latency dominated by:

- Loading model parameters from DB (target: <50ms via cache)
- Running the simulation loop (target: <1500ms)
- Aggregating + ranking + diversifying (target: <100ms)
- Generating explanations for top-K (target: <300ms via template + per-outcome data)

If profiling shows the simulation loop blowing past 1500ms, optimization options:
- **Reduce N adaptively.** First pass at N=100; for top candidates re-run at N=1000 for tighter estimates.
- **Coarse-to-fine candidate filtering.** Use mimir/seidr to pre-filter to top 100 candidates; saga simulates only those.
- **Vectorize.** The 24-dim feature interaction term is pure linalg; SIMD-friendly.
- **Cache per-candidate outcomes.** If a (game, group_composition_signature, context_signature) tuple has been simulated recently, reuse the aggregated output. Cache invalidation when model retrains.

## Reproducibility + auditability

Every saga simulation accepts an explicit `rng_seed`. The `rec_request_log` records the seed; the same request rerun with the same seed produces identical output. This is non-negotiable:

- **Tests** rely on it (deterministic test fixtures)
- **Audit** ("why did saga recommend this?") requires the ability to replay the exact simulation
- **Calibration** ("did saga's prediction hold up?") requires the per-simulation breakdown to be reproducible from the logged seed

`rec_saga_simulation_log` (table to be added in saga's first migration) stores: `(request_id, candidate_game_id, rng_seed, n_simulations, model_version, aggregated_output_json)`. Per-simulation outputs aren't stored (too voluminous); they're regeneratable from `(rng_seed, n_simulations, model_version)`.

## Versioning

Saga's model parameters change every retrain. Each retrain bumps `model_version`. Logged predictions reference the model version that made them so post-hoc analysis can attribute calibration changes to model changes vs. data drift.

Three versioned artifacts:
- `rec_saga_player_fun_params` (per-player coefficients, retrained weekly)
- `rec_saga_game_outcome_params` (per-game outcome parameters, retrained less often)
- `rec_saga_population_params` (population baseline + weight vector, retrained when enough new recap data accumulates)

Each row in these tables carries `effective_from` and `effective_until` timestamps; the simulator picks the version matching the request timestamp (or the latest, for live requests).

## Failure modes + fallbacks

- **Missing per-game outcome parameters** (game has <30 recap records): fall back to a BGG-derived prior + return wide variance. Log `saga_low_data_game`.
- **Missing per-player parameters** (player has <5 recaps and no seidr profile): fall back to population baseline; return all-low-confidence; log `saga_cold_player`.
- **Missing seidr profile and no recap data:** saga should NOT be the responding engine; the rec router should not have routed here. If it did anyway, return error code `saga_no_routing_match` so the router can fall back to mimir.
- **Simulation step diverges** (NaN in per-player fun, e.g. due to corrupted parameter): return error code `saga_simulation_failure`; log offending parameter set; rec router falls back.
- **Latency budget exceeded:** abort with partial results (whatever simulations completed) + flag `saga_partial_simulation`; rec router decides whether to use partial or fall back.

Each failure mode produces a structured error response that the rec router can act on, matching the API contract conventions established in the architectural design doc.

## Why a simulator and not a regression directly?

A direct regression `f(player_features, game_features, group_features, context) → predicted_fun` would skip the simulation loop. Why don't we?

1. **Simulator captures variance, regression captures only mean.** A direct regression returns a single predicted-fun number per player. We need the distribution because tail risk is the actionable metric.
2. **Simulator surfaces explanations grounded in specific dynamics.** "30% chance of kingmaker → -0.8 fun for non-winner" is a concrete narrative. A regression's explanation is "feature X had coefficient Y," which is mathematically equivalent but communicatively useless.
3. **Simulator is composable with new sampled events.** When recap data shows a new failure mode (e.g., "alpha-coordinator problem" in coop games), we add it as a new sampled outcome with a fitted parameter. A regression would have to refit globally; the simulator just adds a new term.
4. **Simulator is testable in synthetic settings.** Build a simulated Catan with synthetic players, run saga over it, compare predicted vs. ground-truth fun distribution. Direct regression tests can't do this — there's nothing to compare against without recap data.

The cost is computational (1000× per-candidate) and modeling complexity (sample-and-aggregate vs. closed-form regression). Both are tractable.

## What this document does NOT specify

- **Training pipeline.** That's `recap-as-training-data.md`.
- **API contract.** That's the architectural design doc; saga inherits the standard rec-engine HTTP contract.
- **Specific code organization.** Implementation lands in `src/` when saga's first implementation sprint fires (Sprint Saga-0.0, post-data-accumulation).
