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

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 50;
  const skip = (page - 1) * limit;

  const data = await prisma.inventoryItem.findMany({
    where: { store_id: staff.store_id },
    orderBy: { name: "asc" },
    skip,
    take: limit,
  });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const { name, category, price_cents, cost_cents, quantity, barcode, attributes } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const data = await prisma.inventoryItem.create({
    data: {
      store_id: staff.store_id,
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
}

export async function PATCH(request: NextRequest) {
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

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Item id is required" }, { status: 400 });
  }

  // Only allow updating known fields
  const allowedFields = [
    "name",
    "category",
    "price_cents",
    "cost_cents",
    "quantity",
    "barcode",
    "attributes",
    "active",
  ];

  const sanitized: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in updates) {
      sanitized[key] = updates[key];
    }
  }

  const data = await prisma.inventoryItem.update({
    where: { id, store_id: staff.store_id },
    data: sanitized,
  });

  return NextResponse.json(data);
}
