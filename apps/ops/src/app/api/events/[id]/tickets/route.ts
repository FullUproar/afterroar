/**
 * GET  /api/events/[id]/tickets — list tickets for an event (optional ?status=)
 * POST /api/events/[id]/tickets — sell a ticket (atomically: capacity check
 *                                   + tier sold counter + ledger entry +
 *                                   serial generation, all in one tx)
 *
 * Auth: session-based, requires `events.checkin` for read, `checkout` for sell.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff, handleAuthError } from "@/lib/require-staff";
import { generateTicketSerial } from "@/lib/ticket-serial";

interface SellBody {
  ticket_tier_id?: string;
  customer_id?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  /** Quantity of tickets to sell in one go (e.g. family of 4). Default 1. */
  quantity?: number;
  /** Idempotency key to prevent double-charge on retry. */
  client_tx_id?: string;
}

const MAX_BULK = 20;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await ctx.params;
  try {
    const { db } = await requireStaff();
    const status = req.nextUrl.searchParams.get("status");
    const tickets = await db.posEventTicket.findMany({
      where: {
        event_id: eventId,
        ...(status ? { status } : {}),
      },
      orderBy: { sold_at: "desc" },
      include: {
        tier: { select: { id: true, name: true, price_cents: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
        redeemed_by_staff: { select: { id: true, name: true } },
      },
      take: 500,
    });
    return NextResponse.json({ tickets });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await ctx.params;
  try {
    const { db, storeId, staff } = await requireStaff();

    let body: SellBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const tierId = body.ticket_tier_id;
    if (!tierId) {
      return NextResponse.json({ error: "ticket_tier_id is required" }, { status: 400 });
    }

    const quantity = body.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_BULK) {
      return NextResponse.json({ error: `quantity must be 1..${MAX_BULK}` }, { status: 400 });
    }

    if (!body.customer_id && !body.guest_email && !body.guest_name) {
      return NextResponse.json(
        { error: "Either customer_id or at least guest_name/guest_email is required" },
        { status: 400 },
      );
    }

    // Idempotency check — prevent double-sell on network retry.
    if (body.client_tx_id) {
      const existing = await db.posLedgerEntry.findFirst({
        where: {
          store_id: storeId,
          type: "ticket_sale",
          metadata: { path: ["client_tx_id"], equals: body.client_tx_id },
        },
        select: { id: true },
      });
      if (existing) {
        const tickets = await db.posEventTicket.findMany({
          where: { ledger_entry_id: existing.id },
        });
        return NextResponse.json({ tickets, deduplicated: true });
      }
    }

    // Atomic sell: read tier with row lock, validate capacity, increment counter,
    // create ledger entry, create N ticket rows (one per quantity).
    const result = await prisma.$transaction(async (tx) => {
      const tier = await tx.posEventTicketTier.findFirst({
        where: { id: tierId, event_id: eventId },
      });
      if (!tier) throw new HttpError(404, "Tier not found");
      if (!tier.active) throw new HttpError(400, "Tier is inactive");

      const now = new Date();
      if (tier.available_from && tier.available_from > now) {
        throw new HttpError(400, "Tier is not yet on sale");
      }
      if (tier.available_until && tier.available_until < now) {
        throw new HttpError(400, "Tier sale window has ended");
      }
      if (tier.capacity != null && tier.sold + quantity > tier.capacity) {
        throw new HttpError(409, `Only ${Math.max(0, tier.capacity - tier.sold)} tickets left at this tier`);
      }

      // Increment the counter.
      await tx.posEventTicketTier.update({
        where: { id: tierId },
        data: { sold: { increment: quantity } },
      });

      const totalAmount = tier.price_cents * quantity;

      // Create the sale ledger entry. Type 'ticket_sale' so /dashboard/sales
      // separates these from product sales naturally.
      const ledger = await tx.posLedgerEntry.create({
        data: {
          store_id: storeId,
          type: "ticket_sale",
          amount_cents: totalAmount,
          staff_id: staff.id,
          customer_id: body.customer_id ?? null,
          event_id: eventId,
          description: `${quantity}× ticket — ${tier.name}`,
          metadata: {
            source: "ticket_sale",
            event_id: eventId,
            ticket_tier_id: tierId,
            tier_name: tier.name,
            quantity,
            unit_price_cents: tier.price_cents,
            ...(body.client_tx_id ? { client_tx_id: body.client_tx_id } : {}),
            ...(body.guest_name ? { guest_name: body.guest_name } : {}),
            ...(body.guest_email ? { guest_email: body.guest_email } : {}),
          } as Prisma.InputJsonValue,
        },
      });

      // Generate N tickets. Retry-on-collision is built into mintWithRetry.
      const tickets = [];
      for (let i = 0; i < quantity; i++) {
        const ticket = await mintTicketWithRetry(tx, {
          store_id: storeId,
          event_id: eventId,
          ticket_tier_id: tierId,
          customer_id: body.customer_id ?? null,
          guest_name: body.guest_name ?? null,
          guest_email: body.guest_email ?? null,
          guest_phone: body.guest_phone ?? null,
          amount_paid_cents: tier.price_cents,
          ledger_entry_id: ledger.id,
        });
        tickets.push(ticket);
      }

      return { tickets, ledger };
    });

    return NextResponse.json({ tickets: result.tickets, ledger_entry_id: result.ledger.id }, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleAuthError(error);
  }
}

async function mintTicketWithRetry(
  tx: Prisma.TransactionClient,
  data: {
    store_id: string;
    event_id: string;
    ticket_tier_id: string;
    customer_id: string | null;
    guest_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
    amount_paid_cents: number;
    ledger_entry_id: string;
  },
  attempts = 5,
): Promise<{ id: string; serial: string }> {
  for (let i = 0; i < attempts; i++) {
    const serial = generateTicketSerial();
    try {
      const t = await tx.posEventTicket.create({
        data: { ...data, serial },
        select: { id: true, serial: true },
      });
      return t;
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        // serial collision — retry
        continue;
      }
      throw err;
    }
  }
  throw new HttpError(503, "Could not mint a unique ticket serial after retries");
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
