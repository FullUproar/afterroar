import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';

/**
 * Internal: sync a user's effective tier from FU's Stripe webhook to
 * Passport's `User.membershipTier`.
 *
 * Body: {
 *   email: string,
 *   tier: 'FREE' | 'PRO' | 'VENUE' | 'CONNECT' | string,
 *   status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'incomplete' | string,
 *   source: string,                  // free-form tag for audit logging
 *   timestamp: number,               // unix ms; rejected if older than 5min
 *   signature: string,               // hex HMAC-SHA256
 * }
 *
 * Auth: HMAC-SHA256 over canonical string
 *   `tier-sync|<email>|<tier>|<status>|<timestamp>`
 * signed with PASSPORT_TIER_SYNC_SECRET. Same secret must be configured
 * on FU's apps/site Vercel project.
 *
 * Behavior:
 *   - active|trialing PRO/VENUE/CONNECT → membershipTier = tier
 *   - anything else                     → membershipTier = 'FREE'
 *
 * If parent is on PRO and their tier downgrades to FREE, any of their
 * kid accounts (User.parentUserId = parent.id) flip accountStatus to
 * 'paused' per the parental consent policy.
 *
 * Idempotent — repeated calls with same payload are no-ops. The audit
 * trail is the call's response (which includes the resolved tier).
 */

const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const ALLOWED_TIERS = new Set(['FREE', 'PRO', 'VENUE', 'CONNECT']);
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

interface SyncBody {
  email?: string;
  tier?: string;
  status?: string;
  source?: string;
  timestamp?: number;
  signature?: string;
}

export async function POST(req: NextRequest) {
  let body: SyncBody;
  try {
    body = (await req.json()) as SyncBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const tierRaw = String(body.tier ?? '').trim().toUpperCase();
  const status = String(body.status ?? '').trim().toLowerCase();
  const timestamp = Number(body.timestamp ?? 0);
  const signature = String(body.signature ?? '').trim();

  if (!email || !tierRaw || !status || !timestamp || !signature) {
    return NextResponse.json(
      { ok: false, error: 'email, tier, status, timestamp, signature all required' },
      { status: 400 },
    );
  }

  if (Math.abs(Date.now() - timestamp) > REPLAY_WINDOW_MS) {
    return NextResponse.json(
      { ok: false, error: 'Timestamp outside replay window' },
      { status: 400 },
    );
  }

  const secret = process.env.PASSPORT_TIER_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'Server misconfiguration (HMAC secret missing)' },
      { status: 500 },
    );
  }

  const canonical = `tier-sync|${email}|${tierRaw}|${status}|${timestamp}`;
  const expected = createHmac('sha256', secret).update(canonical).digest('hex');
  // Constant-time compare. Both buffers must be equal length first.
  if (signature.length !== expected.length) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  // Resolve the effective tier. Anything not in the active/trialing
  // status with a known tier name collapses to FREE — the user lost
  // their entitlement.
  const isActive = ACTIVE_STATUSES.has(status);
  const isKnownTier = ALLOWED_TIERS.has(tierRaw);
  const effectiveTier = isActive && isKnownTier ? tierRaw : 'FREE';

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, membershipTier: true, parentUserId: true },
  });

  if (!user) {
    // Not all FU users have a Passport account yet (legacy storefront
    // customers). Return ok:true with `found:false` so the caller can
    // log it without retrying.
    return NextResponse.json({ ok: true, found: false, resolvedTier: effectiveTier });
  }

  if (user.membershipTier === effectiveTier) {
    return NextResponse.json({
      ok: true,
      found: true,
      changed: false,
      userId: user.id,
      resolvedTier: effectiveTier,
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { membershipTier: effectiveTier },
  });

  // Parental-consent cascade: if a parent dropped to FREE, pause any
  // kid accounts that depend on their Pro subscription.
  let kidsPaused = 0;
  if (effectiveTier === 'FREE') {
    const kids = await prisma.user.findMany({
      where: { parentUserId: user.id, accountStatus: 'active' },
      select: { id: true },
    });
    if (kids.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: kids.map((k) => k.id) } },
        data: { accountStatus: 'paused' },
      });
      kidsPaused = kids.length;
    }
  } else if (user.membershipTier === 'FREE' && isActive && isKnownTier) {
    // Parent upgraded — un-pause kid accounts that were paused
    // specifically because of the parent's lapsed Pro.
    const kids = await prisma.user.findMany({
      where: { parentUserId: user.id, accountStatus: 'paused' },
      select: { id: true },
    });
    if (kids.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: kids.map((k) => k.id) } },
        data: { accountStatus: 'active' },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    found: true,
    changed: true,
    userId: user.id,
    previousTier: user.membershipTier,
    resolvedTier: effectiveTier,
    kidsPaused,
    source: body.source ?? null,
  });
}
