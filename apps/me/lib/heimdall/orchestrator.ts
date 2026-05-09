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

/**
 * Inline cosine matcher. Self-contained replacement for the seidr
 * package's full match() during Phase 0 — runs in Vercel's Next.js
 * runtime without any cross-tree .mjs import (which was hitting build
 * cache + bundler issues). The full seidr matcher (with MMR diversity,
 * designer cap, player-count filter, confidence weighting) is still
 * the source of truth in rec-engines/; this is the simplest correct
 * subset for the public quiz flow.
 *
 * v0.2 will switch to importing the canonical seidr matcher once
 * we've moved the engines into a proper packages/* workspace path
 * and out of rec-engines/* (which Vercel's Root Directory excludes
 * from the build sandbox in some configs).
 */
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

interface InlineRecommendation {
  game_id: number;
  score: number;
  topContributions: DimContribution[];
}

function seidrMatchInline(
  player: SeidrPlayerProfile,
  games: SeidrGameProfile[],
  options: { limit: number; excludeGameIds?: number[]; topDims?: number },
): {
  recommendations: InlineRecommendation[];
  filtered: Array<{ game_id: number; reason: string }>;
  totalConsidered: number;
} {
  const exclude = new Set(options.excludeGameIds ?? []);
  const topDims = options.topDims ?? 3;
  const filtered: Array<{ game_id: number; reason: string }> = [];
  const scored: InlineRecommendation[] = [];
  const pVec = player.dim_vector ?? {};

  let totalConsidered = 0;
  for (const g of games) {
    if (g.game_id == null) continue;
    if (exclude.has(g.game_id)) {
      filtered.push({ game_id: g.game_id, reason: 'excluded' });
      continue;
    }
    totalConsidered++;
    const result = cosineWithContributions(pVec, g.dim_vector);
    if (result === null) continue;
    scored.push({
      game_id: g.game_id,
      score: result.cosine,
      topContributions: result.contributions
        // Filter out neutrals so the UI explanation prioritizes
        // dimensions where both sides actually had a stake.
        .filter((c) => c.kind !== 'neutral')
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
        .slice(0, topDims),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return {
    recommendations: scored.slice(0, options.limit),
    filtered,
    totalConsidered,
  };
}

function cosineWithContributions(
  a: DimVector,
  b: DimVector,
): { cosine: number; contributions: DimContribution[] } | null {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const contributions: DimContribution[] = [];
  const seen = new Set<string>();

  for (const k of Object.keys(a)) {
    seen.add(k);
    const av = numericOr(a[k], 0);
    const bv = numericOr(b[k], 0);
    const term = av * bv;
    dot += term;
    na += av * av;
    nb += bv * bv;
    if (term !== 0) {
      contributions.push({
        dim: k,
        contribution: term,
        player: av,
        game: bv,
        kind: classifyContribution(av, bv),
      });
    }
  }
  for (const k of Object.keys(b)) {
    if (seen.has(k)) continue;
    const bv = numericOr(b[k], 0);
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) {
    return { cosine: 0, contributions };
  }
  let c = dot / (Math.sqrt(na) * Math.sqrt(nb));
  if (c > 1) c = 1;
  if (c < -1) c = -1;
  return { cosine: c, contributions };
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
  const seidrResult = seidrMatchInline(playerProfile, gameProfiles, {
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
