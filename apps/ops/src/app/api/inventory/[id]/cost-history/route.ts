import { NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

/**
 * GET /api/inventory/:id/cost-history
 * Returns the cost-change timeline for an inventory item, newest first.
 * Source values: "po", "manual", "import", "trade_in".
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, storeId } = await requireStaff();
    const { id } = await params;

    // Confirm the item belongs to this store before exposing history.
    const item = await db.posInventoryItem.findFirst({
      where: { id, store_id: storeId },
      select: {
        id: true,
        name: true,
        cost_cents: true,
        first_cost_cents: true,
        last_cost_cents: true,
      },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const history = await db.posCostHistory.findMany({
      where: { inventory_item_id: id, store_id: storeId },
      orderBy: { created_at: "desc" },
      take: 200,
    });

    return NextResponse.json({
      item,
      history,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
