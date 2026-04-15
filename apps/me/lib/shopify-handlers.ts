/**
 * Shopify webhook topic handlers.
 *
 * Each handler returns a structured result that the receiver records to
 * `ShopifyWebhookEvent.result`. Idempotency is enforced upstream by the
 * unique constraint on (shopDomain, topic, eventId), so handlers can
 * assume they only run once per event.
 *
 * The points award path here mirrors the one in
 * /api/store/points/route.ts intentionally — same balance recompute,
 * same consent gate. We don't share code yet because the inputs differ
 * enough (HTTP body vs Shopify payload) that a shared helper would
 * obscure the validation. Worth extracting once we add Square + Lightspeed.
 */

import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

interface HandlerResult {
  result: string;
  pointsDelta?: number;
  userId?: string;
}

/**
 * Order paid → award points to the matching Passport, if any.
 * Matching strategy:
 *  1. Look for an 8-char Passport code in note_attributes (key=passport_code)
 *     or in the order note. Stores can prompt for it at checkout.
 *  2. Fall back to email match on customer.email → User.email.
 */
export async function handleOrderPaid(shopDomain: string, payload: Record<string, unknown>): Promise<HandlerResult> {
  const conn = await prisma.shopifyConnection.findUnique({ where: { shopDomain } });
  if (!conn || !conn.active) return { result: 'skipped:connection-inactive' };

  const order = payload as unknown as ShopifyOrder;
  const orderId = String(order.id);

  // Skip if already awarded for this Shopify order
  const prior = await prisma.pointsLedger.findFirst({
    where: {
      storeId: conn.entityId,
      action: 'earn',
      metadata: { contains: `"shopifyOrderId":"${orderId}"` },
    },
    select: { id: true },
  });
  if (prior) return { result: 'skipped:already-awarded' };

  const subtotalCents = parseMoneyToCents(order.subtotal_price ?? order.total_price);
  if (subtotalCents < conn.minOrderCents) {
    return { result: `skipped:below-min-${subtotalCents}c` };
  }

  const user = await findPassportUser(order);
  if (!user) return { result: 'skipped:no-passport-match' };

  // Consent gate — must include 'points'
  const consent = await prisma.entityConsent.findUnique({
    where: { userId_entityId: { userId: user.id, entityId: conn.entityId } },
  });
  if (
    !consent ||
    consent.revokedAt ||
    (consent.expiresAt && consent.expiresAt < new Date()) ||
    !consent.scopes.includes('points')
  ) {
    return { result: 'skipped:no-consent', userId: user.id };
  }

  const points = Math.floor((subtotalCents / 100) * conn.pointsPerDollar);
  if (points <= 0) return { result: 'skipped:zero-points', userId: user.id };

  const entry = await prisma.$transaction(async (tx) => {
    const last = await tx.pointsLedger.findFirst({
      where: { userId: user.id, storeId: conn.entityId },
      orderBy: { createdAt: 'desc' },
      select: { balance: true },
    });
    const prevBalance = last?.balance ?? 0;
    return tx.pointsLedger.create({
      data: {
        userId: user.id,
        storeId: conn.entityId,
        amount: points,
        balance: prevBalance + points,
        action: 'earn',
        category: 'shopify',
        description: `Shopify order #${order.order_number ?? order.name ?? orderId}`,
        metadata: JSON.stringify({
          source: 'shopify',
          shopifyOrderId: orderId,
          shopDomain,
          orderTotal: order.total_price,
        }),
      },
    });
  });

  audit({
    actorRole: 'webhook',
    action: 'points.earn',
    targetType: 'User',
    targetId: user.id,
    entityId: conn.entityId,
    scopesUsed: ['points'],
    metadata: { source: 'shopify', shopifyOrderId: orderId, points },
  });

  return { result: 'awarded', pointsDelta: points, userId: user.id };
}

/**
 * Refund → reverse the equivalent points (capped at what was originally awarded).
 * If we can't find the original award, no-op.
 */
export async function handleRefundCreate(shopDomain: string, payload: Record<string, unknown>): Promise<HandlerResult> {
  const conn = await prisma.shopifyConnection.findUnique({ where: { shopDomain } });
  if (!conn || !conn.active) return { result: 'skipped:connection-inactive' };

  const refund = payload as unknown as ShopifyRefund;
  const orderId = String(refund.order_id);

  const original = await prisma.pointsLedger.findFirst({
    where: {
      storeId: conn.entityId,
      action: 'earn',
      metadata: { contains: `"shopifyOrderId":"${orderId}"` },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!original) return { result: 'skipped:no-original-award' };

  // Sum any prior reversals for this order to cap correctly
  const priorReversals = await prisma.pointsLedger.aggregate({
    where: {
      storeId: conn.entityId,
      userId: original.userId,
      action: 'redeem',
      category: 'shopify-refund',
      metadata: { contains: `"shopifyOrderId":"${orderId}"` },
    },
    _sum: { amount: true },
  });
  const alreadyReversed = Math.abs(priorReversals._sum.amount ?? 0);
  const remainingReversible = original.amount - alreadyReversed;
  if (remainingReversible <= 0) return { result: 'skipped:fully-reversed' };

  const refundCents = parseMoneyToCents(sumRefundAmount(refund));
  const proportionalPoints = Math.floor((refundCents / 100) * conn.pointsPerDollar);
  const reversal = Math.min(proportionalPoints, remainingReversible);
  if (reversal <= 0) return { result: 'skipped:zero-reversal', userId: original.userId };

  await prisma.$transaction(async (tx) => {
    const last = await tx.pointsLedger.findFirst({
      where: { userId: original.userId, storeId: conn.entityId },
      orderBy: { createdAt: 'desc' },
      select: { balance: true },
    });
    const prevBalance = last?.balance ?? 0;
    await tx.pointsLedger.create({
      data: {
        userId: original.userId,
        storeId: conn.entityId,
        amount: -reversal,
        balance: prevBalance - reversal,
        action: 'redeem',
        category: 'shopify-refund',
        description: `Refund on Shopify order ${orderId}`,
        metadata: JSON.stringify({
          source: 'shopify',
          shopifyOrderId: orderId,
          shopifyRefundId: String(refund.id),
          originalLedgerId: original.id,
        }),
      },
    });
  });

  return { result: 'reversed', pointsDelta: -reversal, userId: original.userId };
}

export async function handleAppUninstalled(shopDomain: string): Promise<string> {
  await prisma.shopifyConnection.updateMany({
    where: { shopDomain },
    data: { active: false, uninstalledAt: new Date() },
  });
  return 'uninstalled';
}

/**
 * GDPR mandatory webhooks. Per Shopify's requirements:
 *  - customers/data_request: log the request, no automated response required.
 *    Merchants are responsible for forwarding to us — we hold customer data
 *    only by reference (passportCode/email) and the Passport itself is the
 *    customer's own record on afterroar.me. No bulk export needed.
 *  - customers/redact: same — we never persist Shopify customer PII directly.
 *  - shop/redact: 48 hours after uninstall, Shopify asks us to purge.
 */
export async function handleGdpr(topic: string, shopDomain: string, _payload: Record<string, unknown>): Promise<string> {
  if (topic === 'shop/redact') {
    // Delete connection + webhook event log for the shop
    await prisma.shopifyWebhookEvent.deleteMany({ where: { shopDomain } });
    await prisma.shopifyConnection.deleteMany({ where: { shopDomain } });
    return 'shop-redacted';
  }
  // Customer-level requests are no-ops by design; we don't store Shopify
  // customer PII (we only match-and-forward to Passport, which the customer
  // already controls). Logged via the event row above.
  return `gdpr:${topic}:noop`;
}

// ----- internals -----

interface ShopifyOrder {
  id: number;
  order_number?: number;
  name?: string;
  total_price?: string;
  subtotal_price?: string;
  email?: string;
  customer?: { id?: number; email?: string };
  note?: string | null;
  note_attributes?: Array<{ name: string; value: string }>;
}

interface ShopifyRefund {
  id: number;
  order_id: number;
  refund_line_items?: Array<{ subtotal?: string; total_tax?: string }>;
  transactions?: Array<{ amount?: string; kind?: string }>;
}

const PASSPORT_RE = /\b([A-HJKMNP-Z2-9]{8})\b/i;

async function findPassportUser(order: ShopifyOrder) {
  // 1. note_attributes lookup (case-insensitive on the attribute name)
  const noteAttr = order.note_attributes?.find((a) => /passport[_\s-]?code/i.test(a.name));
  if (noteAttr?.value) {
    const code = noteAttr.value.trim().toUpperCase();
    if (PASSPORT_RE.test(code)) {
      const user = await prisma.user.findUnique({ where: { passportCode: code } });
      if (user) return user;
    }
  }

  // 2. order note free-text scan
  if (order.note) {
    const m = order.note.match(PASSPORT_RE);
    if (m) {
      const user = await prisma.user.findUnique({ where: { passportCode: m[1].toUpperCase() } });
      if (user) return user;
    }
  }

  // 3. email fallback
  const email = (order.customer?.email || order.email || '').trim().toLowerCase();
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) return user;
  }

  return null;
}

function parseMoneyToCents(amount: string | number | null | undefined): number {
  if (amount == null) return 0;
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function sumRefundAmount(refund: ShopifyRefund): string {
  // Prefer transactions (the actual money moved); fall back to refund_line_items
  const txTotal = (refund.transactions || [])
    .filter((t) => t.kind === 'refund')
    .reduce((acc, t) => acc + parseFloat(t.amount || '0'), 0);
  if (txTotal > 0) return txTotal.toFixed(2);

  const lineTotal = (refund.refund_line_items || [])
    .reduce((acc, li) => acc + parseFloat(li.subtotal || '0'), 0);
  return lineTotal.toFixed(2);
}
