import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookHmac } from '@/lib/shopify';
import { handleOrderPaid, handleRefundCreate, handleAppUninstalled, handleGdpr } from '@/lib/shopify-handlers';

/**
 * POST /api/integrations/shopify/webhook
 *
 * Single entry point for all Shopify webhook topics. Topic + shop come
 * from headers. We:
 *  1. Read the raw body (required for HMAC verification)
 *  2. Verify the HMAC against SHOPIFY_API_SECRET — reject 401 if invalid
 *  3. Dedupe via (shopDomain, topic, eventId) on ShopifyWebhookEvent
 *  4. Dispatch to the right handler in lib/shopify-handlers.ts
 *  5. Update the event log with the result
 *
 * Always returns 200 OK after HMAC passes — Shopify treats non-200 as
 * "retry forever," and we already have idempotency. Errors during
 * processing are recorded in `result` instead of failing the response.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmac = request.headers.get('x-shopify-hmac-sha256');

  if (!verifyWebhookHmac(rawBody, hmac)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
  }

  const shopDomain = request.headers.get('x-shopify-shop-domain') || '';
  const topic = request.headers.get('x-shopify-topic') || '';
  const eventId = request.headers.get('x-shopify-webhook-id') || '';

  if (!shopDomain || !topic || !eventId) {
    return NextResponse.json({ error: 'Missing Shopify headers' }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const orderId = extractOrderId(topic, payload);

  // Idempotency: insert-or-skip via the unique constraint
  let eventRow;
  try {
    eventRow = await prisma.shopifyWebhookEvent.create({
      data: { shopDomain, topic, eventId, orderId, payload: payload as object },
    });
  } catch {
    // Already processed — Shopify retried. Acknowledge and bail.
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Dispatch
  let result = 'skipped:no-handler';
  let pointsDelta: number | undefined;
  let userId: string | undefined;
  try {
    switch (topic) {
      case 'orders/paid': {
        const r = await handleOrderPaid(shopDomain, payload);
        result = r.result;
        pointsDelta = r.pointsDelta;
        userId = r.userId;
        break;
      }
      case 'refunds/create': {
        const r = await handleRefundCreate(shopDomain, payload);
        result = r.result;
        pointsDelta = r.pointsDelta;
        userId = r.userId;
        break;
      }
      case 'app/uninstalled': {
        result = await handleAppUninstalled(shopDomain);
        break;
      }
      case 'customers/data_request':
      case 'customers/redact':
      case 'shop/redact': {
        result = await handleGdpr(topic, shopDomain, payload);
        break;
      }
    }
  } catch (err) {
    result = `error:${(err as Error).message.slice(0, 200)}`;
    console.error(`[shopify-webhook ${topic}]`, err);
  }

  await prisma.shopifyWebhookEvent.update({
    where: { id: eventRow.id },
    data: { processedAt: new Date(), result, pointsDelta, userId },
  });

  await prisma.shopifyConnection.updateMany({
    where: { shopDomain },
    data: { lastWebhookAt: new Date() },
  });

  return NextResponse.json({ ok: true, result });
}

function extractOrderId(topic: string, payload: Record<string, unknown>): string | null {
  if (topic === 'orders/paid') return String((payload as { id?: number }).id ?? '') || null;
  if (topic === 'refunds/create') {
    const orderId = (payload as { order_id?: number }).order_id;
    return orderId ? String(orderId) : null;
  }
  return null;
}
