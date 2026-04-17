import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth-config';
import {
  exchangeCodeForToken,
  isValidShopDomain,
  registerWebhook,
  shopifyFetch,
  verifyOauthCallback,
  WEBHOOK_TOPICS,
} from '@/lib/shopify';

/**
 * GET /api/integrations/shopify/callback
 *
 * Shopify redirects here after the merchant authorizes the app. We:
 *  1. verify the HMAC on the callback query string
 *  2. validate the state nonce (and that it isn't expired or already used)
 *  3. exchange the auth code for a permanent access token
 *  4. fetch shop info (name, currency, email) to enrich our record
 *  5. upsert the ShopifyConnection row keyed by entityId
 *  6. register webhooks (orders/paid, refunds/create, app/uninstalled, GDPR trio)
 *  7. redirect the merchant to their Connect dashboard
 *
 * If the install came from the Shopify App Store (no entityId in state),
 * we redirect to a small claim page that asks the signed-in Passport user
 * to associate this Shopify shop with one of their entities.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  if (!verifyOauthCallback(searchParams)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 400 });
  }

  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!isValidShopDomain(shop) || !code || !state) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  }

  // Validate state — single use, must not be expired
  const stateRow = await prisma.shopifyOauthState.findUnique({ where: { state } });
  if (!stateRow || stateRow.shopDomain !== shop || stateRow.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired state' }, { status: 400 });
  }
  await prisma.shopifyOauthState.delete({ where: { state } });

  // Exchange code for permanent token
  const { accessToken, scope } = await exchangeCodeForToken(shop, code);

  // Pull basic shop info (best-effort — failure here shouldn't block install)
  let shopInfo: { name?: string; email?: string; currency?: string } = {};
  try {
    const data = await shopifyFetch<{ shop: { name: string; email: string; currency: string } }>(
      shop,
      accessToken,
      '/shop.json',
    );
    shopInfo = { name: data.shop.name, email: data.shop.email, currency: data.shop.currency };
  } catch (err) {
    console.error('[shopify-callback] shop.json fetch failed:', err);
  }

  // If no entity was attached at install time, route to claim flow
  if (!stateRow.entityId) {
    const session = await auth();
    if (!session?.user?.id) {
      // Stash the install for completion after sign-in
      const claimUrl = `/integrations/shopify/claim?shop=${shop}&token=${encodeURIComponent(accessToken)}&scope=${encodeURIComponent(scope)}`;
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(claimUrl)}`, request.url));
    }
    return NextResponse.redirect(
      new URL(`/integrations/shopify/claim?shop=${shop}&token=${encodeURIComponent(accessToken)}&scope=${encodeURIComponent(scope)}`, request.url),
    );
  }

  // Upsert the connection
  await prisma.shopifyConnection.upsert({
    where: { entityId: stateRow.entityId },
    create: {
      entityId: stateRow.entityId,
      shopDomain: shop,
      accessToken,
      scopes: scope,
      shopName: shopInfo.name,
      shopEmail: shopInfo.email,
      currency: shopInfo.currency,
      active: true,
    },
    update: {
      shopDomain: shop,
      accessToken,
      scopes: scope,
      shopName: shopInfo.name,
      shopEmail: shopInfo.email,
      currency: shopInfo.currency,
      active: true,
      uninstalledAt: null,
    },
  });

  // Register webhooks in parallel (best-effort, non-blocking on individual failures)
  await Promise.allSettled(
    WEBHOOK_TOPICS.map((topic) =>
      registerWebhook(shop, accessToken, topic).catch((err) =>
        console.error(`[shopify-callback] webhook ${topic} register failed:`, err)
      )
    )
  );

  // Look up entity slug for redirect
  const entity = await prisma.afterroarEntity.findUnique({
    where: { id: stateRow.entityId },
    select: { slug: true },
  });

  const redirectUrl = entity ? `/store/${entity.slug}?shopify=connected` : '/store';
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
