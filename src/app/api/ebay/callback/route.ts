import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeEbayCode } from "@/lib/ebay";

/* ------------------------------------------------------------------ */
/*  GET /api/ebay/callback — eBay OAuth callback                       */
/*  eBay redirects here after user consents. We exchange the code for  */
/*  tokens and store them in the store's settings.                     */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const storeId = request.nextUrl.searchParams.get("state"); // We passed storeId as state

  if (!code || !storeId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?ebay=error&reason=missing_params", request.url),
    );
  }

  // Exchange code for tokens
  const tokens = await exchangeEbayCode(code);
  if (!tokens) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?ebay=error&reason=token_exchange_failed", request.url),
    );
  }

  // Verify the store exists
  const store = await prisma.posStore.findUnique({
    where: { id: storeId },
    select: { id: true, settings: true },
  });

  if (!store) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?ebay=error&reason=store_not_found", request.url),
    );
  }

  const settings = (store.settings ?? {}) as Record<string, unknown>;

  // Store tokens (encrypted at rest via Prisma Postgres)
  await prisma.posStore.update({
    where: { id: storeId },
    data: {
      settings: JSON.parse(JSON.stringify({
        ...settings,
        ebay_access_token: tokens.access_token,
        ebay_refresh_token: tokens.refresh_token,
        ebay_token_expires_at: new Date(
          Date.now() + tokens.expires_in * 1000,
        ).toISOString(),
        ebay_connected: true,
        ebay_connected_at: new Date().toISOString(),
        marketplace_sync_enabled: true,
      })),
      updated_at: new Date(),
    },
  });

  console.log(`[eBay OAuth] Store ${storeId} connected to eBay`);

  return NextResponse.redirect(
    new URL("/dashboard/settings?ebay=connected", request.url),
  );
}
