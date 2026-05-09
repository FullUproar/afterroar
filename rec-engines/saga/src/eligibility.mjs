// eligibility.mjs
// ============================================================================
// Saga activation gate. Saga's predictive power is bounded above by the
// volume + quality of recap data — running the simulator with too few
// observations produces noise, not insight. Per saga/README.md and
// docs/recap-as-training-data.md, the activation thresholds are:
//
//   - ≥3000 per-player observations in rec_saga_per_player_observation
//   - ≥200 unique players represented across those observations
//   - ≥6 months between earliest + latest observation (so seasonal
//     coverage isn't trivially short)
//
// All three must be true. The orchestrator calls checkSagaEligibility()
// before invoking match() — when the gate is closed, saga is reported
// as a skipped engine with the specific failing threshold.
//
// Pure read-only — never mutates. Cheap enough to call on every recs
// request (three single-row aggregates against indexed columns); a
// future micro-optimization could memoize for ~30s, but premature.
// ============================================================================

const MIN_OBSERVATIONS = 3000;
const MIN_UNIQUE_PLAYERS = 200;
const MIN_SPAN_DAYS = 180;

/**
 * @param {object} client - pg-compatible client with `.query(sql, params)`.
 *   Pass apps/me's prisma $queryRaw caller in a thin adapter, or a raw
 *   pg client directly. The function itself is db-driver-agnostic.
 * @returns {Promise<{
 *   eligible: boolean,
 *   reason: string | null,
 *   counts: { observations: number, uniquePlayers: number, spanDays: number },
 *   thresholds: { observations: number, uniquePlayers: number, spanDays: number }
 * }>}
 */
export async function checkSagaEligibility(client) {
  // Single round-trip: aggregate all three signals at once. Faster
  // than three separate counts, and cheap enough that latency isn't
  // a concern even at scale.
  const { rows } = await client.query(`
    SELECT
      COUNT(*)::int AS observations,
      COUNT(DISTINCT player_id)::int AS unique_players,
      COALESCE(
        EXTRACT(EPOCH FROM (
          MAX(o.played_at) - MIN(o.played_at)
        )) / 86400, 0
      )::int AS span_days
    FROM rec_saga_per_player_observation pp
    JOIN rec_saga_recap_observation o ON o.id = pp.recap_observation_id
    WHERE pp.superseded_by IS NULL
      AND o.superseded_by IS NULL
  `);

  const observations = rows[0]?.observations ?? 0;
  const uniquePlayers = rows[0]?.unique_players ?? 0;
  const spanDays = rows[0]?.span_days ?? 0;

  const counts = { observations, uniquePlayers, spanDays };
  const thresholds = {
    observations: MIN_OBSERVATIONS,
    uniquePlayers: MIN_UNIQUE_PLAYERS,
    spanDays: MIN_SPAN_DAYS,
  };

  if (observations < MIN_OBSERVATIONS) {
    return {
      eligible: false,
      reason: `phase-2 — needs ≥${MIN_OBSERVATIONS} per-player recap observations (have ${observations})`,
      counts,
      thresholds,
    };
  }
  if (uniquePlayers < MIN_UNIQUE_PLAYERS) {
    return {
      eligible: false,
      reason: `phase-2 — needs observations from ≥${MIN_UNIQUE_PLAYERS} unique players (have ${uniquePlayers})`,
      counts,
      thresholds,
    };
  }
  if (spanDays < MIN_SPAN_DAYS) {
    return {
      eligible: false,
      reason: `phase-2 — needs ≥${MIN_SPAN_DAYS}d span between earliest + latest observation (have ${spanDays}d)`,
      counts,
      thresholds,
    };
  }

  return { eligible: true, reason: null, counts, thresholds };
}

export const SAGA_THRESHOLDS = {
  MIN_OBSERVATIONS,
  MIN_UNIQUE_PLAYERS,
  MIN_SPAN_DAYS,
};
