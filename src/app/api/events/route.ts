import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

export async function GET() {
  try {
    const { db } = await requireStaff();

    const events = await db.posEvent.findMany({
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
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, storeId } = await requireStaff();

    const body = await request.json();
    const { name, event_type, starts_at, ends_at, entry_fee_cents, max_players, description } = body;

    if (!name || !event_type || !starts_at) {
      return NextResponse.json(
        { error: "name, event_type, and starts_at are required" },
        { status: 400 }
      );
    }

    const data = await db.posEvent.create({
      data: {
        store_id: storeId,
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
  } catch (error) {
    return handleAuthError(error);
  }
}
