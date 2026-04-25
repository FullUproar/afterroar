import { NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

/* ------------------------------------------------------------------ */
/*  GET /api/staff/roster                                              */
/*  Lightweight staff list for the QuickSwitch UI on the register.     */
/*  Any authenticated staff member can call (no staff.manage perm),   */
/*  but the response only includes name + role + has_pin — never email,*/
/*  PIN hash, or other sensitive fields.                               */
/* ------------------------------------------------------------------ */
export async function GET() {
  try {
    const { db, storeId } = await requireStaff();

    const staff = await db.posStaff.findMany({
      where: { store_id: storeId, active: true },
      select: {
        id: true,
        name: true,
        role: true,
        pin_hash: true,
        user: { select: { avatarUrl: true } },
      },
      orderBy: { created_at: "asc" },
    });

    return NextResponse.json(
      staff.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        has_pin: !!s.pin_hash,
        avatar_url: s.user?.avatarUrl ?? null,
      })),
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
