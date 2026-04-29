/**
 * POST /api/tickets/[id]/refund — refund a sold (or even redeemed) ticket.
 *
 * Refunding decrements the tier's `sold` counter so the seat opens back up
 * for resale, and writes a refund ledger entry. If the ticket has been
 * redeemed (rare — usually you only refund unredeemed), we still process
 * but flag in the ledger metadata.
 *
 * Auth: session-based, requires `checkout.refund`.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

interface RefundBody {
  reason?: string;
  /** Override refund amount (default: full amount_paid_cents). */
  amount_cents?: number;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: ticketId } = await ctx.params;
  try {
    const { staff, storeId, db } = await requirePermission("checkout.refund");

    let body: RefundBody = {};
    try {
      body = await req.json();
    } catch {
      // empty body OK — full refund with no reason
    }

    const ticket = await db.posEventTicket.findFirst({
      where: { id: ticketId, store_id: storeId },
      include: { tier: true },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (ticket.status === "refunded" || ticket.status === "cancelled") {
      return NextResponse.json(
        { error: `Ticket already ${ticket.status}`, ticket },
        { status: 409 },
      );
    }

    const refundAmount = body.amount_cents ?? ticket.amount_paid_cents;
    if (refundAmount < 0 || refundAmount > ticket.amount_paid_cents) {
      return NextResponse.json(
        { error: `amount_cents must be 0..${ticket.amount_paid_cents}` },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Decrement the tier's sold counter so the seat is reusable.
      await tx.posEventTicketTier.update({
        where: { id: ticket.ticket_tier_id },
        data: { sold: { decrement: 1 } },
      });

      const ledger = await tx.posLedgerEntry.create({
        data: {
          store_id: storeId,
          type: "refund",
          amount_cents: refundAmount,
          staff_id: staff.id,
          customer_id: ticket.customer_id,
          event_id: ticket.event_id,
          description: `Ticket refund · ${ticket.serial}${body.reason ? ` · ${body.reason}` : ""}`,
          metadata: {
            source: "ticket_refund",
            event_id: ticket.event_id,
            ticket_id: ticket.id,
            ticket_serial: ticket.serial,
            tier_name: ticket.tier.name,
            original_ledger_entry_id: ticket.ledger_entry_id ?? null,
            was_redeemed: ticket.status === "redeemed",
            reason: body.reason ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      const updated = await tx.posEventTicket.update({
        where: { id: ticketId },
        data: {
          status: "refunded",
          refunded_at: new Date(),
          refund_amount_cents: refundAmount,
          refund_reason: body.reason ?? null,
        },
      });

      return { ticket: updated, refund_ledger_entry_id: ledger.id };
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAuthError(error);
  }
}
