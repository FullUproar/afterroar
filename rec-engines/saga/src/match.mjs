// match.mjs
// ============================================================================
// Saga's top-level entry point. Mirrors seidr/src/match.mjs in shape so
// the orchestrator can call it uniformly. CURRENTLY DORMANT.
//
// Per saga/README.md and docs/, the engine doesn't activate until recap
// observation thresholds are met (see eligibility.mjs). Until then,
// match() returns an empty result + a clear "phase-2" reason. The
// orchestrator already handles this gracefully — saga is reported as
// a skipped engine, single-player and group recs proceed via seidr.
//
// When activation arrives, this file's TODOs become the implementation
// plan. The signature stays stable; consumers don't need changes.
//
// ----------------------------------------------------------------------------
// IMPLEMENTATION SKETCH (post-activation):
//
// 1. For each candidate game:
//    - Pull the per-game outcome model from rec_saga_game_outcome_model
//      (its current model_version where superseded=false). If missing,
//      fall back to the BGG-prior model (game weight + mechanic-family
//      derived defaults — won't match a fitted model but better than
//      excluding the candidate).
//
// 2. For each player in the group:
//    - Pull the per-player fun model from rec_saga_player_fun_model
//      (current version where superseded=false). If missing for a player,
//      fall back to the population-average model — saga still runs but
//      uncertainty is wider (surface that uncertainty in the response).
//
// 3. Run N simulations per (candidate, group, context). N starts at 200
//    per the latency budget in docs/simulator-architecture.md; tune up
//    if the response time budget allows once we have real numbers.
//
// 4. Aggregate the simulation distribution into a recommendation:
//    - aggregator='egalitarian_p_everyone_happy' default — P(every
//      player's fun ≥ 3.5)
//    - 'expected_min_fun' — E[min(fun across players)]
//    - 'utilitarian_expected_sum' — E[sum(fun)] — the trap, but documented
//
// 5. Return ranked candidates with full distribution snippets so HQ can
//    surface "everyone is 95% likely to have fun" vs "high expected
//    fun but Bob has a 30% chance of being miserable."
// ============================================================================

import { checkSagaEligibility } from './eligibility.mjs';

/**
 * @param {object} req - {
 *   playerProfiles: Array<{ playerId, dimVector, ... }>  // saga's own profile shape
 *     // (NOT seidr profile — saga consumes per-player fun model, fitted from recap data)
 *   candidateGameIds: number[],
 *   context?: object,                   // play_context shape per docs
 *   limit?: number,
 *   aggregator?: 'egalitarian_p_everyone_happy' | 'expected_min_fun' | 'utilitarian_expected_sum',
 *   simulationsPerCandidate?: number,
 * }
 * @param {object} pgClient - pg-compatible client. Used for the eligibility
 *   check + (post-activation) for loading the per-player + per-game models.
 * @returns {Promise<{
 *   eligible: boolean,
 *   reason: string | null,
 *   recommendations: Array<{
 *     gameId: number,
 *     aggregateScore: number,
 *     pEveryoneHappy: number,
 *     perPlayerExpectedFun: Array<{ playerId, mean, std, p10, p90 }>,
 *   }>,
 * }>}
 */
export async function match(req, pgClient) {
  const eligibility = await checkSagaEligibility(pgClient);
  if (!eligibility.eligible) {
    return {
      eligible: false,
      reason: eligibility.reason,
      recommendations: [],
      // Surface the live counts so callers/operators can see how close
      // we are to activation without re-querying.
      progress: eligibility.counts,
      thresholds: eligibility.thresholds,
    };
  }

  // POST-ACTIVATION IMPLEMENTATION GOES HERE.
  // For now we throw — eligibility gate above prevents this from running
  // in production. The throw exists so a future contributor can't
  // accidentally call match() with eligibility met but no implementation.
  throw new Error(
    'saga.match() is dormant — eligibility gate passed but the simulator is not yet implemented. ' +
      'See saga/docs/simulator-architecture.md for the build plan.',
  );
}
