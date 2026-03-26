import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/*  GET /api/customers — list / search customers                      */
/* ------------------------------------------------------------------ */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.posStaff.findFirst({
    where: { user_id: session.user.id, active: true },
  });
  if (!staff) {
    return NextResponse.json({ error: "No store found" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();

  const data = await prisma.posCustomer.findMany({
    where: {
      store_id: staff.store_id,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      credit_balance_cents: true,
      created_at: true,
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return NextResponse.json(data);
}

/* ------------------------------------------------------------------ */
/*  POST /api/customers — create a new customer                       */
/* ------------------------------------------------------------------ */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.posStaff.findFirst({
    where: { user_id: session.user.id, active: true },
  });
  if (!staff) {
    return NextResponse.json({ error: "No store found" }, { status: 403 });
  }

  let body: { name: string; email?: string | null; phone?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const data = await prisma.posCustomer.create({
    data: {
      store_id: staff.store_id,
      name: body.name.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      credit_balance_cents: 0,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      credit_balance_cents: true,
      created_at: true,
    },
  });

  return NextResponse.json(data, { status: 201 });
}
