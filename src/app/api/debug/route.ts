import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => c.name);

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ auth: "no_user", cookies: allCookies });
    }

    const staff = await prisma.posStaff.findFirst({
      where: { user_id: session.user.id, active: true },
      include: { store: true },
    });

    const inventoryCount = await prisma.posInventoryItem.count({
      where: staff ? { store_id: staff.store_id } : undefined,
    });

    return NextResponse.json({
      auth: "ok",
      user: session.user.email,
      userId: session.user.id,
      staff: staff
        ? { id: staff.id, role: staff.role, store: staff.store?.name }
        : null,
      inventoryCount,
    });
  } catch (e: unknown) {
    return NextResponse.json({
      error: "exception",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
