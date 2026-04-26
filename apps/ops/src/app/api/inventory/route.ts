import { NextRequest, NextResponse } from "next/server";
import { requireStaff, requirePermission, handleAuthError } from "@/lib/require-staff";
import { pushInventoryToShopify } from "@/lib/shopify-sync";

export async function GET(request: NextRequest) {
  try {
    const { db, storeId } = await requireStaff();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("pageSize") || "50", 10);
    const skip = (page - 1) * limit;

    const where = { store_id: storeId, active: true };
    const [data, total] = await Promise.all([
      db.posInventoryItem.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: Math.min(limit, 200),
      }),
      db.posInventoryItem.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize: limit });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, storeId } = await requireStaff();

    const body = await request.json();
    const { name, category, price_cents, cost_cents, quantity, barcode, attributes } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const data = await db.posInventoryItem.create({
      data: {
        store_id: storeId,
        name: name.trim(),
        category: category || "other",
        price_cents: price_cents ?? 0,
        cost_cents: cost_cents ?? 0,
        quantity: quantity ?? 0,
        barcode: barcode || null,
        attributes: attributes || {},
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { db, storeId, staff } = await requireStaff();

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Item id is required" }, { status: 400 });
    }

    // Only allow updating known fields. Phase 2 added: barcodes (alt UPCs),
    // parent_id + variant_label (variants), first_cost_cents + last_cost_cents
    // (cost history denormalisation — usually maintained by side effects, but
    // import / admin tools may need to write directly).
    const allowedFields = [
      "name",
      "category",
      "price_cents",
      "cost_cents",
      "quantity",
      "barcode",
      "barcodes",
      "attributes",
      "lendable",
      "online_allocation",
      "active",
      "parent_id",
      "variant_label",
      "first_cost_cents",
      "last_cost_cents",
    ];

    const sanitized: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key];
      }
    }

    // Verify item belongs to this store before updating
    const existing = await db.posInventoryItem.findFirst({
      where: { id, store_id: storeId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // ── Multi-barcode auto-merge ──
    // When the caller assigns a primary `barcode` that's different from the
    // existing one, fold the OLD primary into the alternates array (so it
    // still scans). This lets the auto-learn flow re-key a primary without
    // discarding the legacy code.
    if (
      typeof sanitized.barcode === "string" &&
      sanitized.barcode &&
      existing.barcode &&
      sanitized.barcode !== existing.barcode
    ) {
      const altSet = new Set<string>([
        ...(existing.barcodes ?? []),
        existing.barcode,
      ]);
      // Don't include the new primary in the alt list
      altSet.delete(sanitized.barcode);
      sanitized.barcodes = Array.from(altSet);
    }
    // Dedupe + drop empties on any explicit barcodes write
    if (Array.isArray(sanitized.barcodes)) {
      sanitized.barcodes = Array.from(
        new Set(
          (sanitized.barcodes as unknown[])
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim()),
        ),
      );
    }

    // ── Cost history side effect ──
    // If cost_cents is changing, write a history row + maintain first/last.
    let costChanged = false;
    let nextCost: number | null = null;
    if (
      typeof sanitized.cost_cents === "number" &&
      sanitized.cost_cents !== existing.cost_cents
    ) {
      costChanged = true;
      nextCost = sanitized.cost_cents as number;
      if (existing.first_cost_cents == null && nextCost > 0) {
        sanitized.first_cost_cents = nextCost;
      }
      if (nextCost > 0) {
        sanitized.last_cost_cents = nextCost;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await db.posInventoryItem.update({
      where: { id },
      data: sanitized as any,
    });

    if (costChanged && nextCost != null) {
      // Best-effort — never fail the update if history write fails.
      db.posCostHistory
        .create({
          data: {
            store_id: storeId,
            inventory_item_id: id,
            cost_cents: nextCost,
            source: "manual",
            staff_id: staff.id,
          },
        })
        .catch((err) => console.error("[cost history] write failed", err));
    }

    // Push to Shopify if allocation or quantity changed on a synced item
    if (('online_allocation' in sanitized || 'quantity' in sanitized) && data.shopify_inventory_item_id) {
      pushInventoryToShopify(storeId, id).catch((err) =>
        console.error("[Shopify sync] Failed after inventory update:", err)
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { db, storeId } = await requirePermission("inventory.adjust");

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Item id is required" }, { status: 400 });
    }

    // Verify item belongs to this store
    const existing = await db.posInventoryItem.findFirst({
      where: { id, store_id: storeId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await db.posInventoryItem.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    return handleAuthError(error);
  }
}
