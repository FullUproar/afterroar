/**
 * POST /api/recs/feedback
 *
 * Records a user's signal on a single recommended game (thumbs/owned/loved/etc).
 * Anonymous-friendly: accepts EITHER a NextAuth session (passport_id) OR
 * a browser-generated anon_session_id (uuid stored in localStorage). The
 * UI populates anon_session_id whenever the user is signed out.
 *
 * Idempotent on (identity, game, kind): re-thumbs-upping is a no-op write.
 *
 * DELETE: same body shape — removes the signal (un-thumbs-up).
 *
 * Body: {
 *   anon_session_id?: string   // required if not signed in
 *   game_id: number
 *   kind: SignalKind
 *   recommendation_event_id?: number  // when known, ties signal to source rec
 *   notes?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import {
  recordUserGameSignal,
  deleteUserGameSignal,
  SIGNAL_KINDS,
  type SignalKind,
} from '@/lib/heimdall/persist';

interface FeedbackBody {
  anon_session_id?: string;
  game_id?: number;
  kind?: string;
  recommendation_event_id?: number;
  notes?: string;
}

const ANON_SESSION_ID_RE = /^[0-9a-f-]{8,64}$/i;

async function parseAndValidate(req: NextRequest): Promise<
  | { ok: true; identity: { passportId: string | null; anonSessionId: string | null }; body: FeedbackBody & { game_id: number; kind: SignalKind } }
  | { ok: false; error: string; status: number }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, error: 'Invalid JSON body.', status: 400 };
  }
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body must be a JSON object.', status: 400 };
  }
  const b = body as FeedbackBody;
  if (typeof b.game_id !== 'number' || !Number.isInteger(b.game_id) || b.game_id <= 0) {
    return { ok: false, error: 'game_id must be a positive integer.', status: 400 };
  }
  if (typeof b.kind !== 'string' || !SIGNAL_KINDS.includes(b.kind as SignalKind)) {
    return { ok: false, error: `kind must be one of: ${SIGNAL_KINDS.join(', ')}.`, status: 400 };
  }
  if (b.notes !== undefined && (typeof b.notes !== 'string' || b.notes.length > 500)) {
    return { ok: false, error: 'notes must be a string (<=500 chars).', status: 400 };
  }
  if (b.recommendation_event_id !== undefined && !Number.isFinite(b.recommendation_event_id)) {
    return { ok: false, error: 'recommendation_event_id must be a number.', status: 400 };
  }

  const session = await auth();
  const passportId = session?.user?.id ?? null;

  let anonSessionId: string | null = null;
  if (!passportId) {
    // Anonymous path requires the client-supplied anon id.
    if (typeof b.anon_session_id !== 'string' || !ANON_SESSION_ID_RE.test(b.anon_session_id)) {
      return { ok: false, error: 'anon_session_id required when not signed in.', status: 400 };
    }
    anonSessionId = b.anon_session_id;
  }

  return {
    ok: true,
    identity: { passportId, anonSessionId },
    body: { ...b, game_id: b.game_id, kind: b.kind as SignalKind },
  };
}

export async function POST(req: NextRequest) {
  const parsed = await parseAndValidate(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const { identity, body } = parsed;
  try {
    await recordUserGameSignal({
      passportId: identity.passportId,
      anonSessionId: identity.anonSessionId,
      gameId: body.game_id,
      kind: body.kind,
      recommendationEventId: body.recommendation_event_id ?? null,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[recs-feedback] write failed', { message });
    return NextResponse.json({ error: 'feedback_write_failed', detail: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const parsed = await parseAndValidate(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const { identity, body } = parsed;
  try {
    await deleteUserGameSignal({
      passportId: identity.passportId,
      anonSessionId: identity.anonSessionId,
      gameId: body.game_id,
      kind: body.kind,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[recs-feedback] delete failed', { message });
    return NextResponse.json({ error: 'feedback_delete_failed', detail: message }, { status: 500 });
  }
}
