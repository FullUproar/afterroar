import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

/* ------------------------------------------------------------------ */
/*  GET /api/inventory/export — CSV of every active inventory item.   */
/*                                                                     */
/*  Needed for data portability: a store that wants to leave should    */
/*  be able to walk away with their catalog. Also useful for backup    */
/*  snapshots between sales-tax filings.                               */
/*                                                                     */
/*  Query params:                                                       */
/*    active=true|false|all   (default: true)                          */
/*    category=board_game|... (optional, exact match)                  */
/* ------------------------------------------------------------------ */

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const { db } = await requirePermission("inventory.view");

    const url = new URL(req.url);
    const activeParam = url.searchParams.get("active") ?? "true";
    const category = url.searchParams.get("category");

    const where: Record<string, unknown> = {};
    if (activeParam === "true") where.active = true;
    else if (activeParam === "false") where.active = false;
    if (category) where.category = category;

    const items = await db.posInventoryItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        sku: true,
        barcode: true,
        price_cents: true,
        cost_cents: true,
        quantity: true,
        low_stock_threshold: true,
        reorder_point: true,
        active: true,
        lendable: true,
        created_at: true,
        updated_at: true,
        supplier: { select: { name: true } },
      },
    });

    const headers = [
      "id",
      "name",
      "category",
      "sku",
      "barcode",
      "price_dollars",
      "cost_dollars",
      "quantity",
      "low_stock_threshold",
      "reorder_point",
      "active",
      "lendable",
      "supplier",
      "created_at",
      "updated_at",
    ];

    const lines = [headers.join(",")];
    for (const it of items) {
      lines.push(
        [
          it.id,
          it.name,
          it.category,
          it.sku ?? "",
          it.barcode ?? "",
          (it.price_cents / 100).toFixed(2),
          (it.cost_cents / 100).toFixed(2),
          it.quantity,
          it.low_stock_threshold,
          it.reorder_point ?? "",
          it.active,
          it.lendable,
          it.supplier?.name ?? "",
          it.created_at.toISOString(),
          it.updated_at.toISOString(),
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    const csv = lines.join("\n");
    const filename = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
