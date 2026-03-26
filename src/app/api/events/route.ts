import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  const events = await prisma.event.findMany({
    where: { store_id: staff.store_id },
    orderBy: { starts_at: "desc" },
    include: {
      _count: { select: { checkins: true } },
    },
  });

  const mapped = events.map((e) => ({
    ...e,
    checkin_count: e._count.checkins,
    _count: undefined,
  }));

  return NextResponse.json(mapped);
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
  const { name, event_type, starts_at, ends_at, entry_fee_cents, max_players, description } = body;

  if (!name || !event_type || !starts_at) {
    return NextResponse.json(
      { error: "name, event_type, and starts_at are required" },
      { status: 400 }
    );
  }

  const data = await prisma.event.create({
    data: {
      store_id: staff.store_id,
      name,
      event_type,
      starts_at: new Date(starts_at),
      ends_at: ends_at ? new Date(ends_at) : null,
      entry_fee_cents: entry_fee_cents ?? 0,
      max_players: max_players || null,
      description: description || null,
    },
  });

  return NextResponse.json(data, { status: 201 });
}
