/**
 * PATCH  /api/reservations/[id] — update status or notes
 * DELETE /api/reservations/[id] — release (terminal state)
 *
 * Status transitions allowed:
 *   active   → notified  (staff has called/texted/emailed; copy is back)
 *   active   → released  (customer gave up / removed by staff)
 *   notified → claimed   (became a checkout — usually set by checkout flow,
 *                          but exposed here for manual reconciliation)
 *   notified → released  (no-show / expired without claim)
 *
 * Auth: session-based, requires `inventory.view`.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

const VALID_TRANSITIONS: Record<string, string[]> = {
  active: ["notified", "released"],
  notified: ["claimed", "released", "active"], // back to 'active' if notification was premature
  claimed: [],
  released: [],
  expired: ["active"],
};

const NOTIFICATION_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours to claim once notified

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const { db } = await requireStaff();

    let body: { status?: string; notes?: string; release_reason?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const reservation = await db.posGameReservation.findFirst({ where: { id } });
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (body.status && body.status !== reservation.status) {
      const allowed = VALID_TRANSITIONS[reservation.status] ?? [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from '${reservation.status}' to '${body.status}'. Allowed: ${allowed.join(", ") || "none"}`,
          },
          { status: 400 },
        );
      }
      updates.status = body.status;
      if (body.status === "notified") {
        updates.notified_at = new Date();
        updates.notification_expires_at = new Date(Date.now() + NOTIFICATION_WINDOW_MS);
      }
      if (body.status === "released" || body.status === "expired") {
        updates.released_at = new Date();
        updates.release_reason = body.release_reason ?? body.status;
      }
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }

    const updated = await db.posGameReservation.update({
      where: { id },
      data: updates,
    });
    return NextResponse.json({ reservation: updated });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const { db } = await requireStaff();

    const reservation = await db.posGameReservation.findFirst({ where: { id } });
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (reservation.status === "released" || reservation.status === "claimed") {
      return NextResponse.json({ id, already_terminal: true });
    }

    await db.posGameReservation.update({
      where: { id },
      data: {
        status: "released",
        released_at: new Date(),
        release_reason: "manual",
      },
    });
    return NextResponse.json({ id, released: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
