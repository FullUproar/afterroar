import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  COOKIE_AGE_GATE,
  COOKIE_UNDER_13_BLOCK,
  COOKIE_ADULT_ATTESTATION,
  ageGateCookieOptions,
  under13CookieOptions,
  adultAttestationCookieOptions,
  encodeAgeGatePayload,
  isUnder13Blocked,
  type AgeCohort,
} from '@/lib/age-gate';

/**
 * POST /api/auth/age-gate/cohort
 *
 * Handles the radio-button cohort selection on /signup. Body:
 *   { cohort: 'adult' | 'teen' | 'under13' }
 *
 * Adult: drops both the age-gate cookie (cohort=adult, no DOB) AND the
 *   short-lived adult-attestation cookie (used by OAuth signIn callback).
 *   Returns redirect target, but caller stays on /signup to complete
 *   creds (Google or email/password).
 *
 * Teen: drops age-gate cookie (cohort=teen, no DOB). Returns redirect
 *   to /signup/teen for the parental-consent flow.
 *
 * Under13: drops the long-lived sticky block cookie (COPPA technical
 *   requirement: device cannot retry). Returns redirect to
 *   /signup/blocked.
 */
export async function POST(request: NextRequest) {
  if (await isUnder13Blocked()) {
    return NextResponse.json({ redirect: '/signup/blocked' });
  }

  let body: { cohort?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const cohort = body.cohort;
  if (cohort !== 'adult' && cohort !== 'teen' && cohort !== 'under13') {
    return NextResponse.json(
      { error: 'cohort must be one of: adult, teen, under13' },
      { status: 400 },
    );
  }

  const store = await cookies();

  if (cohort === 'under13') {
    store.set(COOKIE_UNDER_13_BLOCK, '1', under13CookieOptions);
    return NextResponse.json({ redirect: '/signup/blocked' });
  }

  // Set the age-gate cookie for both adult and teen so downstream pages
  // (/signup, /signup/teen, parental-consent endpoints) can read the
  // cohort without a separate database lookup.
  store.set(
    COOKIE_AGE_GATE,
    encodeAgeGatePayload({
      cohort: cohort as AgeCohort,
      setAt: Date.now(),
    }),
    ageGateCookieOptions,
  );

  if (cohort === 'teen') {
    return NextResponse.json({ redirect: '/signup/teen' });
  }

  // Adult: also drop the short-lived attestation cookie so the OAuth
  // signIn callback can verify the user attested before initiating the
  // Google round-trip.
  store.set(COOKIE_ADULT_ATTESTATION, '1', adultAttestationCookieOptions);
  return NextResponse.json({ redirect: '/signup', stage: 'creds' });
}
