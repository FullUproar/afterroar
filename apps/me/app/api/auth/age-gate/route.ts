import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  classifyAge,
  isValidDob,
  encodeAgeGatePayload,
  COOKIE_AGE_GATE,
  COOKIE_UNDER_13_BLOCK,
  ageGateCookieOptions,
  under13CookieOptions,
  isUnder13Blocked,
} from '@/lib/age-gate';

/**
 * POST /api/auth/age-gate
 *
 * Body: { month: 1-12, day: 1-31, year: e.g. 1990 }
 *
 * Validates the date of birth and:
 *   - <13 → drop the long-lived COOKIE_UNDER_13_BLOCK cookie (COPPA
 *           technical requirement: prevents simply hitting back and
 *           entering an older age) and redirect to /signup/blocked.
 *   - 13-17 → set COOKIE_AGE_GATE with the cohort + DOB and redirect to
 *           /signup/teen, where the parental-consent flow lives.
 *   - 18+   → set COOKIE_AGE_GATE and redirect to /signup, the regular
 *           OAuth/email-signup form.
 *
 * If the visitor already has the under-13 block cookie, we refuse to
 * process at all (the block is sticky by design).
 */
export async function POST(request: NextRequest) {
  if (await isUnder13Blocked()) {
    return NextResponse.json(
      { error: 'This account cannot be created on this device.' },
      { status: 403 },
    );
  }

  let body: { month?: number; day?: number; year?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const month = Number(body.month);
  const day = Number(body.day);
  const year = Number(body.year);

  if (!month || !day || !year) {
    return NextResponse.json({ error: 'Date of birth is required' }, { status: 400 });
  }

  // Construct DOB at noon UTC to dodge timezone edge cases on the day boundary
  const dob = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (!isValidDob(dob)) {
    return NextResponse.json({ error: 'Enter a valid date of birth.' }, { status: 400 });
  }
  if (dob.getUTCFullYear() !== year || dob.getUTCMonth() !== month - 1 || dob.getUTCDate() !== day) {
    return NextResponse.json({ error: 'That date does not exist.' }, { status: 400 });
  }

  const result = classifyAge(dob);
  const store = await cookies();

  if (result.cohort === 'under13') {
    // COPPA: persist a long-lived block cookie so this device can't retry
    // the gate by clearing the form and entering a different DOB.
    store.set(COOKIE_UNDER_13_BLOCK, '1', under13CookieOptions);
    return NextResponse.json({ redirect: '/signup/blocked' });
  }

  const payload = encodeAgeGatePayload({
    cohort: result.cohort,
    dob: dob.toISOString(),
    setAt: Date.now(),
  });
  store.set(COOKIE_AGE_GATE, payload, ageGateCookieOptions);

  if (result.cohort === 'teen') {
    return NextResponse.json({ redirect: '/signup/teen' });
  }
  return NextResponse.json({ redirect: '/signup' });
}
