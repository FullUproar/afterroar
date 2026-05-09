/**
 * POST /api/quiz/claim
 *
 * When a previously-anonymous quiz taker signs in (or signs up), this
 * endpoint migrates their anon_session_id-tagged rows over to their
 * passport_id. Specifically:
 *   - rec_seidr_recommendation_event: rec history follows them
 *   - rec_seidr_user_game_signal: thumbs/owned/loved tags follow them
 *
 * Idempotent and safe to call on every signed-in pageload — the UPDATEs
 * filter to "anon_session_id present AND passport_id null" so re-runs
 * are no-ops. If the user already tagged a game while signed-in AND
 * later tagged it again while anon, the passport row wins; the anon
 * row is dropped on conflict.
 *
 * Body: { anon_session_id: string }
 *
 * Returns: { events_migrated, signals_migrated, signals_dropped, profile_migrated? }
 *
 * Response intentionally non-error when there's nothing to migrate
 * (the common case on subsequent loads).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { claimAnonRowsForPassport, savePlayerProfile } from '@/lib/heimdall/persist';
import { loadPlayerProfile } from '@/lib/heimdall/load';

const ANON_SESSION_ID_RE = /^[0-9a-f-]{8,64}$/i;

interface ClaimBody {
  anon_session_id?: string;
  /**
   * Optional: an in-browser computed quiz profile that the user took
   * while anonymous. If supplied AND the user has no saved profile yet,
   * we save it under their passport so they don't have to retake.
   */
  profile?: Record<string, number>;
  confidence?: Record<string, number>;
  question_set_version?: string;
  questions_answered?: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const passportId = session?.user?.id;
  if (!passportId) {
    return NextResponse.json({ error: 'Sign-in required.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object.' }, { status: 400 });
  }
  const b = body as ClaimBody;
  if (typeof b.anon_session_id !== 'string' || !ANON_SESSION_ID_RE.test(b.anon_session_id)) {
    return NextResponse.json({ error: 'anon_session_id required.' }, { status: 400 });
  }

  let migrated;
  try {
    migrated = await claimAnonRowsForPassport({
      passportId,
      anonSessionId: b.anon_session_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[quiz-claim] failed', { message });
    return NextResponse.json({ error: 'claim_failed', detail: message }, { status: 500 });
  }

  // Optional profile migration: only save if (a) caller supplied a valid
  // profile and (b) the passport doesn't already have one. Re-running the
  // claim won't keep duplicating profile rows.
  let profileMigrated = false;
  if (
    b.profile &&
    typeof b.profile === 'object' &&
    b.confidence &&
    typeof b.confidence === 'object' &&
    typeof b.question_set_version === 'string' &&
    b.question_set_version.length > 0 &&
    typeof b.questions_answered === 'number' &&
    Number.isInteger(b.questions_answered) &&
    b.questions_answered > 0
  ) {
    const existing = await loadPlayerProfile(passportId).catch(() => null);
    if (!existing) {
      // Validate vector contents lazily; treat any non-finite as a 0
      // and skip rather than failing the whole claim. This is opportunistic
      // rescue, not an authoritative save endpoint.
      const cleanProfile: Record<string, number> = {};
      for (const [k, v] of Object.entries(b.profile)) {
        if (typeof v === 'number' && Number.isFinite(v)) cleanProfile[k] = v;
      }
      const cleanConfidence: Record<string, number> = {};
      for (const [k, v] of Object.entries(b.confidence)) {
        if (typeof v === 'number' && Number.isFinite(v)) cleanConfidence[k] = v;
      }
      if (Object.keys(cleanProfile).length > 0) {
        try {
          await savePlayerProfile({
            passportId,
            dimVector: cleanProfile,
            confidenceVector: cleanConfidence,
            questionSetVersion: b.question_set_version,
            questionsAnswered: b.questions_answered,
            source: 'quiz-claim',
            notes: 'Migrated from anonymous session on Passport claim.',
          });
          profileMigrated = true;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[quiz-claim] profile save failed (non-fatal)', { message });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    events_migrated: migrated.events,
    signals_migrated: migrated.signals,
    signals_dropped: migrated.signalsDropped,
    profile_migrated: profileMigrated,
  });
}
