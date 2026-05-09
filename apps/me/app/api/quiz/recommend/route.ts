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
import { recordRecommendationEvent, loadUserGameSignals } from '@/lib/heimdall/persist';
import { auth } from '@/lib/auth-config';
import gameMeta from '@/lib/heimdall/game-meta.json';

const ANON_SESSION_ID_RE = /^[0-9a-f-]{8,64}$/i;

// Signal kinds that should hide a game from future recs:
//   - owned: they have it; recommending it is wasted slot
//   - tried_disliked: they've tried it and it didn't land
//   - thumbs_down: they've explicitly told us this rec was off
// 'never_heard_of' is intentionally NOT here — it's a positive surfacing
// signal (we should show it again, maybe with more confidence).
const EXCLUDE_KINDS = new Set(['owned', 'tried_disliked', 'thumbs_down']);

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
  /**
   * Hard filters on the candidate pool. Active filters drop candidates
   * before the matcher sees them.
   */
  filters?: {
    min_year?: number;
    max_year?: number;
    subdomains?: string[];
  };
  /**
   * Anonymous session id (uuid generated in the browser, persisted in
   * localStorage). Used to log recommendation events for not-signed-in
   * quiz takers so their thumbs-up/down can be migrated to a Passport
   * later when they claim one. Ignored when the request is signed in.
   */
  anon_session_id?: string;
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
  if (b.filters !== undefined) {
    if (typeof b.filters !== 'object' || b.filters === null) {
      return NextResponse.json({ error: 'filters must be an object.' }, { status: 400 });
    }
    const f = b.filters;
    if (f.min_year !== undefined && (!Number.isFinite(f.min_year) || (f.min_year as number) < 1900)) {
      return NextResponse.json({ error: 'filters.min_year must be >= 1900.' }, { status: 400 });
    }
    if (f.max_year !== undefined && (!Number.isFinite(f.max_year) || (f.max_year as number) > 2100)) {
      return NextResponse.json({ error: 'filters.max_year must be <= 2100.' }, { status: 400 });
    }
    if (f.subdomains !== undefined) {
      if (!Array.isArray(f.subdomains)) {
        return NextResponse.json({ error: 'filters.subdomains must be an array.' }, { status: 400 });
      }
      for (const s of f.subdomains) {
        if (typeof s !== 'string') {
          return NextResponse.json({ error: 'filters.subdomains entries must be strings.' }, { status: 400 });
        }
      }
    }
  }
  const limit =
    typeof b.limit === 'number' && Number.isInteger(b.limit) && b.limit > 0 && b.limit <= MAX_LIMIT
      ? b.limit
      : 12;

  const effectiveProfile = applyMoodDelta(b.profile, b.mood_delta);

  // Identity resolution — earlier than the previous version, since we now
  // need it BEFORE calling the orchestrator (to pull the user's prior
  // signals and exclude their owned/disliked games from the candidate pool).
  const session = await auth().catch(() => null);
  const passportId = session?.user?.id ?? null;
  const anonSessionId =
    !passportId && typeof b.anon_session_id === 'string' && ANON_SESSION_ID_RE.test(b.anon_session_id)
      ? b.anon_session_id
      : null;

  // Pull signal-based exclusions. Best-effort — if the lookup fails the
  // recs still go through (just without signal-aware filtering).
  let excludeGameIds: number[] = [];
  if (passportId || anonSessionId) {
    try {
      const signals = await loadUserGameSignals({ passportId, anonSessionId });
      const excluded = new Set<number>();
      for (const s of signals) {
        if (EXCLUDE_KINDS.has(s.kind)) excluded.add(s.game_id);
      }
      excludeGameIds = Array.from(excluded);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[quiz-recommend] signal lookup failed (non-fatal)', { message });
    }
  }

  let result;
  try {
    result = await recommendGames({
      playerProfile: effectiveProfile,
      limit,
      filters: b.filters
        ? {
            minYear: b.filters.min_year,
            maxYear: b.filters.max_year,
            subdomains: b.filters.subdomains,
          }
        : undefined,
      context: excludeGameIds.length > 0 ? { excludeGameIds } : undefined,
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

  // Build the rec list once so the same array goes into the response
  // body and the persisted event log.
  const recommendations = result.recommendations.map((r, idx) => {
    const m = metaFor(r.gameId);
    return {
      game_id: r.gameId,
      game_name: m.name,
      year: m.year ?? null,
      subdomain: m.subdomain ?? null,
      categories: m.categories ?? [],
      score: r.score,
      rank: idx + 1,
      contributions: r.contributions,
      top_dim_contributions: r.topDimContributions,
      explanation: r.explanation,
    };
  });

  // Best-effort logging — never block the response on it.
  let recommendationEventId: string | null = null;
  if (passportId || anonSessionId) {
    try {
      const id = await recordRecommendationEvent({
        passportId,
        anonSessionId,
        source: 'quiz',
        profileSnapshot: effectiveProfile,
        moodDelta: b.mood_delta,
        filters: b.filters as Record<string, unknown> | undefined,
        candidatesConsidered: result.candidatesConsidered,
        enginesRan: result.enginesRan,
        enginesSkipped: result.enginesSkipped,
        recommendations,
      });
      // bigint isn't JSON-serializable, so stringify for the wire.
      recommendationEventId = id ? id.toString() : null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[quiz-recommend] event log failed (non-fatal)', { message });
    }
  }

  try {
    return NextResponse.json({
      recommendations,
      engines_ran: result.enginesRan,
      engines_skipped: result.enginesSkipped,
      candidates_considered: result.candidatesConsidered,
      excluded_by_signals: excludeGameIds.length,
      recommendation_event_id: recommendationEventId,
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
