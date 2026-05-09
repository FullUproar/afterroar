/**
 * POST /api/recs/games
 *
 * Recommendation endpoint — the public face of Heimdall. Callers
 * (HQ, FU site, Store Ops) hit this with a recommendation request and
 * get back a ranked list. Internal logic decides which engines to run.
 *
 * Auth: API key with `recs:read` scope.
 *
 * Two modes selected by request body shape:
 *
 * SINGLE-PLAYER (existing): one of `player_id` or `player_profile`.
 *   Body: { player_id?, player_profile?, context?, limit? }
 *   Response.mode = 'single'.
 *
 * GROUP (new): `player_ids: string[]` — Passport user ids of the group.
 *   Body: { player_ids[], aggregation?, context?, limit? }
 *   Each candidate game is scored independently against every player
 *   with a saved profile, then aggregated cross-player. Default
 *   aggregation is 'min' (egalitarian — find the game where the
 *   least-happy player is happiest); 'mean' is exposed for callers
 *   that want the utilitarian view (the trap, but documented). Player-
 *   count filter defaults to group size. Players without a saved
 *   profile are returned in `players_skipped`.
 *   Response.mode = 'group', adds per_player_scores + score_spread
 *   per rec + players_resolved + players_skipped.
 *
 * Response (single mode): {
 *   mode: 'single',
 *   recommendations: [{
 *     game_id, game_name, year, subdomain, categories, description,
 *     min_players, max_players, playing_time, score, rank,
 *     contributions, top_dim_contributions, all_dim_contributions, explanation?
 *   }],
 *   engines_ran, engines_skipped, candidates_considered
 * }
 *
 * Response (group mode): same as single, plus per rec:
 *   per_player_scores: [{ playerId, score }],
 *   group_aggregate_score: number,
 *   score_spread: number,           // max - min, surfaces polarizing picks
 * Plus top-level: aggregation, players_resolved, players_skipped.
 *
 * v0.1 — only seidr produces recommendations. Mimir/huginn/saga return
 * empty until data thresholds are met. As they come online (saga in
 * particular for proper group dynamics), this endpoint stays the same;
 * Heimdall starts incorporating them silently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiKey } from '@/lib/api-middleware';
import {
  recommendGames,
  recommendForGroup,
  type RecommendRequest,
  type GroupRecommendRequest,
} from '@/lib/heimdall/orchestrator';
import { enrichRec, enrichRecs } from '@/lib/heimdall/enrich';

const MAX_LIMIT = 50;
const VALID_AGGREGATIONS = new Set(['min', 'mean']);

interface RawBody {
  // Single-player mode: at most one of player_id / player_profile.
  player_id?: string;
  player_profile?: Record<string, number>;
  // Group mode: array of Passport user ids. When present, switches the
  // route into group recommendation (per-game aggregation across players).
  player_ids?: string[];
  /**
   * Group aggregation strategy. 'min' (default, egalitarian) finds the
   * game where the worst-off player is happiest. 'mean' (utilitarian)
   * is exposed but documented as the trap. Ignored unless player_ids set.
   */
  aggregation?: 'min' | 'mean';
  context?: {
    player_count?: number;
    exclude_game_ids?: number[];
  };
  limit?: number;
}

type ValidatedRequest =
  | { mode: 'single'; req: RecommendRequest }
  | { mode: 'group'; req: GroupRecommendRequest };

function validate(body: unknown): { ok: true; v: ValidatedRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object.' };
  const b = body as RawBody;

  // Single-player vs group mode is determined by presence of player_ids.
  // Mutually exclusive with player_id / player_profile (a group already
  // resolves identities by playerIds[]; mixing the two is ambiguous).
  const isGroup = Array.isArray(b.player_ids);
  if (isGroup) {
    if (b.player_id !== undefined || b.player_profile !== undefined) {
      return { ok: false, error: 'player_ids cannot be combined with player_id or player_profile.' };
    }
    if (b.player_ids!.length === 0) {
      return { ok: false, error: 'player_ids must not be empty.' };
    }
    for (const id of b.player_ids!) {
      if (typeof id !== 'string' || id.length === 0) {
        return { ok: false, error: 'player_ids entries must be non-empty strings.' };
      }
    }
    if (b.aggregation !== undefined && !VALID_AGGREGATIONS.has(b.aggregation)) {
      return { ok: false, error: 'aggregation must be one of: min, mean.' };
    }
  } else {
    // Either player_id or player_profile is OK, or neither (returns empty
    // recommendations + skip-reasons so callers can show "take the quiz" prompts).
    if (b.player_id !== undefined && typeof b.player_id !== 'string') {
      return { ok: false, error: 'player_id must be a string.' };
    }
    if (b.player_profile !== undefined) {
      if (typeof b.player_profile !== 'object' || b.player_profile === null) {
        return { ok: false, error: 'player_profile must be an object.' };
      }
      for (const [k, v] of Object.entries(b.player_profile)) {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          return { ok: false, error: `player_profile.${k} must be a finite number.` };
        }
      }
    }
  }

  if (b.limit !== undefined && (!Number.isInteger(b.limit) || b.limit < 1 || b.limit > MAX_LIMIT)) {
    return { ok: false, error: `limit must be an integer in [1, ${MAX_LIMIT}].` };
  }
  if (b.context !== undefined) {
    if (typeof b.context !== 'object' || b.context === null) {
      return { ok: false, error: 'context must be an object.' };
    }
    const ctx = b.context;
    if (ctx.player_count !== undefined && (!Number.isInteger(ctx.player_count) || ctx.player_count < 1)) {
      return { ok: false, error: 'context.player_count must be a positive integer.' };
    }
    if (ctx.exclude_game_ids !== undefined) {
      if (!Array.isArray(ctx.exclude_game_ids)) {
        return { ok: false, error: 'context.exclude_game_ids must be an array.' };
      }
      for (const id of ctx.exclude_game_ids) {
        if (!Number.isInteger(id)) {
          return { ok: false, error: 'context.exclude_game_ids entries must be integers.' };
        }
      }
    }
  }

  if (isGroup) {
    return {
      ok: true,
      v: {
        mode: 'group',
        req: {
          playerIds: b.player_ids!,
          aggregation: b.aggregation,
          context: b.context
            ? { playerCount: b.context.player_count, excludeGameIds: b.context.exclude_game_ids }
            : undefined,
          limit: b.limit,
        },
      },
    };
  }

  return {
    ok: true,
    v: {
      mode: 'single',
      req: {
        playerId: b.player_id,
        playerProfile: b.player_profile,
        context: b.context
          ? { playerCount: b.context.player_count, excludeGameIds: b.context.exclude_game_ids }
          : undefined,
        limit: b.limit,
      },
    },
  };
}

export const POST = withApiKey<Record<string, never>>(async (req: NextRequest) => {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const validated = validate(parsed);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  if (validated.v.mode === 'group') {
    const result = await recommendForGroup(validated.v.req);
    // Group response: each rec carries the per-player score breakdown
    // and the spread, alongside the same enriched BGG metadata as the
    // single-player path. Caller can render "Alice 0.7, Bob 0.6, Carol
    // 0.4 → group min = 0.4" and decide how to surface polarizing picks.
    return NextResponse.json({
      mode: 'group',
      aggregation: result.aggregation,
      recommendations: result.recommendations.map((g, idx) => ({
        ...enrichRec(g, idx),
        per_player_scores: g.perPlayerScores,
        group_aggregate_score: g.groupAggregateScore,
        score_spread: g.scoreSpread,
      })),
      players_resolved: result.playersResolved,
      players_skipped: result.playersSkipped,
      engines_ran: result.enginesRan,
      engines_skipped: result.enginesSkipped,
      candidates_considered: result.candidatesConsidered,
    });
  }

  const result = await recommendGames(validated.v.req);
  return NextResponse.json({
    mode: 'single',
    recommendations: enrichRecs(result.recommendations),
    engines_ran: result.enginesRan,
    engines_skipped: result.enginesSkipped,
    candidates_considered: result.candidatesConsidered,
  });
}, 'recs:read');
