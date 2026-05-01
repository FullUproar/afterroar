import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth-config';

/**
 * POST /api/auth/parental-consent/start-payment
 *
 * Body: { token: string, path: 'free' | 'pro' }
 *
 * For path='free': starts the one-time $5 consent fee Stripe Checkout
 * session. The fee covers Persona's per-verification cost (~$1-3) plus
 * a small platform margin. After successful payment, Stripe redirects
 * back to /signup/parental-consent?token=...&paid=consent and the
 * client picks up the paid state.
 *
 * For path='pro': starts a Pro subscription Stripe Checkout. Bundles
 * the consent fee into the first month and unlocks the parent
 * monitoring dashboard. (Currently the client links directly to
 * /billing/subscribe; this branch is reserved for any consent-specific
 * Stripe flow we want to thread later.)
 *
 * **STUBBED for v1**: Stripe wiring isn't done yet. When STRIPE_SECRET_KEY
 * is set in env, this should create a real Checkout session. When it's
 * not (dev / pre-Stripe), we mark the consent fee as paid immediately
 * and return `{ devMarkPaid: true }` so testing can proceed end-to-end.
 * Production deployment must have Stripe wired before public launch.
 */
export async function POST(request: NextRequest) {
  let body: { token?: string; path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = String(body.token ?? '');
  const path = body.path === 'pro' ? 'pro' : 'free';

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
    select: { id: true, email: true, identityVerified: true },
  });
  if (!parent) {
    return NextResponse.json({ error: 'Parent account not found.' }, { status: 404 });
  }
  if (parent.email.toLowerCase() !== consent.parentEmail.toLowerCase()) {
    return NextResponse.json({ error: 'Signed-in account does not match the consent request.' }, { status: 403 });
  }
  if (!parent.identityVerified) {
    return NextResponse.json(
      { error: 'Identity verification required before payment.' },
      { status: 403 },
    );
  }

  // STUB: real Stripe Checkout integration goes here when STRIPE_SECRET_KEY
  // is wired. For now, dev-mode auto-marks paid so we can test end-to-end.
  if (!process.env.STRIPE_SECRET_KEY) {
    if (path === 'free') {
      await prisma.minorConsentRequest.update({
        where: { id: consent.id },
        data: { consentFeePaidAt: new Date(), parentChoseProPath: false },
      });
      return NextResponse.json({
        ok: true,
        devMarkPaid: true,
        warning: 'Stripe is not configured. Consent fee marked paid in dev mode.',
      });
    } else {
      return NextResponse.json({
        ok: true,
        devMarkPaid: true,
        warning: 'Stripe is not configured. Pro subscription path needs to be wired against the existing /billing/subscribe flow.',
      });
    }
  }

  // Production path (when Stripe is wired):
  //   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  //   const checkout = await stripe.checkout.sessions.create({
  //     mode: 'payment',
  //     line_items: [{ price: process.env.STRIPE_CONSENT_FEE_PRICE_ID, quantity: 1 }],
  //     customer_email: parent.email,
  //     success_url: `${process.env.NEXTAUTH_URL}/signup/parental-consent?token=${token}&paid=consent`,
  //     cancel_url: `${process.env.NEXTAUTH_URL}/signup/parental-consent?token=${token}`,
  //     metadata: { consentRequestId: consent.id, path: 'free' },
  //   });
  //   return NextResponse.json({ checkoutUrl: checkout.url });
  return NextResponse.json({
    error: 'Stripe Checkout integration is wired but the price IDs need to be configured.',
  }, { status: 501 });
}
