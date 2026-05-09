/**
 * Heimdall — recommendation orchestrator (v0.1, stub).
 *
 * Watcher at the bridge of the gods. Sees what's available for a given
 * recommendation request, calls the eligible engines, threads outputs
 * between them, returns a unified ranking.
 *
 * v0.1 scope (today):
 *   - One callable engine that has data: seidr (225 game profiles, can
 *     match a player profile via cosine similarity).
 *   - Mimir is wired but its data layer (rec_game) isn't populated yet —
 *     calling it would return an empty pool, so it's not yet exercised.
 *   - Huginn + saga aren't activated (data thresholds unmet).
 *   - Composition is therefore trivial: pass-through to seidr when a
 *     player profile is supplied, empty result otherwise.
 *
 * v0.2+ (as engines come online):
 *   - Mimir runs in parallel once rec_game has BGG metadata.
 *   - Huginn runs once players have ≥5 edges.
 *   - Saga runs once recap data exists.
 *   - The dispatch logic here grows from "call seidr" to "run all eligible
 *     engines, compose outputs by confidence-weighted ensemble".
 *
 * Lives in apps/me because Passport is the natural caller and the source
 * of player identity/profile data. Per HEIMDALL.md, may move to
 * packages/heimdall/ later if cross-app callers need it.
 */

import {
  loadGameProfiles,
  loadPlayerProfile,
  type DimVector,
  type SeidrPlayerProfile,
  type SeidrGameProfile,
} from './load';

// Local copy of the canonical seidr matcher. The original lives in
// rec-engines/seidr/src/match.mjs (283 tests, hand-tuned over 30
// sprints). Copied verbatim into apps/me/lib/heimdall/ on 2026-05-09
// because Vercel's bundler couldn't resolve cross-tree .mjs imports
// reliably under the apps/me Root Directory config.
//
// Source of truth: still rec-engines/seidr/src/match.mjs. Sync this
// file when the canonical matcher changes (no automated process yet —
// add a CI check or a sync script when seidr v2 lands).
//
// What we get vs the previous inline cosine:
//   - MMR diversification (the bigger win for perceived quality —
//     avoids 5 same-vibe games clustering at the top)
//   - Designer cap (max 2 games per designer)
//   - Confidence-weighted cosine (low-confidence dims contribute less)
//   - Player-count filtering when bggMetadata is supplied
//
import { match as canonicalSeidrMatch } from './seidr-match.mjs';
/**
 * One contributing dimension's role in the cosine score. The contribution
 * is the un-normalized term that adds to the dot product (player × game).
 *
 * `kind` tells the UI how to phrase it:
 *   - `agree_high`: both player AND game are positive on this dim ("you both like X")
 *   - `agree_low`: both player AND game are negative ("you both avoid X")
 *   - `disagree`:  player + game are on opposite sides (negative term — drags the score down)
 *   - `neutral`:   one or both are near zero (small term either way)
 */
export interface DimContribution {
  dim: string;
  contribution: number;
  player: number;
  game: number;
  kind: 'agree_high' | 'agree_low' | 'disagree' | 'neutral';
}

function classifyContribution(player: number, game: number): DimContribution['kind'] {
  const NEAR_ZERO = 0.15;
  if (Math.abs(player) < NEAR_ZERO || Math.abs(game) < NEAR_ZERO) return 'neutral';
  if (player > 0 && game > 0) return 'agree_high';
  if (player < 0 && game < 0) return 'agree_low';
  return 'disagree';
}

/**
 * Wrap the canonical seidr.match() and re-build our DimContribution shape
 * (which encodes player vs game value alongside the contribution magnitude
 * — needed for the agree_high/agree_low/disagree classification).
 *
 * The seidr matcher returns contributingDims as { dim, contribution }
 * sorted top-5 by absolute magnitude. We re-look-up the player + game
 * values per dim to classify each.
 */
interface SeidrRecommendation {
  game_id: number;
  score: number;
  topContributions: DimContribution[];
}

interface SeidrCanonicalRecommendation {
  game_id: number;
  score: number;
  cosineSimilarity: number;
  unweightedCosine: number;
  contributingDims: Array<{ dim: string; contribution: number }>;
  dimsConsidered: number;
  normalizedScore?: number;
}

function runSeidr(
  player: SeidrPlayerProfile,
  games: SeidrGameProfile[],
  options: { limit: number; excludeGameIds?: number[]; topDims?: number },
): {
  recommendations: SeidrRecommendation[];
  filtered: Array<{ game_id: number; reason: string }>;
  totalConsidered: number;
} {
  const topDims = options.topDims ?? 3;
  const result = canonicalSeidrMatch(player, games, {
    limit: options.limit,
    excludeGameIds: options.excludeGameIds ?? [],
    diversify: true,
    useConfidence: true,
  }) as {
    recommendations: SeidrCanonicalRecommendation[];
    filtered: Array<{ game_id: number; reason: string }>;
    totalConsidered: number;
  };

  const playerVec = player.dim_vector ?? {};
  const gamesById = new Map<number, SeidrGameProfile>();
  for (const g of games) gamesById.set(g.game_id, g);

  const recommendations: SeidrRecommendation[] = result.recommendations.map((r) => {
    const game = gamesById.get(r.game_id);
    const gameVec = game?.dim_vector ?? {};
    const enriched: DimContribution[] = (r.contributingDims ?? []).map((c) => {
      const pv = numericOr(playerVec[c.dim], 0);
      const gv = numericOr(gameVec[c.dim], 0);
      return {
        dim: c.dim,
        contribution: c.contribution,
        player: pv,
        game: gv,
        kind: classifyContribution(pv, gv),
      };
    });
    return {
      game_id: r.game_id,
      score: r.score,
      topContributions: enriched.filter((c) => c.kind !== 'neutral').slice(0, topDims),
    };
  });

  return {
    recommendations,
    filtered: result.filtered,
    totalConsidered: result.totalConsidered,
  };
}

function numericOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export interface RecommendRequest {
  /**
   * Caller's identification of the player. If provided AND the player
   * has a saved seidr profile, we'll fetch and use it.
   */
  playerId?: string;
  /**
   * Inline player profile (24-dim vector). Used when the caller has the
   * profile in hand and doesn't want a DB lookup, or for cold-start
   * preview ("show me what someone with this profile would get").
   *
   * Shape: a flat dim id → number map, e.g. { PSY_ACHIEVEMENT: 0.6, ... }.
   * Heimdall wraps it in seidr's expected {dim_vector, confidence_vector}
   * shape internally; callers don't need to.
   */
  playerProfile?: DimVector;
  /**
   * Caller-controlled context. Passed through to engines that consume it.
   * Today only `playerCount` (filter by range) and `excludeGameIds` are
   * honored by seidr. Future engines will use more.
   */
  context?: {
    playerCount?: number;
    excludeGameIds?: number[];
  };
  /**
   * Top-K to return. Defaults to 12.
   */
  limit?: number;
}

export interface RecommendedGame {
  gameId: number;
  score: number;
  /**
   * Per-engine contributions to the final score. Today only seidr
   * contributes; future versions will show mimir / huginn / saga
   * weights too.
   */
  contributions: {
    seidr?: number;
    mimir?: number;
    huginn?: number;
    saga?: number;
  };
  /**
   * Top dimensions that drove the seidr match. Lets the UI explain
   * "why this game" without needing the user to know the game
   * itself — they can grade the *logic* by seeing which dimensions
   * aligned. Empty when no engine that produces dim contributions
   * ran.
   */
  topDimContributions?: DimContribution[];
  /**
   * Optional human-readable explanation. Future: aggregate of per-engine
   * explanations.
   */
  explanation?: string;
}

export interface RecommendResponse {
  /**
   * Ranked games, top-K by aggregate score. Length may be < limit if the
   * candidate pool is smaller.
   */
  recommendations: RecommendedGame[];
  /**
   * Engines that ran and contributed to the result. Useful for debugging
   * and for callers that want to know which signals fired.
   */
  enginesRan: Array<'mimir' | 'seidr' | 'huginn' | 'saga'>;
  /**
   * Engines that were eligible but didn't run (e.g. data not ready).
   * Helps callers understand the recommendation's depth.
   */
  enginesSkipped: Array<{ name: string; reason: string }>;
  /**
   * Total candidate games considered before ranking + filtering.
   */
  candidatesConsidered: number;
}

const DEFAULT_LIMIT = 12;

export async function recommendGames(req: RecommendRequest): Promise<RecommendResponse> {
  const limit = req.limit ?? DEFAULT_LIMIT;
  const enginesRan: RecommendResponse['enginesRan'] = [];
  const enginesSkipped: RecommendResponse['enginesSkipped'] = [];

  // Resolve the player profile into seidr's expected shape.
  let playerProfile: SeidrPlayerProfile | null = null;
  if (req.playerProfile) {
    playerProfile = { dim_vector: req.playerProfile };
  } else if (req.playerId) {
    playerProfile = await loadPlayerProfile(req.playerId);
  }

  // Mimir eligibility: needs rec_game data to be populated (it isn't yet).
  // Skip for now; flip on once BGG fetch lands.
  enginesSkipped.push({ name: 'mimir', reason: 'rec_game not yet populated' });

  // Huginn eligibility: needs ≥5 edges in rec_edge for this player.
  // Skip for v0.1 — checking the threshold is straightforward but we don't
  // exercise it until huginn's matcher is implemented.
  enginesSkipped.push({ name: 'huginn', reason: 'phase-1 — not yet implemented' });

  // Saga eligibility: needs ≥3000 recap rows for the per-player fun model.
  enginesSkipped.push({ name: 'saga', reason: 'phase-2 — needs ≥3000 recaps' });

  // Seidr is the only engine with both code and data today. Skip when
  // there's no player profile to match against — seidr has no cold-start
  // story (that's mimir's job).
  if (!playerProfile) {
    enginesSkipped.push({ name: 'seidr', reason: 'no player profile available' });
    return {
      recommendations: [],
      enginesRan,
      enginesSkipped,
      candidatesConsidered: 0,
    };
  }

  const gameProfiles: SeidrGameProfile[] = await loadGameProfiles();
  const seidrResult = runSeidr(playerProfile, gameProfiles, {
    limit,
    excludeGameIds: req.context?.excludeGameIds ?? [],
    topDims: 3,
  });
  enginesRan.push('seidr');

  // v0.1 composition: trivially adopt seidr's ranking. v0.2 will weight
  // multiple engines' contributions via confidence-aware ensemble.
  const recommendations: RecommendedGame[] = seidrResult.recommendations
    .slice(0, limit)
    .map((r) => ({
      gameId: r.game_id,
      score: r.score,
      contributions: { seidr: r.score },
      topDimContributions: r.topContributions,
    }));

  return {
    recommendations,
    enginesRan,
    enginesSkipped,
    candidatesConsidered: seidrResult.totalConsidered,
  };
}
