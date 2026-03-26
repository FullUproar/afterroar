import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.staff.findFirst({
    where: { user_id: session.user.id, active: true },
  });
  if (!staff) {
    return NextResponse.json({ error: "No store found" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json([]);
  }

  const data = await prisma.inventoryItem.findMany({
    where: {
      store_id: staff.store_id,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { barcode: q },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json(data);
}
