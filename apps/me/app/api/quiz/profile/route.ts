/**
 * GET  /api/quiz/profile  — Fetch the signed-in user's saved seidr profile.
 *                           Returns 401 when not signed in (anonymous quiz
 *                           takers keep their profile in localStorage).
 *                           Returns 404 when signed in but no profile saved yet.
 *
 * POST /api/quiz/profile  — Persist a quiz-derived profile for the signed-in
 *                           user. Auto-bumps profile_version, so retakes
 *                           keep history. Anonymous callers get 401 — they
 *                           can claim a Passport later and we'll migrate
 *                           their browser-side state then.
 *
 * Body (POST): {
 *   profile: Record<string, number>     // 24-dim vector
 *   confidence: Record<string, number>  // per-dim 0..1
 *   question_set_version: string
 *   questions_answered: number
 *   notes?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { savePlayerProfile } from '@/lib/heimdall/persist';
import { loadPlayerProfile } from '@/lib/heimdall/load';

interface ProfileBody {
  profile?: Record<string, number>;
  confidence?: Record<string, number>;
  question_set_version?: string;
  questions_answered?: number;
  notes?: string;
}

export async function GET() {
  const session = await auth();
  const passportId = session?.user?.id;
  if (!passportId) {
    return NextResponse.json({ error: 'Sign-in required.' }, { status: 401 });
  }
  const profile = await loadPlayerProfile(passportId);
  if (!profile) {
    return NextResponse.json({ error: 'No saved profile.' }, { status: 404 });
  }
  return NextResponse.json({
    profile: profile.dim_vector,
    confidence: profile.confidence_vector ?? {},
  });
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
  const b = body as ProfileBody;
  if (!b.profile || typeof b.profile !== 'object') {
    return NextResponse.json({ error: 'profile is required.' }, { status: 400 });
  }
  for (const [k, v] of Object.entries(b.profile)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return NextResponse.json({ error: `profile.${k} must be a finite number.` }, { status: 400 });
    }
  }
  if (!b.confidence || typeof b.confidence !== 'object') {
    return NextResponse.json({ error: 'confidence is required.' }, { status: 400 });
  }
  for (const [k, v] of Object.entries(b.confidence)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return NextResponse.json({ error: `confidence.${k} must be a finite number.` }, { status: 400 });
    }
  }
  if (typeof b.question_set_version !== 'string' || !b.question_set_version) {
    return NextResponse.json({ error: 'question_set_version required.' }, { status: 400 });
  }
  if (
    typeof b.questions_answered !== 'number' ||
    !Number.isInteger(b.questions_answered) ||
    b.questions_answered < 1
  ) {
    return NextResponse.json({ error: 'questions_answered must be a positive integer.' }, { status: 400 });
  }
  if (b.notes !== undefined && (typeof b.notes !== 'string' || b.notes.length > 500)) {
    return NextResponse.json({ error: 'notes must be a string (<=500 chars).' }, { status: 400 });
  }

  try {
    const result = await savePlayerProfile({
      passportId,
      dimVector: b.profile,
      confidenceVector: b.confidence,
      questionSetVersion: b.question_set_version,
      questionsAnswered: b.questions_answered,
      notes: b.notes,
    });
    return NextResponse.json({
      ok: true,
      profile_version: result.version,
      // bigint isn't JSON-serializable — stringify for the wire.
      profile_id: result.id.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[quiz-profile-save] failed', { message });
    return NextResponse.json({ error: 'profile_save_failed', detail: message }, { status: 500 });
  }
}
