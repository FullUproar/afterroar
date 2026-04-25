import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Live operational status for the Sidebar — feeds the badges next to nav
 * items so the operator sees attention items without drilling in.
 *
 * Returns the four counts the new Operator Console sidebar shows:
 *   register_live — any register activity in the last 10 minutes (Live badge)
 *   buylist_waiting — buylist requests pending review
 *   inventory_low — distinct SKUs at or below their reorder point
 *   devices_offline — peripherals (scanner, printer, reader) not connected
 *
 * The first two are Prisma-queried; the last two are placeholders that
 * resolve to 0 when the underlying tables aren't present (graceful degrade).
 */

const LIVE_WINDOW_MS = 10 * 60 * 1000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const sessionStoreId = (session as unknown as Record<string, unknown>).storeId as string | undefined;
  let storeId = sessionStoreId;
  if (!storeId) {
    const staff = await prisma.posStaff.findFirst({
      where: { user_id: session.user.id, active: true },
      select: { store_id: true },
    });
    storeId = staff?.store_id;
  }
  if (!storeId) {
    return NextResponse.json({
      register_live: false,
      buylist_waiting: 0,
      inventory_low: 0,
      devices_offline: 0,
    });
  }

  const since = new Date(Date.now() - LIVE_WINDOW_MS);

  const [recentSale, lowStock, buylistWaiting] = await Promise.all([
    prisma.posLedgerEntry.findFirst({
      where: { store_id: storeId, type: "sale", created_at: { gte: since } },
      select: { id: true },
    }).catch(() => null),
    prisma.posInventoryItem
      .count({
        where: {
          store_id: storeId,
          // reorder_point is the threshold; quantity <= that = low
          // raw query because Prisma doesn't allow column-vs-column compare in `where`
        },
      })
      .then(async () => {
        try {
          const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "PosInventoryItem"
            WHERE store_id = ${storeId}
              AND reorder_point IS NOT NULL
              AND quantity <= reorder_point
          `;
          return Number(rows[0]?.count ?? 0);
        } catch {
          return 0;
        }
      })
      .catch(() => 0),
    // Buylist queue placeholder — table may not exist yet; return 0 cleanly.
    (async () => {
      try {
        const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "PosBuylistRequest"
          WHERE store_id = ${storeId}
            AND status IN ('pending', 'reviewing')
        `;
        return Number(rows[0]?.count ?? 0);
      } catch {
        return 0;
      }
    })(),
  ]);

  return NextResponse.json({
    register_live: !!recentSale,
    buylist_waiting: buylistWaiting,
    inventory_low: lowStock,
    devices_offline: 0, // Hardware connection state lives client-side; sidebar doesn't query it.
  });
}
