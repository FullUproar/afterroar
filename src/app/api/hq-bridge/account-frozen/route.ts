import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { opLog } from "@/lib/op-log";

/* ------------------------------------------------------------------ */
/*  POST /api/hq-bridge/account-frozen                                 */
/*  HQ notifies us that an Afterroar user's account was frozen or      */
/*  unfrozen. We tag/untag ALL matching customers across ALL stores.    */
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

  let body: { afterroar_user_id: string; frozen: boolean; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { afterroar_user_id, frozen, reason } = body;
  if (!afterroar_user_id || typeof frozen !== "boolean") {
    return NextResponse.json(
      { error: "afterroar_user_id and frozen (boolean) required" },
      { status: 400 },
    );
  }

  // Find ALL customers across ALL stores linked to this Afterroar user
  const linkedCustomers = await prisma.posCustomer.findMany({
    where: { afterroar_user_id },
    select: { id: true, store_id: true, name: true, tags: true },
  });

  if (linkedCustomers.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const TAG = "afterroar_frozen";

  for (const cust of linkedCustomers) {
    const currentTags = (cust.tags ?? []) as string[];
    const hasTag = currentTags.includes(TAG);

    if (frozen && !hasTag) {
      // Add frozen tag
      await prisma.posCustomer.update({
        where: { id: cust.id },
        data: { tags: { push: TAG } },
      });
    } else if (!frozen && hasTag) {
      // Remove frozen tag
      const newTags = currentTags.filter((t) => t !== TAG);
      await prisma.posCustomer.update({
        where: { id: cust.id },
        data: { tags: { set: newTags } },
      });
    }

    opLog({
      storeId: cust.store_id,
      eventType: frozen ? "passport.frozen" : "passport.unfrozen",
      severity: frozen ? "warn" : "info",
      message: `Afterroar account ${frozen ? "frozen" : "unfrozen"} for "${cust.name}"${reason ? ` — ${reason}` : ""}`,
      metadata: { afterroar_user_id, customer_id: cust.id, frozen, reason },
    });
  }

  return NextResponse.json({ ok: true, updated: linkedCustomers.length });
}
