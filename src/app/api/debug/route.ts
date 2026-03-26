import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ auth: "no_user" });
    }

    const staff = await prisma.staff.findFirst({
      where: { user_id: session.user.id, active: true },
      include: { store: true },
    });

    const inventoryCount = await prisma.inventoryItem.count({
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
