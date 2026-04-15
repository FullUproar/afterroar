import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { buildAuthorizeUrl, isValidShopDomain, newOauthState } from '@/lib/shopify';

/**
 * GET /api/integrations/shopify/install?shop=foo.myshopify.com&entityId=...
 *
 * Two paths:
 *  1. Merchant clicks "Install Shopify" from their Connect dashboard
 *     → entityId is in the query, caller must be an EntityMember.
 *  2. Shopify redirects merchants from the App Store with `shop` only
 *     → entityId is null; we'll associate during callback by asking the
 *     merchant to sign into Afterroar first (handled by the callback).
 *
 * In both cases we mint a state nonce, persist it with shopDomain (and
 * entityId if known), and 302 to Shopify's authorize endpoint.
 */
const STATE_TTL_MINUTES = 10;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  const entityId = searchParams.get('entityId');

  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
  }

  // If entityId is supplied, the caller must own that entity.
  if (entityId) {
    const session = await auth();
    if (!session?.user?.id) {
      const callback = `/api/integrations/shopify/install?shop=${shop}&entityId=${entityId}`;
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(callback)}`, request.url));
    }
    const member = await prisma.entityMember.findFirst({
      where: { entityId, userId: session.user.id as string },
    });
    if (!member) {
      return NextResponse.json({ error: 'Not a member of this entity' }, { status: 403 });
    }
  }

  const state = newOauthState();
  await prisma.shopifyOauthState.create({
    data: {
      state,
      shopDomain: shop,
      entityId,
      expiresAt: new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000),
    },
  });

  return NextResponse.redirect(buildAuthorizeUrl(shop, state));
}
