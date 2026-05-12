import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/push/subscribe
 *
 * Client posts a PushSubscriptionJSON-shaped body after the browser
 * authorizes Web Push. We upsert a row keyed by endpoint so re-subscribes
 * from the same device replace the prior keys rather than duplicating.
 *
 * Body: {
 *   subscription: { endpoint, keys: { p256dh, auth } },
 *   channel?: string,        // optional segment tag (default 'passport_app')
 *   reason?: string,         // 'initial' | 'pushsubscriptionchange' | etc.
 * }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    channel?: string;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json(
      { error: 'Invalid subscription — endpoint, p256dh, and auth required' },
      { status: 400 },
    );
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 256) ?? null;
  const channel = body.channel?.trim() || 'passport_app';

  // Upsert by endpoint. If an endpoint already exists tied to a *different*
  // user, reassign — the browser is now logged in as a different account.
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint: sub.endpoint },
    select: { id: true, userId: true },
  });

  if (existing) {
    await prisma.pushSubscription.update({
      where: { id: existing.id },
      data: {
        userId: session.user.id,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
        channel,
      },
    });
  } else {
    await prisma.pushSubscription.create({
      data: {
        userId: session.user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
        channel,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
