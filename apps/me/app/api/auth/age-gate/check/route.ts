import { NextResponse } from 'next/server';
import { readAgeGateCookie, isUnder13Blocked } from '@/lib/age-gate';

/**
 * GET /api/auth/age-gate/check
 *
 * Lightweight read of the age-gate cookie state. Used by the /signup
 * client component to decide whether to bounce the user to the gate.
 * Never returns the DOB; only the cohort label.
 */
export async function GET() {
  if (await isUnder13Blocked()) {
    return NextResponse.json({ cohort: 'under13' });
  }
  const cookie = await readAgeGateCookie();
  if (!cookie) return NextResponse.json({ cohort: null });
  return NextResponse.json({ cohort: cookie.cohort });
}
