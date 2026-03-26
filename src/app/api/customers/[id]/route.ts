import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const customer = await prisma.posCustomer.findFirst({
    where: { id, store_id: staff.store_id },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const [ledger_entries, trade_ins] = await Promise.all([
    prisma.posLedgerEntry.findMany({
      where: { customer_id: id },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    prisma.posTradeIn.findMany({
      where: { customer_id: id },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    ...customer,
    ledger_entries,
    trade_ins,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.email !== undefined) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.notes !== undefined) updates.notes = body.notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const data = await prisma.posCustomer.update({
    where: { id, store_id: staff.store_id },
    data: updates,
  });

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const body = await request.json();

  if (body.action !== "adjust_credit") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { amount_cents, description } = body;
  if (!amount_cents || typeof amount_cents !== "number") {
    return NextResponse.json(
      { error: "amount_cents is required and must be a number" },
      { status: 400 }
    );
  }

  // Use a transaction for atomicity
  const updated = await prisma.$transaction(async (tx) => {
    await tx.posLedgerEntry.create({
      data: {
        store_id: staff.store_id,
        customer_id: id,
        type: amount_cents > 0 ? "credit_issue" : "credit_deduct",
        amount_cents,
        description: description || null,
      },
    });

    return tx.posCustomer.update({
      where: { id },
      data: {
        credit_balance_cents: { increment: amount_cents },
      },
    });
  });

  return NextResponse.json(updated);
}
