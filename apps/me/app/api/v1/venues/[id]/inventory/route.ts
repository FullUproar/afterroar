/**
 * GET /api/v1/venues/:id/inventory
 *
 * POS inventory + active checkouts for any pos_stores linked to a venue.
 * Linkage: pos_stores.settings.venueId === venueId.
 *
 * Returns:
 *   {
 *     items: [{
 *       id: string,
 *       title: string,
 *       sku: string|null,
 *       imageUrl: string|null,
 *       quantity: number,
 *       availableQuantity: number,    // quantity minus active checkouts
 *       lendable: boolean,
 *       activeCheckouts: [{
 *         customerName: string|null,
 *         tableNumber: string|null,
 *         checkedOutAt: string|null,  // ISO
 *       }]
 *     }],
 *     storeIds: string[],              // for follow-up calls
 *   }
 *
 * If no pos_stores are linked, returns empty arrays.
 *
 * Scope: read:venues:inventory
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";

export const GET = withApiKey<{ id: string }>(
  async (_req: NextRequest, { params }) => {
    const { id } = await params;

    const stores = await prisma.posStore.findMany({
      where: { settings: { path: ["venueId"], equals: id } },
      select: { id: true },
    });
    if (stores.length === 0) {
      return NextResponse.json({ items: [], storeIds: [] });
    }
    const storeIds = stores.map((s) => s.id);

    const items = await prisma.posInventoryItem.findMany({
      where: { store_id: { in: storeIds }, active: true, lendable: true },
      orderBy: { name: "asc" },
    });
    if (items.length === 0) {
      return NextResponse.json({ items: [], storeIds });
    }

    const itemIds = items.map((i) => i.id);
    const checkouts = await prisma.posGameCheckout
      .findMany({
        where: { inventory_item_id: { in: itemIds }, status: "out" },
        select: {
          inventory_item_id: true,
          table_number: true,
          checked_out_at: true,
          customer: { select: { name: true } },
        },
      })
      .catch(() => []);

    const byItem = new Map<string, typeof checkouts>();
    for (const co of checkouts) {
      const arr = byItem.get(co.inventory_item_id) ?? [];
      arr.push(co);
      byItem.set(co.inventory_item_id, arr);
    }

    return NextResponse.json({
      items: items.map((item) => {
        const itemCheckouts = byItem.get(item.id) ?? [];
        return {
          id: item.id,
          title: item.name,
          sku: item.sku,
          imageUrl: item.image_url,
          quantity: item.quantity,
          availableQuantity: Math.max(0, item.quantity - itemCheckouts.length),
          lendable: item.lendable,
          activeCheckouts: itemCheckouts.map((co) => ({
            customerName: co.customer?.name ?? null,
            tableNumber: co.table_number,
            checkedOutAt: co.checked_out_at?.toISOString() ?? null,
          })),
        };
      }),
      storeIds,
    });
  },
  "read:venues:inventory",
);
