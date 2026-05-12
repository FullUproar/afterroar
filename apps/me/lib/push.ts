/**
 * Server-side Web Push sender for Passport.
 *
 * Sends a notification payload to every active PushSubscription a user
 * has. Cleans up endpoints the push provider has invalidated (410 Gone /
 * 404 Not Found) so the table stays honest.
 *
 * Fire-and-forget — callers shouldn't block on this. If push delivery
 * is critical to your flow, fall back to email at the dispatcher layer.
 */

import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || 'mailto:hello@afterroar.me';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Click target — opens this URL when the user taps the notification. */
  url?: string;
  /** Dedup tag — same tag replaces an in-flight notification on the device. */
  tag?: string;
  icon?: string;
  badge?: string;
  image?: string;
  /** Forwarded into the SW's data.* for arbitrary handler use. */
  data?: Record<string, unknown>;
}

export interface PushSendResult {
  /** Number of subscriptions successfully reached. */
  sent: number;
  /** Subscriptions the provider says are gone (we cleaned them up). */
  gone: number;
  /** Subscriptions where send failed for a recoverable reason. */
  failed: number;
}

/**
 * Send a push notification to every subscription for `userId`. Returns
 * a count summary; never throws.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, gone: 0, failed: 0 };

  if (!configure()) {
    return result;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subscriptions.length === 0) {
    return result;
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    icon: payload.icon,
    badge: payload.badge,
    image: payload.image,
    timestamp: Date.now(),
    data: payload.data,
  });

  const goneEndpoints: string[] = [];
  const reachedIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 24 }, // 24h — beyond that, the message isn't urgent anymore
        );
        result.sent++;
        reachedIds.push(sub.id);
      } catch (err) {
        // 410 Gone or 404 Not Found = endpoint dead, cull it.
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          goneEndpoints.push(sub.endpoint);
          result.gone++;
        } else {
          console.warn('[push] send failed', {
            endpoint: sub.endpoint.slice(0, 60),
            status,
            message: err instanceof Error ? err.message : String(err),
          });
          result.failed++;
        }
      }
    }),
  );

  // Best-effort cleanups + lastUsedAt bumps. Errors here are non-fatal.
  if (goneEndpoints.length > 0) {
    prisma.pushSubscription
      .deleteMany({ where: { endpoint: { in: goneEndpoints } } })
      .catch((e) => console.warn('[push] cull failed', e));
  }
  if (reachedIds.length > 0) {
    prisma.pushSubscription
      .updateMany({
        where: { id: { in: reachedIds } },
        data: { lastUsedAt: new Date() },
      })
      .catch((e) => console.warn('[push] lastUsedAt bump failed', e));
  }

  return result;
}

/**
 * Send the same notification to a list of users. Convenience for fan-out
 * scenarios (e.g. "all members of crew X").
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<PushSendResult> {
  const totals: PushSendResult = { sent: 0, gone: 0, failed: 0 };
  for (const id of userIds) {
    const r = await sendPushToUser(id, payload);
    totals.sent += r.sent;
    totals.gone += r.gone;
    totals.failed += r.failed;
  }
  return totals;
}
