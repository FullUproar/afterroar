import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/*  GET /api/trade-ins — list trade-ins for store                     */
/* ------------------------------------------------------------------ */
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

  const data = await prisma.posTradeIn.findMany({
    where: { store_id: staff.store_id },
    orderBy: { created_at: "desc" },
    include: {
      customer: { select: { name: true } },
      items: { select: { id: true } },
    },
  });

  const rows = data.map((ti) => ({
    id: ti.id,
    created_at: ti.created_at,
    customer_name: ti.customer?.name ?? "Unknown",
    item_count: ti.items.length,
    total_offer_cents: ti.total_offer_cents,
    total_payout_cents: ti.total_payout_cents,
    payout_type: ti.payout_type,
    status: ti.status,
  }));

  return NextResponse.json(rows);
}

/* ------------------------------------------------------------------ */
/*  POST /api/trade-ins — create a new trade-in                       */
/* ------------------------------------------------------------------ */

interface TradeInItemInput {
  name: string;
  category: string;
  attributes: Record<string, unknown>;
  quantity: number;
  market_price_cents: number;
  offer_price_cents: number;
}

interface CreateTradeInBody {
  customer_id: string;
  items: TradeInItemInput[];
  payout_type: "cash" | "credit";
  credit_bonus_percent: number;
  notes: string | null;
}

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

  let body: CreateTradeInBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { customer_id, items, payout_type, credit_bonus_percent, notes } = body;

  if (!customer_id || !items?.length) {
    return NextResponse.json(
      { error: "customer_id and at least one item are required" },
      { status: 400 }
    );
  }

  // Calculate totals
  const total_offer_cents = items.reduce(
    (sum, i) => sum + i.offer_price_cents * i.quantity,
    0
  );

  const total_payout_cents =
    payout_type === "credit"
      ? Math.round(total_offer_cents * (1 + (credit_bonus_percent || 0) / 100))
      : total_offer_cents;

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Create trade-in record
    const tradeIn = await tx.posTradeIn.create({
      data: {
        store_id: staff.store_id,
        customer_id,
        staff_id: staff.id,
        total_offer_cents,
        total_payout_cents,
        payout_type,
        credit_bonus_percent: credit_bonus_percent || 0,
        status: "completed",
        notes,
        completed_at: new Date(),
      },
    });

    // Create trade-in items
    await tx.posTradeInItem.createMany({
      data: items.map((i) => ({
        trade_in_id: tradeIn.id,
        name: i.name,
        category: i.category,
        attributes: i.attributes as Record<string, string>,
        quantity: i.quantity,
        market_price_cents: i.market_price_cents,
        offer_price_cents: i.offer_price_cents,
      })),
    });

    // Create ledger entry (negative amount = cash going out)
    await tx.posLedgerEntry.create({
      data: {
        store_id: staff.store_id,
        type: "trade_in",
        amount_cents: -total_payout_cents,
        description: `Trade-in: ${items.length} item(s) — ${payout_type}`,
        customer_id,
        staff_id: staff.id,
      },
    });

    // If store credit, update customer credit balance
    if (payout_type === "credit") {
      await tx.posCustomer.update({
        where: { id: customer_id },
        data: {
          credit_balance_cents: { increment: total_payout_cents },
        },
      });
    }

    return tradeIn;
  });

  return NextResponse.json(
    { id: result.id, total_offer_cents, total_payout_cents },
    { status: 201 }
  );
}
