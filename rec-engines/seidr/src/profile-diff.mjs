// profile-diff.mjs
// ============================================================================
// Pure functions: compare two game-profile sets and surface dimensional
// differences.
//
// Use cases:
//   1. Calibration drift detection: when the eventual top-500 LLM-API run
//      regenerates profiles, diff against the hand-authored seed corpus
//      to see what shifted. Large deltas flag prompt-iteration needs.
//   2. Profile version comparison: when seidr's corpus is updated (new
//      games, refined dimensions, etc.), diff old-vs-new to audit the
//      delta before committing.
//   3. Reference-vs-corpus consistency: ensure the 7 reference profiles
//      remain consistent with their counterparts in the seed corpus.
//
// Pure functions. No I/O. Deterministic.
// ============================================================================

const DEFAULT_SIGNIFICANT_DELTA = 0.15;

/**
 * Diff two profiles for the same game. Returns per-dimension deltas plus
 * a summary score.
 *
 * @param {object} profileA  - first profile (the "from" / baseline)
 * @param {object} profileB  - second profile (the "to" / new)
 * @param {object} [options]
 *   - significantDelta: number (default 0.15) — threshold above which a
 *     dimension is flagged as "drifted significantly"
 * @returns {object} {
 *     game_id,
 *     l2_distance,           // root-sum-square delta across all dims
 *     mean_abs_delta,        // average |delta|
 *     max_abs_delta,         // worst single-dim delta
 *     significant_dims,      // [{dim, from, to, delta}] sorted by |delta|
 *     all_dims,              // full per-dim delta map
 *   }
 *
 * Throws if the profiles disagree on game_id or dim_vector keys.
 */
export function diffProfile(profileA, profileB, options = {}) {
  if (!profileA || !profileB) {
    throw new Error('diffProfile: both profileA and profileB required');
  }
  if (profileA.game_id !== profileB.game_id) {
    throw new Error(
      `diffProfile: game_id mismatch (A=${profileA.game_id}, B=${profileB.game_id}). ` +
        'Use diffCorpora() for set-level diffs across many games.'
    );
  }

  const dvA = profileA.dim_vector || {};
  const dvB = profileB.dim_vector || {};
  const keysA = new Set(Object.keys(dvA));
  const keysB = new Set(Object.keys(dvB));

  // Symmetric-difference check: either side missing dims is a fatal mismatch
  for (const k of keysA) {
    if (!keysB.has(k)) throw new Error(`diffProfile: profileB missing dim ${k}`);
  }
  for (const k of keysB) {
    if (!keysA.has(k)) throw new Error(`diffProfile: profileA missing dim ${k}`);
  }

  const significantDelta = options.significantDelta ?? DEFAULT_SIGNIFICANT_DELTA;

  const allDims = {};
  const significantList = [];
  let sumSq = 0;
  let sumAbs = 0;
  let maxAbs = 0;
  let n = 0;

  for (const dim of keysA) {
    const a = numberOr(dvA[dim], 0);
    const b = numberOr(dvB[dim], 0);
    const delta = b - a;
    const absDelta = Math.abs(delta);
    allDims[dim] = { from: a, to: b, delta };
    sumSq += delta * delta;
    sumAbs += absDelta;
    if (absDelta > maxAbs) maxAbs = absDelta;
    if (absDelta >= significantDelta) {
      significantList.push({ dim, from: a, to: b, delta });
    }
    n++;
  }

  significantList.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    game_id: profileA.game_id,
    l2_distance: Math.sqrt(sumSq),
    mean_abs_delta: n === 0 ? 0 : sumAbs / n,
    max_abs_delta: maxAbs,
    significant_dims: significantList,
    all_dims: allDims,
  };
}

/**
 * Diff two corpora. Aligns profiles by game_id; reports games that exist
 * in only one corpus separately.
 *
 * @param {Array} corpusA  - array of profile objects
 * @param {Array} corpusB  - array of profile objects
 * @param {object} [options]  - forwarded to diffProfile
 * @returns {object} {
 *     diffs,                 // per-game diff results, sorted by l2_distance desc
 *     only_in_a,             // game_ids present only in corpusA
 *     only_in_b,             // game_ids present only in corpusB
 *     summary: {
 *       total_in_both,
 *       mean_l2_distance,
 *       max_l2_distance,
 *       games_with_significant_drift,  // count where any significant_dim
 *     }
 *   }
 */
export function diffCorpora(corpusA, corpusB, options = {}) {
  if (!Array.isArray(corpusA)) throw new Error('diffCorpora: corpusA must be an array');
  if (!Array.isArray(corpusB)) throw new Error('diffCorpora: corpusB must be an array');

  const byIdA = new Map(corpusA.filter(p => p?.game_id != null).map(p => [p.game_id, p]));
  const byIdB = new Map(corpusB.filter(p => p?.game_id != null).map(p => [p.game_id, p]));

  const onlyInA = [];
  const onlyInB = [];
  const diffs = [];

  for (const [id, pA] of byIdA) {
    const pB = byIdB.get(id);
    if (!pB) {
      onlyInA.push(id);
      continue;
    }
    diffs.push(diffProfile(pA, pB, options));
  }
  for (const [id] of byIdB) {
    if (!byIdA.has(id)) onlyInB.push(id);
  }

  diffs.sort((a, b) => b.l2_distance - a.l2_distance);

  const meanL2 = diffs.length === 0 ? 0
    : diffs.reduce((s, d) => s + d.l2_distance, 0) / diffs.length;
  const maxL2 = diffs.length === 0 ? 0
    : diffs.reduce((m, d) => Math.max(m, d.l2_distance), 0);
  const driftCount = diffs.filter(d => d.significant_dims.length > 0).length;

  return {
    diffs,
    only_in_a: onlyInA,
    only_in_b: onlyInB,
    summary: {
      total_in_both: diffs.length,
      mean_l2_distance: meanL2,
      max_l2_distance: maxL2,
      games_with_significant_drift: driftCount,
    },
  };
}

function numberOr(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
