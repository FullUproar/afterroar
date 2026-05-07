/**
 * POST /api/recs/games
 *
 * Recommendation endpoint — the public face of Heimdall. Callers
 * (HQ, FU site, Store Ops) hit this with a recommendation request and
 * get back a ranked list. Internal logic decides which engines to run.
 *
 * Auth: API key with `recs:read` scope.
 *
 * Body: {
 *   player_id?: string                   // resolves to a saved seidr profile if present
 *   player_profile?: Record<string, number>  // inline 24-dim vector (cold-start preview, etc)
 *   context?: {
 *     player_count?: number              // filter games whose range excludes this
 *     exclude_game_ids?: number[]
 *   }
 *   limit?: number                       // default 12, capped at 50
 * }
 *
 * Response: {
 *   recommendations: [{ game_id, score, contributions, explanation? }],
 *   engines_ran: [...],
 *   engines_skipped: [{ name, reason }],
 *   candidates_considered: number
 * }
 *
 * v0.1 — only seidr produces recommendations (it's the only engine with
 * data today). Mimir/huginn/saga return empty until their data thresholds
 * are met. As they come online, this endpoint stays the same; Heimdall
 * starts incorporating them silently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiKey } from '@/lib/api-middleware';
import { recommendGames, type RecommendRequest } from '@/lib/heimdall/orchestrator';

const MAX_LIMIT = 50;

interface RawBody {
  player_id?: string;
  player_profile?: Record<string, number>;
  context?: {
    player_count?: number;
    exclude_game_ids?: number[];
  };
  limit?: number;
}

function validate(body: unknown): { ok: true; req: RecommendRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object.' };
  const b = body as RawBody;

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

  return {
    ok: true,
    req: {
      playerId: b.player_id,
      playerProfile: b.player_profile,
      context: b.context
        ? {
            playerCount: b.context.player_count,
            excludeGameIds: b.context.exclude_game_ids,
          }
        : undefined,
      limit: b.limit,
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

  const v = validate(parsed);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const result = await recommendGames(v.req);

  return NextResponse.json({
    recommendations: result.recommendations.map((r) => ({
      game_id: r.gameId,
      score: r.score,
      contributions: r.contributions,
      explanation: r.explanation,
    })),
    engines_ran: result.enginesRan,
    engines_skipped: result.enginesSkipped,
    candidates_considered: result.candidatesConsidered,
  });
}, 'recs:read');
