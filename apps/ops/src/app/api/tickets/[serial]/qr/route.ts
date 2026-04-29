/**
 * GET /api/tickets/[serial]/qr — return the ticket's QR as an SVG.
 *
 * Renders a QR encoding the canonical serial (with dashes). Cached for 24h
 * since serials are immutable. Used by the ticket-display modal in the
 * dashboard, and by the customer-facing /tickets/[serial] page.
 *
 * Auth: session-based, requires `events.checkin`. (The customer-facing page
 * could later be made public via a signed token; for the dashboard surface,
 * session auth is fine.)
 */

import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireStaff, handleAuthError } from "@/lib/require-staff";
import { normalizeTicketSerial } from "@/lib/ticket-serial";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ serial: string }> },
) {
  const { serial: rawSerial } = await ctx.params;
  const serial = normalizeTicketSerial(decodeURIComponent(rawSerial));

  try {
    const { db, storeId } = await requireStaff();

    // Verify the ticket exists in this store. Don't render QRs for unknown
    // serials — leak prevention.
    const ticket = await db.posEventTicket.findUnique({
      where: { serial },
      select: { id: true, store_id: true },
    });
    if (!ticket || ticket.store_id !== storeId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const svg = await QRCode.toString(serial, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#0a0a0a", light: "#ffffff" },
      width: 320,
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
