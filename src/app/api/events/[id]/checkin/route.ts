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

  const data = await prisma.eventCheckin.findMany({
    where: { event_id: id },
    include: { customer: { select: { name: true } } },
    orderBy: { checked_in_at: "asc" },
  });

  const mapped = data.map((ci) => ({
    ...ci,
    customer_name: ci.customer?.name ?? null,
    customer: undefined,
  }));

  return NextResponse.json(mapped);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: event_id } = await params;
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
  const { customer_id } = body;

  if (!customer_id) {
    return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
  }

  // Check for duplicate checkin
  const existing = await prisma.eventCheckin.findUnique({
    where: { event_id_customer_id: { event_id, customer_id } },
  });

  if (existing) {
    return NextResponse.json({ error: "Customer already checked in" }, { status: 409 });
  }

  // Get event to check entry fee
  const event = await prisma.event.findUnique({
    where: { id: event_id },
    select: { entry_fee_cents: true, store_id: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const fee_paid = event.entry_fee_cents > 0;

  // Create checkin record
  const checkin = await prisma.eventCheckin.create({
    data: {
      event_id,
      customer_id,
      checked_in_at: new Date(),
      fee_paid,
    },
  });

  // If there's an entry fee, create a ledger entry
  if (event.entry_fee_cents > 0) {
    await prisma.ledgerEntry.create({
      data: {
        store_id: event.store_id,
        customer_id,
        type: "event_fee",
        amount_cents: event.entry_fee_cents,
        event_id,
        description: "Event entry fee",
      },
    });
  }

  return NextResponse.json(checkin, { status: 201 });
}
