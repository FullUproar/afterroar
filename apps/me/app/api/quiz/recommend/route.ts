/**
 * POST /api/quiz/recommend
 *
 * Browser-callable recommendation endpoint for the seidr quiz UI at
 * /quiz. Anonymous-friendly (no auth) — the quiz runs entirely in the
 * user's browser and the recommendation request itself contains no PII.
 *
 * Server-to-server callers (HQ, FU site) should use /api/recs/games
 * with X-API-Key auth instead. This endpoint is for the public quiz UI
 * specifically.
 *
 * Body: {
 *   profile: Record<string, number>   // 24-dim flat vector from the quiz
 *   confidence?: Record<string, number>  // optional per-dim confidence
 *   limit?: number  // default 12
 * }
 *
 * Response: {
 *   recommendations: [{ game_id, game_name, score, contributions, explanation? }],
 *   engines_ran: [...],
 *   engines_skipped: [...],
 *   candidates_considered: number
 * }
 *
 * Anonymous access decision: pre-launch we want zero friction for trial.
 * No PII in the request, no mutation, the corpus is public-shippable
 * data anyway. Add rate limiting + auth before public launch.
 */

import { NextRequest, NextResponse } from 'next/server';
import { recommendGames } from '@/lib/heimdall/orchestrator';
import gameMeta from '@/lib/heimdall/game-meta.json';

const MAX_LIMIT = 24;

interface RawBody {
  profile?: Record<string, number>;
  confidence?: Record<string, number>;
  limit?: number;
  /**
   * Optional ephemeral profile delta. Keys are dim ids; values added to
   * the base profile before matching. Used by the "mood" cards in the
   * quiz UI: tap "🌶️ Spicy" → delta {SOC_COOP_COMP: -0.4} → recs lean
   * competitive without re-taking the quiz. Per-call only — we don't
   * persist deltas.
   */
  mood_delta?: Record<string, number>;
}

interface GameMetaEntry {
  name: string;
  year?: number | null;
  subdomain?: string | null;
  categories?: string[];
}

function metaFor(gameId: number): GameMetaEntry {
  const m = (gameMeta as Record<string, GameMetaEntry>)[String(gameId)];
  return m ?? { name: `Game #${gameId}` };
}

function applyMoodDelta(
  base: Record<string, number>,
  delta: Record<string, number> | undefined,
): Record<string, number> {
  if (!delta) return base;
  const out: Record<string, number> = { ...base };
  for (const [k, v] of Object.entries(delta)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const next = (out[k] ?? 0) + v;
    // Clamp to [-1, 1] — dim values live in that range.
    out[k] = Math.max(-1, Math.min(1, next));
  }
  return out;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object.' }, { status: 400 });
  }
  const b = body as RawBody;
  if (!b.profile || typeof b.profile !== 'object') {
    return NextResponse.json({ error: 'profile is required.' }, { status: 400 });
  }
  for (const [k, v] of Object.entries(b.profile)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return NextResponse.json({ error: `profile.${k} must be a finite number.` }, { status: 400 });
    }
  }
  if (b.mood_delta !== undefined) {
    if (typeof b.mood_delta !== 'object' || b.mood_delta === null) {
      return NextResponse.json({ error: 'mood_delta must be an object.' }, { status: 400 });
    }
    for (const [k, v] of Object.entries(b.mood_delta)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        return NextResponse.json({ error: `mood_delta.${k} must be a finite number.` }, { status: 400 });
      }
    }
  }
  const limit =
    typeof b.limit === 'number' && Number.isInteger(b.limit) && b.limit > 0 && b.limit <= MAX_LIMIT
      ? b.limit
      : 12;

  const effectiveProfile = applyMoodDelta(b.profile, b.mood_delta);

  let result;
  try {
    result = await recommendGames({
      playerProfile: effectiveProfile,
      limit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[quiz-recommend] orchestrator threw', { message, stack });
    return NextResponse.json(
      { error: 'recommendation_failed', detail: message },
      { status: 500 },
    );
  }

  try {
    return NextResponse.json({
      recommendations: result.recommendations.map((r) => {
        const m = metaFor(r.gameId);
        return {
          game_id: r.gameId,
          game_name: m.name,
          year: m.year ?? null,
          subdomain: m.subdomain ?? null,
          categories: m.categories ?? [],
          score: r.score,
          contributions: r.contributions,
          top_dim_contributions: r.topDimContributions,
          explanation: r.explanation,
        };
      }),
      engines_ran: result.enginesRan,
      engines_skipped: result.enginesSkipped,
      candidates_considered: result.candidatesConsidered,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[quiz-recommend] response serialization threw', { message });
    return NextResponse.json(
      { error: 'serialization_failed', detail: message },
      { status: 500 },
    );
  }
}
