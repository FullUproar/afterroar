import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  const events = await prisma.posEvent.findMany({
    where: { store_id: staff.store_id },
    orderBy: { starts_at: "desc" },
    include: {
      ledger_entries: {
        select: { amount_cents: true, type: true },
      },
      _count: { select: { checkins: true } },
    },
  });

  const results = events.map((event) => {
    const entry_fees = event.ledger_entries
      .filter((e) => e.type === "event_entry" || e.type === "event_fee")
      .reduce((sum, e) => sum + e.amount_cents, 0);

    const tagged_sales = event.ledger_entries
      .filter((e) => e.type === "sale")
      .reduce((sum, e) => sum + e.amount_cents, 0);

    return {
      id: event.id,
      name: event.name,
      starts_at: event.starts_at,
      event_type: event.event_type,
      entry_fees,
      tagged_sales,
      total: entry_fees + tagged_sales,
      checkin_count: event._count.checkins,
    };
  });

  return NextResponse.json(results);
}
