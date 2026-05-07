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

import { match as seidrMatch } from '@afterroar/rec-engine-seidr/match';
import {
  loadGameProfiles,
  loadPlayerProfile,
  type DimVector,
  type SeidrPlayerProfile,
  type SeidrGameProfile,
} from './load';

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
  const seidrResult = seidrMatch(playerProfile, gameProfiles, {
    limit: limit * 2, // pull a bigger pool, Heimdall could filter further later
    excludeGameIds: req.context?.excludeGameIds ?? [],
    playerCount: req.context?.playerCount ?? null,
    diversify: true,
  }) as {
    recommendations: Array<{ game_id: number; score: number; explanation?: string }>;
    filtered: Array<{ game_id: number; reason: string }>;
    totalConsidered: number;
  };
  enginesRan.push('seidr');

  // v0.1 composition: trivially adopt seidr's ranking. v0.2 will weight
  // multiple engines' contributions via confidence-aware ensemble.
  const recommendations: RecommendedGame[] = seidrResult.recommendations
    .slice(0, limit)
    .map((r) => ({
      gameId: r.game_id,
      score: r.score,
      contributions: { seidr: r.score },
      explanation: r.explanation,
    }));

  return {
    recommendations,
    enginesRan,
    enginesSkipped,
    candidatesConsidered: seidrResult.totalConsidered,
  };
}
