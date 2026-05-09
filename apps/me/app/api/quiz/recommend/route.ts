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
import gameNames from '@/lib/heimdall/game-names.json';

const MAX_LIMIT = 24;

interface RawBody {
  profile?: Record<string, number>;
  confidence?: Record<string, number>;
  limit?: number;
}

function nameFor(gameId: number): string | null {
  return (gameNames as Record<string, string>)[String(gameId)] ?? null;
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
  const limit =
    typeof b.limit === 'number' && Number.isInteger(b.limit) && b.limit > 0 && b.limit <= MAX_LIMIT
      ? b.limit
      : 12;

  let result;
  try {
    result = await recommendGames({
      playerProfile: b.profile,
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
      recommendations: result.recommendations.map((r) => ({
        game_id: r.gameId,
        game_name: nameFor(r.gameId),
        score: r.score,
        contributions: r.contributions,
        explanation: r.explanation,
      })),
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
