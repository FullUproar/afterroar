import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

export async function GET() {
  try {
    const { storeId } = await requireStaff();

    const [inventoryCount, staffCount, ledgerCount, store] = await Promise.all([
      prisma.posInventoryItem.count({ where: { store_id: storeId } }),
      prisma.posStaff.count({ where: { store_id: storeId, active: true } }),
      prisma.posLedgerEntry.count({ where: { store_id: storeId, type: "sale" } }),
      prisma.posStore.findUnique({ where: { id: storeId }, select: { settings: true } }),
    ]);

    const settings = (store?.settings ?? {}) as Record<string, unknown>;
    const taxRate = (settings.tax_rate_percent as number) ?? 0;
    const stripeConnected = !!settings.stripe_connected_account_id;

    return NextResponse.json({
      store_created: true, // if they got this far, store exists
      first_product: inventoryCount > 0,
      tax_rate: taxRate > 0,
      payment_connected: stripeConnected,
      staff_added: staffCount > 1, // more than just the owner
      first_sale: ledgerCount > 0,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
