import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth-config';

/**
 * POST /api/auth/parental-consent/start-payment
 *
 * Body: { token: string }
 *
 * The legacy $5 one-time consent fee was dropped 2026-05-12. The single
 * consent path is now: **parent must hold active Afterroar Pro** for the
 * kid account to be approved.
 *
 * This endpoint stays for callback compatibility with older client
 * builds: if a Pro parent hits it, we just confirm and let them proceed
 * to /approve. If they don't have Pro, we tell them where to upgrade.
 *
 * See memory: project_parental_consent_pro_gated_2026_05_12.
 */
export async function POST(request: NextRequest) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = String(body.token ?? '');
  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  const consent = await prisma.minorConsentRequest.findUnique({ where: { token } });
  if (!consent) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 404 });
  }
  if (consent.status !== 'pending') {
    return NextResponse.json({ error: 'This request is no longer pending.' }, { status: 410 });
  }
  if (consent.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This consent link expired.' }, { status: 410 });
  }

  const parent = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { id: true, email: true, identityVerified: true, membershipTier: true },
  });
  if (!parent) {
    return NextResponse.json({ error: 'Parent account not found.' }, { status: 404 });
  }
  if (parent.email.toLowerCase() !== consent.parentEmail.toLowerCase()) {
    return NextResponse.json({ error: 'Signed-in account does not match the consent request.' }, { status: 403 });
  }
  if (!parent.identityVerified) {
    return NextResponse.json({ error: 'Identity verification required before approving.' }, { status: 403 });
  }

  const hasPro = parent.membershipTier === 'PRO'
    || parent.membershipTier === 'VENUE'
    || parent.membershipTier === 'CONNECT';

  if (!hasPro) {
    // Direct the parent to the upgrade page. Once they subscribe, the
    // Stripe webhook propagates the Pro state back to Passport (sync
    // wiring tracked separately) and they can return to complete consent.
    return NextResponse.json(
      {
        error: 'You need an active Afterroar Pro subscription to grant consent for a kid account.',
        upgradeUrl: 'https://hq.fulluproar.com/game-nights/subscribe',
        path: 'pro_required',
      },
      { status: 402 },
    );
  }

  // Pro is active — nothing to "pay." Mark the consent as ready (we keep
  // consentFeePaidAt as a sentinel timestamp meaning "fee waived because
  // Pro is active"). The approve handler re-validates Pro at the moment
  // of approval, so this is purely a UX latch.
  await prisma.minorConsentRequest.update({
    where: { id: consent.id },
    data: { consentFeePaidAt: new Date(), parentChoseProPath: true },
  });

  return NextResponse.json({
    ok: true,
    path: 'pro',
    proActive: true,
  });
}
