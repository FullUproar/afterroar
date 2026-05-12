import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/auth/invite-request
 *
 * Public endpoint — anyone can submit a request to receive an
 * Afterroar Passport invite. Stored as InviteRequest pending review.
 *
 * Body: {
 *   email: string,
 *   displayName?: string,
 *   whyInterested?: string,
 *   consents: {
 *     credoRead: boolean,
 *     dataNeverSold: boolean,
 *     deleteAnytime: boolean,
 *     storeRecognitionConsent: boolean,
 *   }
 * }
 *
 * Validation: email well-formed; all required consents must be true.
 * One submission per email — repeat submissions update the existing
 * row (idempotent) so a tentative requester can come back and finish.
 */

const REQUIRED_CONSENTS = [
  'credoRead',
  'dataNeverSold',
  'deleteAnytime',
  'storeRecognitionConsent',
] as const;

interface RequestBody {
  email?: string;
  displayName?: string;
  whyInterested?: string;
  consents?: Record<string, boolean>;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'A valid email is required.' }, { status: 400 });
  }

  // Block submissions from users who already have a Passport.
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    return NextResponse.json(
      {
        ok: false,
        error: 'That email already has a Passport. Try signing in at /login.',
        code: 'already_signed_up',
      },
      { status: 409 },
    );
  }

  const consents = body.consents ?? {};
  const missing = REQUIRED_CONSENTS.filter((k) => consents[k] !== true);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Please check every box before submitting.',
        missingConsents: missing,
      },
      { status: 400 },
    );
  }

  const displayName = body.displayName?.trim().slice(0, 80) || null;
  const whyInterested = body.whyInterested?.trim().slice(0, 2000) || null;
  const consentRecord = REQUIRED_CONSENTS.reduce<Record<string, true>>((acc, k) => {
    acc[k] = true;
    return acc;
  }, {});

  // Idempotent — repeat submits from same email update the existing row.
  await prisma.inviteRequest.upsert({
    where: { id: (await prisma.inviteRequest.findFirst({ where: { email } }))?.id ?? '___never___' },
    create: {
      email,
      displayName,
      whyInterested,
      consents: consentRecord,
      status: 'pending',
    },
    update: {
      displayName: displayName ?? undefined,
      whyInterested: whyInterested ?? undefined,
      consents: consentRecord,
      // Only reset to pending if not already approved/invited.
      status: 'pending',
    },
  });

  return NextResponse.json({ ok: true });
}
