import { NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

/**
 * GET /api/inventory/:id/variants
 *
 * Returns the variant family for an inventory item:
 *  - parent (if `id` is a child) or self (if `id` is a parent)
 *  - all sibling variants (other rows with same parent_id, plus parent)
 *
 * Used by the register variant picker — scan a parent SKU, see the cover
 * options laid out as tiles. Also used by the inventory edit form to manage
 * the variant family.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, storeId } = await requireStaff();
    const { id } = await params;

    const item = await db.posInventoryItem.findFirst({
      where: { id, store_id: storeId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Resolve the canonical parent id: if this item has a parent, use it;
    // otherwise this item IS the parent.
    const parentId = item.parent_id ?? item.id;

    const [parent, variants] = await Promise.all([
      db.posInventoryItem.findFirst({
        where: { id: parentId, store_id: storeId },
      }),
      db.posInventoryItem.findMany({
        where: {
          store_id: storeId,
          parent_id: parentId,
          active: true,
        },
        orderBy: [{ variant_label: "asc" }, { name: "asc" }],
      }),
    ]);

    // The full family includes the parent itself (if it's still sellable) +
    // all variant children. Some stores only sell variants and treat the
    // parent as a "concept" — we leave that judgment to the UI by including
    // the parent and letting it choose to show/hide.
    return NextResponse.json({
      parent,
      variants,
      family_size: variants.length + (parent ? 1 : 0),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
