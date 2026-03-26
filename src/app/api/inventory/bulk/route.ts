import { NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

/* ------------------------------------------------------------------ */
/*  GET /api/inventory/bulk — full inventory snapshot for offline cache */
/* ------------------------------------------------------------------ */
export async function GET() {
  try {
    const { db } = await requireStaff();

    const items = await db.posInventoryItem.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        category: true,
        sku: true,
        barcode: true,
        price_cents: true,
        cost_cents: true,
        quantity: true,
        attributes: true,
        active: true,
      },
    });

    return NextResponse.json({
      items,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
