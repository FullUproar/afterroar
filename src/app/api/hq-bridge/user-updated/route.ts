import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { opLog } from "@/lib/op-log";

/* ------------------------------------------------------------------ */
/*  POST /api/hq-bridge/user-updated                                   */
/*  HQ notifies us that an Afterroar user updated their profile.       */
/*  We store the HQ display name + avatar in the customer's            */
/*  attributes so the store-entered name is always preserved.          */
/*                                                                     */
/*  Auth: Bearer token matched against each store's hq_webhook_secret  */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing auth" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Missing auth" }, { status: 401 });
  }

  // Verify the bearer token matches at least one store's webhook secret.
  const stores = await prisma.posStore.findMany({
    where: {
      settings: { path: ["hq_webhook_secret"], equals: token },
    },
    select: { id: true },
  });

  if (stores.length === 0) {
    return NextResponse.json({ error: "Invalid auth" }, { status: 401 });
  }

  let body: { afterroar_user_id: string; displayName?: string; avatarUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { afterroar_user_id, displayName, avatarUrl } = body;
  if (!afterroar_user_id) {
    return NextResponse.json(
      { error: "afterroar_user_id required" },
      { status: 400 },
    );
  }

  if (!displayName && !avatarUrl) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // Find ALL customers across ALL stores linked to this Afterroar user
  const linkedCustomers = await prisma.posCustomer.findMany({
    where: { afterroar_user_id },
    select: { id: true, store_id: true, name: true, tags: true },
  });

  if (linkedCustomers.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  for (const cust of linkedCustomers) {
    // Store HQ profile data as prefixed tags to preserve the store-entered name.
    // Format: "afterroar_display_name::John Doe", "afterroar_avatar_url::https://..."
    const currentTags = (cust.tags ?? []) as string[];
    let newTags = [...currentTags];

    if (displayName) {
      newTags = newTags.filter((t) => !t.startsWith("afterroar_display_name::"));
      newTags.push(`afterroar_display_name::${displayName}`);
    }
    if (avatarUrl) {
      newTags = newTags.filter((t) => !t.startsWith("afterroar_avatar_url::"));
      newTags.push(`afterroar_avatar_url::${avatarUrl}`);
    }

    await prisma.posCustomer.update({
      where: { id: cust.id },
      data: { tags: { set: newTags } },
    });

    opLog({
      storeId: cust.store_id,
      eventType: "passport.updated",
      severity: "info",
      message: `Afterroar profile updated for "${cust.name}"`,
      metadata: {
        afterroar_user_id,
        customer_id: cust.id,
        ...(displayName ? { displayName } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true, updated: linkedCustomers.length });
}
