import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { isValidShopDomain, registerWebhook, shopifyFetch, WEBHOOK_TOPICS } from '@/lib/shopify';

/**
 * POST /api/integrations/shopify/claim
 * Body: { shop, token, scope, entityId }
 *
 * Persists a Shopify connection that came in via the App Store install
 * flow (where we don't know the entityId at install time). The caller
 * must own/manage the chosen entity. Re-registers webhooks on the
 * Shopify side so they fire to our receiver.
 *
 * Note: the access token comes from the callback's redirect URL. We
 * trust it because (a) the callback verified Shopify's HMAC before
 * minting it, and (b) the very next thing we do is hit Shopify's
 * /shop.json with the token to confirm it works.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  let body: { shop?: string; token?: string; scope?: string; entityId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const { shop, token, scope, entityId } = body;
  if (!isValidShopDomain(shop) || !token || !entityId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const callerId = session.user!.id as string;

  // Caller must own/manage the entity, and entity must be approved
  const member = await prisma.entityMember.findFirst({
    where: { entityId, userId: callerId, role: { in: ['owner', 'manager'] } },
    include: { entity: { select: { id: true, slug: true, status: true } } },
  });
  if (!member) return NextResponse.json({ error: 'Not authorized for this entity' }, { status: 403 });
  if (member.entity.status !== 'approved') {
    return NextResponse.json({ error: 'Entity is not approved' }, { status: 403 });
  }

  // Verify the token works by hitting /shop.json
  let shopInfo: { name?: string; email?: string; currency?: string } = {};
  try {
    const data = await shopifyFetch<{ shop: { name: string; email: string; currency: string } }>(
      shop,
      token,
      '/shop.json',
    );
    shopInfo = { name: data.shop.name, email: data.shop.email, currency: data.shop.currency };
  } catch {
    return NextResponse.json({ error: 'Token rejected by Shopify — please reinstall' }, { status: 400 });
  }

  // Make sure no OTHER entity already owns this shop
  const existingForShop = await prisma.shopifyConnection.findUnique({ where: { shopDomain: shop } });
  if (existingForShop && existingForShop.entityId !== entityId) {
    return NextResponse.json({ error: 'This Shopify shop is already connected to a different entity' }, { status: 409 });
  }

  await prisma.shopifyConnection.upsert({
    where: { entityId },
    create: {
      entityId,
      shopDomain: shop,
      accessToken: token,
      scopes: scope || '',
      shopName: shopInfo.name,
      shopEmail: shopInfo.email,
      currency: shopInfo.currency,
      active: true,
    },
    update: {
      shopDomain: shop,
      accessToken: token,
      scopes: scope || '',
      shopName: shopInfo.name,
      shopEmail: shopInfo.email,
      currency: shopInfo.currency,
      active: true,
      uninstalledAt: null,
    },
  });

  // Re-register webhooks (idempotent — duplicates return 422 which we swallow)
  for (const topic of WEBHOOK_TOPICS) {
    try { await registerWebhook(shop, token, topic); } catch (err) {
      console.error(`[shopify-claim] webhook ${topic} failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, slug: member.entity.slug });
}
