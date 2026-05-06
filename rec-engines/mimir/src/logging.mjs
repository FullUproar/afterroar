// logging.mjs
// ============================================================================
// Mimir logging helpers. Pure functions that build row shapes for the
// rec_request_log, rec_candidate_log, rec_feedback_log, and
// rec_recap_outcome tables (per design doc § 7).
//
// These helpers are consumed by the future HTTP handler (Phase 1+) which
// will: call recommend(), build log rows, insert via pg, return the
// public response. Keeping the row construction pure (no DB) lets us
// unit-test the logging shape independently of any database.
//
// IMPORTANT (per design doc § 7.2): when wired up, the handler should
// log EVERY candidate considered, not just the top-K returned. This
// is required for offline eval and counterfactual training. The
// helpers below accept a flexible shape so the handler can pass
// whatever its candidate pipeline produces.
// ============================================================================

/**
 * Outcomes recognized by rec_feedback_log. Per design doc § 4.3.
 */
export const VALID_OUTCOMES = [
  'shown',
  'clicked',
  'accepted',
  'played',
  'rated',
  'bought',
  'dismissed',
  'ignored',
];

export function isValidOutcome(outcome) {
  return VALID_OUTCOMES.includes(outcome);
}

/**
 * Build a row for `rec_request_log`. Captures the full request context
 * + ranker version for offline eval.
 *
 * @param {Object} request - the RecommendRequest passed in
 * @param {Object} response - the RecommendResponse produced
 * @param {Object} [opts] - { ts? }
 * @returns row matching rec_request_log schema
 */
export function buildRequestLogRow(request, response, opts = {}) {
  return {
    request_id: response.request_id,
    ts: opts.ts || new Date().toISOString(),
    surface: request.surface || 'unknown',
    caller: request.caller || {},
    context: request.context || {},
    options: request.options || {},
    ranker_version: response.ranker_version,
  };
}

/**
 * Build rows for `rec_candidate_log`. Accepts either:
 *   - ranker output shape: { candidate, score, confidence, reasonCodes, breakdown }
 *   - recommend() results shape: { game_id, game_name, score, confidence,
 *       explanation: { reason_codes, ... }, diagnostics?: { score_breakdown } }
 *
 * The handler should pass ALL candidates considered (not just top-K)
 * for proper training-data capture per design doc § 7.2.
 *
 * @param {string} requestId - the request_id from the response
 * @param {Array} scoredCandidates - either shape, see above
 * @returns array of rec_candidate_log rows
 */
export function buildCandidateLogRows(requestId, scoredCandidates) {
  return (scoredCandidates || []).map((sc, idx) => {
    // Extract game_id from either shape
    const game_id = sc.candidate?.id ?? sc.game_id;
    const reason_codes = sc.reasonCodes ?? sc.explanation?.reason_codes ?? [];
    const score_breakdown =
      sc.breakdown ?? sc.diagnostics?.score_breakdown ?? null;

    return {
      request_id: requestId,
      game_id,
      rank: idx + 1,
      score: sc.score,
      confidence: sc.confidence ?? null,
      reason_codes,
      score_breakdown,
    };
  });
}

/**
 * Build a row for `rec_feedback_log`. Throws on invalid outcome to
 * catch typos at insertion time rather than silently logging garbage.
 *
 * @param {string} requestId
 * @param {number} gameId
 * @param {string} outcome - must be in VALID_OUTCOMES
 * @param {Object} [opts] - { outcome_value?, outcome_context?, ts? }
 * @returns row matching rec_feedback_log schema
 */
export function buildFeedbackLogRow(requestId, gameId, outcome, opts = {}) {
  if (!isValidOutcome(outcome)) {
    throw new Error(
      `Invalid feedback outcome "${outcome}". Must be one of: ${VALID_OUTCOMES.join(', ')}`
    );
  }
  return {
    request_id: requestId,
    game_id: gameId,
    ts: opts.ts || new Date().toISOString(),
    outcome,
    outcome_value: opts.outcome_value ?? null,
    outcome_context: opts.outcome_context ?? null,
  };
}

/**
 * Build a row for `rec_recap_outcome`. The simulator engine (saga,
 * future) trains on these. Fields are all optional to match the
 * design doc § 9 "recap UX should solicit but not require them."
 *
 * @param {Object} opts - { night_id, game_id, player_id, fun_rating?,
 *     would_play_again?, finished?, won?, notes? }
 * @returns row matching rec_recap_outcome schema
 */
export function buildRecapOutcomeRow(opts) {
  if (!opts || opts.night_id == null || opts.game_id == null || opts.player_id == null) {
    throw new Error(
      'buildRecapOutcomeRow: night_id, game_id, and player_id are required'
    );
  }
  return {
    night_id: opts.night_id,
    game_id: opts.game_id,
    player_id: opts.player_id,
    fun_rating: opts.fun_rating ?? null,
    would_play_again: opts.would_play_again ?? null,
    finished: opts.finished ?? null,
    won: opts.won ?? null,
    notes: opts.notes ?? null,
  };
}
