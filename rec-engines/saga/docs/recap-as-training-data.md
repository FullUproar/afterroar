# Saga — Recap Data as Training Corpus

How the recap data captured by HQ (per Sprint 1.0.13's recap data spec) becomes the labeled training corpus for saga's per-player fun model and game outcome models. Read after `design-notes.md` and `simulator-architecture.md`.

---

## The dependency in one sentence

**Saga's predictive power is bounded above by the volume and quality of recap data collected by HQ.** Every other input (BGG metadata, dimension framework, seidr profiles) is structural — useful but secondary. The recap corpus is the single training signal.

This is why the recap data spec (`../mimir/docs/recap-data-spec.md`, Sprint 1.0.13) was the most important non-mimir sprint of Phase 0: locking the recap UI's structured fields BEFORE any recap was filled out. A recap UI deployed without the spec's structured fields produces qualitative data unsuitable for fitting the per-player fun model. The fields in the spec are the model inputs.

## What recap data gives saga

For each game-night G played by a group on date T, recap data provides:

### Per-game record
- `game_id` (BGG ID + canonical name)
- `group_size` (number of players)
- `duration_min` (actual play time, may differ from BGG's posted average)
- `did_game_finish` (boolean — uncompleted games are real and informative)
- `winner_id` (or null if didn't finish)
- `winner_score` / `loser_scores` (numeric, optional)
- `score_decisive` (was the win clear or close)
- `notable_events` (structured tags: kingmaker_event, runaway_leader, comeback, ap_event, memorable_moment, eliminated_player_event, table_break)
- `play_context` (player_count_actual, time_of_day_bucket, energy_level_bucket, alcohol_present, kids_present)
- `store_id` (which FLGS, if applicable — for cross-store generalization later)

### Per-player-per-game record
- `player_id` (canonical platform user)
- `game_id`
- `night_id` (for joining to per-game record)
- `player_role_outcome` (won, second, mid, last, eliminated_at_turn_N)
- `fun_rating` (1–5, the headline label for the per-player fun model)
- `would_play_again` (yes / yes_in_smaller_group / yes_with_different_group / no)
- `engagement_during_play` (1–5, optional)
- `regrets` (free-text, optional — surfaced to per-player adjustment via NLP later)
- `memorable_for_player` (boolean — was THIS PLAYER part of the memorable moment)

### Both records may be edited within 30 days
Per Sprint 1.0.13 §"Hard requirements". Edits get versioned in the recap data store; saga retraining uses the latest edit at training time.

## What features get derived

Direct features (used as-is by the simulator's outcome sampling):

| Per-game outcome parameter | Recap field source | Estimation method |
|---|---|---|
| `kingmaker_propensity[game, group_size]` | `notable_events.kingmaker_event` | Beta posterior over (game, group_size) records |
| `runaway_leader_propensity[game, group_size]` | `notable_events.runaway_leader` | Beta posterior |
| `score_decisiveness[game]` | `score_decisive` | Beta posterior |
| `ap_trigger_rate[game]` | `notable_events.ap_event` | Beta posterior |
| `comeback_rate[game]` | `notable_events.comeback` | Beta posterior |
| `duration_distribution[game, group_size]` | `duration_min` | Lognormal fit per (game, group_size) |
| `memorable_moment_rate[game]` | per-game `notable_events.memorable_moment` | Beta posterior |
| `eliminate_player_event_rate[game]` | `notable_events.eliminated_player_event` | Beta posterior |
| `did_finish_rate[game, group_size]` | `did_game_finish` | Beta posterior |

Each parameter is a posterior given a Beta-distribution prior derived from BGG metadata (game weight, mechanic family). For games with <30 recap records, the prior dominates; for games with >100 records, the recap data dominates. Smooth handoff via the conjugate prior update.

Derived features (used by per-player fun model):

| Player-level signal | Recap field source | Use in model |
|---|---|---|
| `player_baseline_offset[player]` | average `fun_rating - population_mean_fun` | Per-player intercept term |
| `per_dim_residual_weights[player]` | regression of `fun_rating - predicted_fun` against player_dim · game_dim per dimension | Per-player coefficient adjustment, after ≥30 records |
| `kingmaker_sensitivity[player]` | regression of `fun_rating` against `kingmaker_event` involvement | Personalized interaction term |
| `ap_tolerance[player]` | regression of `fun_rating` against `ap_event` × player_role | Personalized interaction term |
| `engagement_per_dim[player]` | engagement vs. dim · dim products | Side model: predicts engagement decay, used for time-of-day routing |

Each derived feature is fit with strong regularization toward the population baseline. New players (≤5 records) effectively use the population baseline + their seidr profile (if any).

## Group-level features (saga v1.5+)

Per Sprint 1.0.13's spec, recaps capture `group_id` indirectly via the set of `player_id`s on a given night. Group-level signals (saga v1.5+, after sufficient data):

- `group_pace_preference` — does this group prefer ≤60min games or ≥90min games (from `duration_min` × `fun_rating` correlation)
- `group_alpha_dynamics` — does this group's predicted fun degrade in games with high `kingmaker_propensity`
- `group_competitive_mode` — does this group rate higher fun in cooperative games or competitive games

These are post-Phase-1 features. Saga v1 uses per-player + per-game features only. Group-level modeling waits for ≥6 months of recap data accumulated per stable group.

## Training data quality requirements

For saga to fit a useful model, recap data must satisfy:

| Metric | Saga v1 minimum | Why |
|---|---|---|
| Total recap records | ≥3000 | Below this, even population-baseline fits are noisy |
| Distinct active players (≥10 records each) | ≥200 | Per-player baselines need breadth |
| Distinct games (≥30 records each) | ≥150 | Per-game outcome parameters need breadth |
| Recaps with `fun_rating` filled | ≥80% of records | Headline label must be present in vast majority |
| Recaps with `notable_events` tagged | ≥40% of records | Outcome parameter fits need event signal |
| Time span of corpus | ≥6 months | Captures seasonal + drift effects |
| Distinct group-size × game combinations | ≥500 | Conditioning per group_size needs coverage |

These are the **graduation thresholds** for saga. Phase 0 saga waits until ALL are met; if any are missing, the engine stays in silo because the per-player fun model would be subtly wrong (per SILO.md).

## Capture rate is the bottleneck

The graduation thresholds depend not on platform user count but on **completed recap rate**. A platform with 1000 active players who never fill recaps gives saga zero training data; a platform with 100 active players who fill every recap gives saga useful data in 4–6 months.

Capture rate is therefore the most important metric to optimize for during Phase 0/1:

- Mobile-first recap UI (most recaps will be filled in the parking lot after game-night, on phones)
- One-tap-affirm flow for the common case (winner + would-play-again + fun_rating; everything else optional)
- Reminder hooks (mimir suggests "you played Cascadia Tuesday — did everyone enjoy it?" via a soft notification)
- Stranger-friendly capture (FLGS event recaps for people who don't have accounts: anonymous fun_rating from a QR code)

These capture-rate optimizations are HQ surface concerns, not saga's, but the dependency is direct: **the recap UI's UX directly determines saga's eventual ceiling.**

## Training pipeline (specification)

When saga implementation begins (post-data-accumulation):

```
Step 1 — Snapshot recap data
  Pull all recap records from the recap data store
  Filter: records with fun_rating present; records with at least game_id + player_id + winner_id
  Output: training corpus snapshot, immutable, versioned by date

Step 2 — Fit population-level models (slow, monthly cadence)
  Fit baseline_fun(G, ctx) — game's contextual base appeal
  Fit weight vector w_d for the 24-dim feature interaction term
  Fit role_outcome coefficient block (win/loss/kingmade/etc. → fun adjustment)
  Fit interaction coefficient block (alpha-problem, ap-exhaust, etc.)
  Output: rec_saga_population_params row, model_version = vYYYY.MM
  
Step 3 — Fit per-game outcome parameters (medium cadence, weekly)
  For each game with ≥30 recap records:
    Fit Beta posteriors for kingmaker_propensity, runaway_leader, etc.
    Fit lognormal for duration_distribution per group_size
  For games with <30 records: BGG-prior-only entry
  Output: rec_saga_game_outcome_params rows
  
Step 4 — Fit per-player parameters (fast cadence, daily or on-recap-arrival)
  For each player with ≥10 records:
    Fit player_baseline_offset (regularized toward 0)
    Fit per_dim_residual_weights (regularized toward 0, ≥30 records to be non-zero)
    Fit kingmaker_sensitivity, ap_tolerance, etc. interaction adjustments
  For players with <10 records: baseline + seidr-prior-only entry
  Output: rec_saga_player_fun_params rows
  
Step 5 — Validate before promoting model_version to production
  On a 20% held-out recap set, predict fun and compare to actual
  Calibration check: predictions in [4, 5] band actually match ratings ≥4 in ≥75% of cases
  Subtle-wrongness check: no player has predicted fun > 4 for a game they noped
  If checks pass: bump active model_version
  If checks fail: hold previous model_version, log failure mode, alert
```

The per-game and per-player params are stored in DB tables created by saga's first migration (when implementation sprint fires). Population params are similarly tabled.

The pipeline is offline. Runtime saga inference reads model parameters from DB cache; never trains live.

## What recap data CAN'T provide (and how saga handles it)

Recap data captures what was recorded; it can't capture:

- **Players who didn't show up.** Game-night cancellations are silence, not data. Saga's per-player fun model can only train on completed nights for a player; preferences about whether to play AT ALL are out of scope.
- **Games not played.** A game in the candidate pool that no group has played has zero training signal. Saga falls back to BGG-prior-only outcome parameters; the resulting predictions have wide variance bands.
- **Lying recaps.** A player who rates fun 5 to flatter the host but actually had a 2-fun night corrupts the training corpus. Mitigation: detect via consistency vs. engagement_during_play (a 5-fun + 1-engagement pair is a flag); flag for manual review; weight that record down.
- **Group composition shifts.** A group whose membership changes nightly is hard to model as a stable group. Saga v1 models per-player and per-game; group-level modeling is v1.5+.
- **Memory drift.** Recaps filled 2 weeks after the night are less reliable than recaps filled day-of. Saga can weight records by recency-of-recap-filling; per-record recency timestamp comes from the recap store's edit log.

For each, the response is to log the quality issue, weight the record appropriately, and surface "low confidence" in the prediction's variance metadata. Saga must not pretend confidence it doesn't have.

## Privacy + retention

Per Sprint 1.0.13 §"Hard requirements" point 6, recap data carries a privacy disclosure. Saga's training pipeline:

- Reads recap data on a per-store basis. Cross-store training is yggdrasil's domain (federated cross-store engine, future).
- Per-player parameters are stored at the platform level (a player who plays at multiple stores has their fun model trained on their combined data, with their consent per the disclosure).
- Recap data is retained per the platform retention policy (consult `apps/me`'s privacy spec when it lands).
- Right-to-deletion: when a user requests deletion, their `player_id`'s rows are removed from saga's training corpus and per-player params are dropped. Retraining at the next monthly cadence reflects the deletion. Population params are not affected by individual deletions.

## What this document does NOT specify

- **Recap UI surface design.** That's HQ's domain; saga only cares about the field-level data contract.
- **Recap data store schema.** That's the recap data spec (`../mimir/docs/recap-data-spec.md`).
- **Cross-store federation.** That's yggdrasil.
- **Real-time prediction pipeline.** That's `simulator-architecture.md`.
