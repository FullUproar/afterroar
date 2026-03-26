import { NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

/* ------------------------------------------------------------------ */
/*  GET /api/customers/bulk — full customer snapshot for offline cache  */
/* ------------------------------------------------------------------ */
export async function GET() {
  try {
    const { db } = await requireStaff();

    const customers = await db.posCustomer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        credit_balance_cents: true,
      },
    });

    return NextResponse.json({
      customers,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
