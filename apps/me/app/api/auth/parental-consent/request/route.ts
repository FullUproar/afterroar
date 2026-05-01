import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail, parentalConsentTemplate } from '@/lib/email';
import {
  readAgeGateCookie,
  parentalConsentRequired,
  classifyAge,
} from '@/lib/age-gate';

const TOKEN_TTL_HOURS = 7 * 24; // 7 days

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function buildApproveUrl(token: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    'https://afterroar.me';
  const url = new URL('/signup/parental-consent', base);
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * POST /api/auth/parental-consent/request
 *
 * Body: { childEmail, childDisplayName?, parentEmail }
 *
 * Reads the age-gate cookie to confirm the requester is in the 13-17
 * cohort and to recover their stated DOB. Creates a MinorConsentRequest,
 * emails the parent a magic link.
 *
 * Behavior is the same whether the parent email is registered or not.
 * Generic response so we don't leak parent registration state.
 */
export async function POST(request: NextRequest) {
  if (!parentalConsentRequired()) {
    return NextResponse.json(
      { error: 'Parental consent flow is currently disabled.' },
      { status: 400 },
    );
  }

  const cookie = await readAgeGateCookie();
  if (!cookie || cookie.cohort !== 'teen') {
    return NextResponse.json(
      { error: 'Age gate not satisfied. Please start over at /signup/age.' },
      { status: 400 },
    );
  }

  let body: { childEmail?: string; childDisplayName?: string; parentEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const childEmail = String(body.childEmail ?? '').trim().toLowerCase();
  const parentEmail = String(body.parentEmail ?? '').trim().toLowerCase();
  const childDisplayName =
    body.childDisplayName && String(body.childDisplayName).trim().length > 0
      ? String(body.childDisplayName).trim()
      : null;

  if (!childEmail.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
  }
  if (!parentEmail.includes('@')) {
    return NextResponse.json({ error: "A parent's email is required." }, { status: 400 });
  }
  if (childEmail === parentEmail) {
    return NextResponse.json(
      { error: "Parent's email needs to be different from yours." },
      { status: 400 },
    );
  }

  // Re-validate the cookie's DOB still classifies as teen IF a DOB is
  // present. New radio-button signup flow doesn't capture DOB, so we
  // rely on the cohort field alone in that case. If a DOB is present,
  // we double-check the classifier hasn't drifted.
  let dob: Date | null = null;
  if (cookie.dob) {
    dob = new Date(cookie.dob);
    const result = classifyAge(dob);
    if (result.cohort !== 'teen') {
      return NextResponse.json(
        { error: 'Age gate stale. Please start over.' },
        { status: 400 },
      );
    }
  }

  // If the child email already belongs to an active adult account, refuse.
  // (Could be a teen typing a parent's existing email by mistake, or an
  // adult mistakenly going through the teen flow.)
  const existingChild = await prisma.user.findUnique({ where: { email: childEmail } });
  if (existingChild && !existingChild.isMinor && existingChild.dateOfBirth) {
    return NextResponse.json(
      { error: 'That email is already in use. Try signing in instead.' },
      { status: 409 },
    );
  }

  // Invalidate any pending requests for this child email so old links die.
  await prisma.minorConsentRequest.updateMany({
    where: { childEmail, status: 'pending' },
    data: { status: 'expired' },
  });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.minorConsentRequest.create({
    data: {
      token,
      childEmail,
      childDisplayName,
      // Pass null when the radio-button signup flow gave us cohort
      // without DOB; the schema column is nullable.
      childDateOfBirth: dob,
      parentEmail,
      expiresAt,
    },
  });

  const approveUrl = buildApproveUrl(token);
  const tpl = parentalConsentTemplate({
    approveUrl,
    childEmail,
    childDisplayName,
    expiresHours: TOKEN_TTL_HOURS,
  });
  // Fire-and-forget: response doesn't depend on email delivery.
  sendEmail({ to: parentEmail, ...tpl }).catch((err) =>
    console.error('[parental-consent/request] email send failed', err),
  );

  return NextResponse.json({
    ok: true,
    message: 'Email sent to parent. They have 7 days to confirm.',
    ...(process.env.NODE_ENV !== 'production' ? { dev_approve_url: approveUrl } : {}),
  });
}
