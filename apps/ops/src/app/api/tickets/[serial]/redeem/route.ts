/**
 * POST /api/tickets/[serial]/redeem — door check-in by ticket serial.
 *
 * The serial may be passed with or without dashes; we normalize either form.
 * On success, the ticket flips status=redeemed AND we create a paired
 * PosEventCheckin row so the existing event-attendance reporting picks it up.
 *
 * Idempotent: redeeming an already-redeemed ticket returns 200 with the
 * existing record (door staff scans twice → graceful).
 *
 * Auth: session-based, requires `events.checkin`.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";
import { normalizeTicketSerial } from "@/lib/ticket-serial";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ serial: string }> },
) {
  const { serial: rawSerial } = await ctx.params;
  const serial = normalizeTicketSerial(decodeURIComponent(rawSerial));

  try {
    const { db, staff, storeId } = await requireStaff();

    const ticket = await db.posEventTicket.findUnique({
      where: { serial },
      include: {
        event: { select: { id: true, name: true, starts_at: true } },
        customer: { select: { id: true, name: true } },
      },
    });
    if (!ticket || ticket.store_id !== storeId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "refunded" || ticket.status === "cancelled") {
      return NextResponse.json(
        { error: `Ticket is ${ticket.status}, cannot be redeemed` },
        { status: 410 },
      );
    }

    // Idempotent: already redeemed → 200 with existing data.
    if (ticket.status === "redeemed") {
      return NextResponse.json({
        ticket,
        already_redeemed: true,
      });
    }

    // Atomic: create check-in row, flip ticket status.
    const result = await db.$transaction(async (tx) => {
      let checkinId = ticket.checkin_id;

      // Only create a checkin row if the customer-id is set; the existing
      // PosEventCheckin schema requires a customer. Guest tickets (no
      // customer) just flip status without creating a checkin row.
      if (ticket.customer_id && !ticket.checkin_id) {
        const existingCheckin = await tx.posEventCheckin.findUnique({
          where: {
            event_id_customer_id: {
              event_id: ticket.event_id,
              customer_id: ticket.customer_id,
            },
          },
        });
        if (existingCheckin) {
          checkinId = existingCheckin.id;
        } else {
          const c = await tx.posEventCheckin.create({
            data: {
              event_id: ticket.event_id,
              customer_id: ticket.customer_id,
              fee_paid: ticket.amount_paid_cents > 0,
              ledger_entry_id: ticket.ledger_entry_id,
              ticket_tier_id: ticket.ticket_tier_id,
              amount_paid_cents: ticket.amount_paid_cents,
            },
          });
          checkinId = c.id;
        }
      }

      const updated = await tx.posEventTicket.update({
        where: { id: ticket.id },
        data: {
          status: "redeemed",
          redeemed_at: new Date(),
          redeemed_by_staff_id: staff.id,
          checkin_id: checkinId,
        },
        include: {
          event: { select: { id: true, name: true } },
          tier: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
        },
      });
      return updated;
    });

    return NextResponse.json({ ticket: result });
  } catch (error) {
    return handleAuthError(error);
  }
}
