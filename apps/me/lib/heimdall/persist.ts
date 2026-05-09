/**
 * Heimdall — write paths for the rec_seidr_* feedback loop.
 *
 * The rec_* tables are managed by raw-SQL migrations under SILO discipline
 * (rec-engines/seidr/migrations/) and aren't in apps/me's Prisma schema.
 * We write to them via $queryRaw, same as the read path in load.ts.
 *
 * Anonymous-friendly: every write accepts EITHER a passport_id (from a
 * NextAuth session) OR an anon_session_id (a uuid the browser stores in
 * localStorage). Exactly one of the two should be set; passport wins
 * when both arrive (signed-in user playing in a session that started
 * anonymous).
 */

import { prisma } from '@/lib/prisma';
import type { DimVector } from './load';

export interface RecommendationEventInput {
  passportId: string | null;
  anonSessionId: string | null;
  source: 'quiz' | 'recs_api' | string;
  profileSnapshot: DimVector;
  moodDelta?: Record<string, number>;
  filters?: Record<string, unknown>;
  candidatesConsidered: number;
  enginesRan: string[];
  // The orchestrator returns skipped engines as {name, reason}[]; we
  // store the structured form so analysis can group by reason later.
  enginesSkipped: unknown;
  // Whatever the API returned in `recommendations` — store verbatim so
  // a later thumbs-down can be tied to the exact rec it was reacting to.
  recommendations: unknown;
}

/**
 * Insert a row into rec_seidr_recommendation_event. Returns the new id.
 * Best-effort — callers should swallow errors and not fail the user
 * request if logging breaks.
 */
export async function recordRecommendationEvent(
  input: RecommendationEventInput,
): Promise<bigint | null> {
  if (!input.passportId && !input.anonSessionId) return null;
  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    INSERT INTO rec_seidr_recommendation_event (
      passport_id,
      anon_session_id,
      source,
      profile_snapshot,
      mood_delta,
      filters,
      candidates_considered,
      engines_ran,
      engines_skipped,
      recommendations
    ) VALUES (
      ${input.passportId},
      ${input.anonSessionId},
      ${input.source},
      ${JSON.stringify(input.profileSnapshot)}::jsonb,
      ${input.moodDelta ? JSON.stringify(input.moodDelta) : null}::jsonb,
      ${input.filters ? JSON.stringify(input.filters) : null}::jsonb,
      ${input.candidatesConsidered},
      ${JSON.stringify(input.enginesRan)}::jsonb,
      ${JSON.stringify(input.enginesSkipped)}::jsonb,
      ${JSON.stringify(input.recommendations)}::jsonb
    )
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

export const SIGNAL_KINDS = [
  'thumbs_up',
  'thumbs_down',
  'owned',
  'loved',
  'meh',
  'never_heard_of',
  'tried_disliked',
] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export interface UserGameSignalInput {
  passportId: string | null;
  anonSessionId: string | null;
  gameId: number;
  kind: SignalKind;
  recommendationEventId?: bigint | number | null;
  notes?: string;
}

/**
 * Upsert a user's signal on a game. Same (passport|anon, game, kind)
 * collapses to one row via the partial unique indexes — repeat thumbs-up
 * is idempotent (refreshes updated_at).
 */
export async function recordUserGameSignal(input: UserGameSignalInput): Promise<void> {
  if (!input.passportId && !input.anonSessionId) {
    throw new Error('passportId or anonSessionId required');
  }
  // Two ON CONFLICT targets because the uniqueness is enforced by two
  // partial indexes (one per identity column). Pick the one that matches
  // the identity actually being used.
  if (input.passportId) {
    await prisma.$executeRaw`
      INSERT INTO rec_seidr_user_game_signal (
        passport_id, anon_session_id, game_id, kind,
        recommendation_event_id, notes, updated_at
      ) VALUES (
        ${input.passportId},
        ${input.anonSessionId},
        ${input.gameId}::bigint,
        ${input.kind},
        ${input.recommendationEventId ? BigInt(input.recommendationEventId) : null}::bigint,
        ${input.notes ?? null},
        now()
      )
      ON CONFLICT (passport_id, game_id, kind)
        WHERE passport_id IS NOT NULL
        DO UPDATE SET
          recommendation_event_id = EXCLUDED.recommendation_event_id,
          notes = EXCLUDED.notes,
          updated_at = now()
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO rec_seidr_user_game_signal (
        passport_id, anon_session_id, game_id, kind,
        recommendation_event_id, notes, updated_at
      ) VALUES (
        ${input.passportId},
        ${input.anonSessionId},
        ${input.gameId}::bigint,
        ${input.kind},
        ${input.recommendationEventId ? BigInt(input.recommendationEventId) : null}::bigint,
        ${input.notes ?? null},
        now()
      )
      ON CONFLICT (anon_session_id, game_id, kind)
        WHERE anon_session_id IS NOT NULL
        DO UPDATE SET
          recommendation_event_id = EXCLUDED.recommendation_event_id,
          notes = EXCLUDED.notes,
          updated_at = now()
    `;
  }
}

/**
 * Delete a signal (the user un-thumbs-ups, etc).
 */
export async function deleteUserGameSignal(input: {
  passportId: string | null;
  anonSessionId: string | null;
  gameId: number;
  kind: SignalKind;
}): Promise<void> {
  if (input.passportId) {
    await prisma.$executeRaw`
      DELETE FROM rec_seidr_user_game_signal
      WHERE passport_id = ${input.passportId}
        AND game_id = ${input.gameId}::bigint
        AND kind = ${input.kind}
    `;
  } else if (input.anonSessionId) {
    await prisma.$executeRaw`
      DELETE FROM rec_seidr_user_game_signal
      WHERE anon_session_id = ${input.anonSessionId}
        AND game_id = ${input.gameId}::bigint
        AND kind = ${input.kind}
    `;
  }
}

/**
 * Fetch all of a passport's signals (used to render thumbs state on rec
 * cards when a signed-in user revisits). Anon equivalents need to be
 * fetched per session via the anon_session_id branch.
 */
export async function loadUserGameSignals(args: {
  passportId?: string | null;
  anonSessionId?: string | null;
  gameIds?: number[];
}): Promise<Array<{ game_id: number; kind: SignalKind; recommendation_event_id: bigint | null }>> {
  const { passportId, anonSessionId, gameIds } = args;
  if (!passportId && !anonSessionId) return [];

  // The narrow gameIds filter keeps the payload small when the caller
  // only cares about the games currently on screen.
  const useGameFilter = Array.isArray(gameIds) && gameIds.length > 0;

  // Two near-identical branches because we can't pass a Prisma.sql
  // fragment through a bare $queryRaw template literal here without
  // restructuring all the calls. The branching is cheap.
  if (passportId) {
    if (useGameFilter) {
      const rows = await prisma.$queryRaw<
        Array<{ game_id: bigint; kind: string; recommendation_event_id: bigint | null }>
      >`
        SELECT game_id, kind, recommendation_event_id
        FROM rec_seidr_user_game_signal
        WHERE passport_id = ${passportId}
          AND game_id = ANY(${gameIds!.map((g) => BigInt(g))}::bigint[])
      `;
      return rows.map((r) => ({
        game_id: Number(r.game_id),
        kind: r.kind as SignalKind,
        recommendation_event_id: r.recommendation_event_id,
      }));
    }
    const rows = await prisma.$queryRaw<
      Array<{ game_id: bigint; kind: string; recommendation_event_id: bigint | null }>
    >`
      SELECT game_id, kind, recommendation_event_id
      FROM rec_seidr_user_game_signal
      WHERE passport_id = ${passportId}
    `;
    return rows.map((r) => ({
      game_id: Number(r.game_id),
      kind: r.kind as SignalKind,
      recommendation_event_id: r.recommendation_event_id,
    }));
  }

  if (useGameFilter) {
    const rows = await prisma.$queryRaw<
      Array<{ game_id: bigint; kind: string; recommendation_event_id: bigint | null }>
    >`
      SELECT game_id, kind, recommendation_event_id
      FROM rec_seidr_user_game_signal
      WHERE anon_session_id = ${anonSessionId}
        AND game_id = ANY(${gameIds!.map((g) => BigInt(g))}::bigint[])
    `;
    return rows.map((r) => ({
      game_id: Number(r.game_id),
      kind: r.kind as SignalKind,
      recommendation_event_id: r.recommendation_event_id,
    }));
  }
  const rows = await prisma.$queryRaw<
    Array<{ game_id: bigint; kind: string; recommendation_event_id: bigint | null }>
  >`
    SELECT game_id, kind, recommendation_event_id
    FROM rec_seidr_user_game_signal
    WHERE anon_session_id = ${anonSessionId}
  `;
  return rows.map((r) => ({
    game_id: Number(r.game_id),
    kind: r.kind as SignalKind,
    recommendation_event_id: r.recommendation_event_id,
  }));
}
