import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

export async function GET(request: NextRequest) {
  try {
    const { db } = await requireStaff();

    const q = request.nextUrl.searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json([]);
    }

    const data = await db.posInventoryItem.findMany({
      where: {
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
  } catch (error) {
    return handleAuthError(error);
  }
}
