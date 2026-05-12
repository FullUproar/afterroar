import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';

/**
 * Internal endpoint: HQ dispatcher → Passport, fire Web Push.
 *
 * Body: {
 *   email: string,
 *   type: string,                 // notification type, e.g. 'event.published'
 *   idempotencyKey: string,
 *   timestamp: number,
 *   signature: string,            // hex HMAC-SHA256
 *   notification: {
 *     title: string,
 *     body: string,
 *     url?: string,
 *     tag?: string,
 *     icon?: string,
 *     image?: string,
 *   }
 * }
 *
 * Auth: HMAC over canonical
 *   `notify-push|<email>|<type>|<idempotencyKey>|<timestamp>`
 * signed with PASSPORT_TIER_SYNC_SECRET (shared with HQ side).
 *
 * Reply: { ok, found, sent, gone }. HQ uses these to decide whether
 * the channel "succeeded" — e.g. found:false means user has no Passport
 * account, which is a 'skipped' not a 'failed' on the HQ side.
 */

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    type?: string;
    idempotencyKey?: string;
    timestamp?: number;
    signature?: string;
    notification?: {
      title?: string;
      body?: string;
      url?: string;
      tag?: string;
      icon?: string;
      image?: string;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const type = String(body.type ?? '').trim();
  const idempotencyKey = String(body.idempotencyKey ?? '').trim();
  const timestamp = Number(body.timestamp ?? 0);
  const signature = String(body.signature ?? '').trim();
  const notif = body.notification ?? {};

  if (!email || !type || !idempotencyKey || !timestamp || !signature) {
    return NextResponse.json(
      { ok: false, error: 'email, type, idempotencyKey, timestamp, signature all required' },
      { status: 400 },
    );
  }
  if (!notif.title || !notif.body) {
    return NextResponse.json(
      { ok: false, error: 'notification.title and notification.body required' },
      { status: 400 },
    );
  }
  if (Math.abs(Date.now() - timestamp) > REPLAY_WINDOW_MS) {
    return NextResponse.json({ ok: false, error: 'Timestamp outside replay window' }, { status: 400 });
  }

  const secret = process.env.PASSPORT_TIER_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'Server misconfiguration (HMAC secret missing)' },
      { status: 500 },
    );
  }

  const canonical = `notify-push|${email}|${type}|${idempotencyKey}|${timestamp}`;
  const expected = createHmac('sha256', secret).update(canonical).digest('hex');
  if (signature.length !== expected.length) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ ok: true, found: false, sent: 0, gone: 0 });
  }

  const result = await sendPushToUser(user.id, {
    title: notif.title,
    body: notif.body,
    url: notif.url,
    tag: notif.tag || idempotencyKey,
    icon: notif.icon,
    image: notif.image,
    data: { type, idempotencyKey },
  });

  return NextResponse.json({
    ok: true,
    found: true,
    sent: result.sent,
    gone: result.gone,
    failed: result.failed,
  });
}
