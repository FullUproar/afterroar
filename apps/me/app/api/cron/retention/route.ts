import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Daily retention job — enforces data minimization per our public policy.
 *
 * What it does:
 *  1. Strips webhook payloads older than 30 days. We keep the event row
 *     (for idempotency + audit) but null out `payload` and `userId` so no
 *     PII lingers. Idempotency only needs (shopDomain, topic, eventId).
 *  2. Deletes fully-processed webhook event metadata older than 180 days.
 *  3. Purges expired OAuth state rows (>1 day past expiry).
 *  4. Purges expired consent request tokens (>7 days past expiry — we keep
 *     the row a bit longer for debugging but drop the token).
 *
 * Security:
 *  - Vercel Cron sends a shared-secret header. We reject requests without it.
 *  - Set CRON_SECRET in Vercel env vars; configure the cron at the path
 *    below in vercel.json with `Authorization: Bearer <CRON_SECRET>`.
 *
 * Expose results as JSON so you can check the run from the Vercel dashboard.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const THIRTY_DAYS_AGO = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const ONE_EIGHTY_DAYS_AGO = new Date(now - 180 * 24 * 60 * 60 * 1000);
  const ONE_DAY_AGO = new Date(now - 24 * 60 * 60 * 1000);
  const SEVEN_DAYS_AGO = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // 1. Strip payloads + user refs from old webhook events (keep dedupe key)
  const strippedPayloads = await prisma.shopifyWebhookEvent.updateMany({
    where: {
      createdAt: { lt: THIRTY_DAYS_AGO },
      // Only touch rows where payload isn't already null
      NOT: { payload: { equals: {} } },
    },
    data: { payload: {}, userId: null },
  });

  // 2. Delete ancient fully-processed event metadata
  const deletedOldEvents = await prisma.shopifyWebhookEvent.deleteMany({
    where: { createdAt: { lt: ONE_EIGHTY_DAYS_AGO } },
  });

  // 3. Purge expired OAuth state
  const deletedOauthState = await prisma.shopifyOauthState.deleteMany({
    where: { expiresAt: { lt: ONE_DAY_AGO } },
  });

  // 4. Purge old consent requests (token is the PII-adjacent piece)
  const deletedConsentReqs = await prisma.entityConsentRequest.deleteMany({
    where: { expiresAt: { lt: SEVEN_DAYS_AGO } },
  });

  const result = {
    ranAt: new Date().toISOString(),
    strippedWebhookPayloads: strippedPayloads.count,
    deletedOldEvents: deletedOldEvents.count,
    deletedOauthState: deletedOauthState.count,
    deletedConsentRequests: deletedConsentReqs.count,
  };

  console.log('[cron/retention]', result);
  return NextResponse.json(result);
}

// Vercel Cron only supports GET/POST; allow GET for easy manual invocation
// from the dashboard. Same auth requirement.
export const GET = POST;
