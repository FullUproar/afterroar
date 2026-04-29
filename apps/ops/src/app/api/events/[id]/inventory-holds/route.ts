/**
 * GET  /api/events/[id]/inventory-holds — list prize-pool holds for an event
 * POST /api/events/[id]/inventory-holds — reserve inventory as prize support
 *
 * Prize-pool holds are PosInventoryHold rows with `event_id` set. They take
 * inventory off the sellable shelf so the cashier can't accidentally sell the
 * tournament prize boxes during the week before the event.
 *
 * Lifecycle:
 *   active     → on hold for the event
 *   fulfilled  → allocated to a winner (separate flow)
 *   released   → manually let go (event cancelled, inventory short, etc.)
 *   expired    → never claimed; auto-released by cron
 *
 * Auth: requires `inventory.adjust`.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

interface CreateBody {
  inventory_item_id?: string;
  quantity?: number;
  reason?: string;
  /** When the hold auto-expires if still active. Default: event start + 1 day. */
  expires_at?: string;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await ctx.params;
  try {
    const { db } = await requirePermission("inventory.view");
    const holds = await db.posInventoryHold.findMany({
      where: { event_id: eventId },
      orderBy: { held_at: "desc" },
      include: {
        item: { select: { id: true, name: true, quantity: true, sku: true } },
        staff: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ holds });
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
    const { staff, storeId, db } = await requirePermission("inventory.adjust");

    let body: CreateBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.inventory_item_id) {
      return NextResponse.json({ error: "inventory_item_id is required" }, { status: 400 });
    }
    const qty = body.quantity ?? 1;
    if (!Number.isInteger(qty) || qty < 1) {
      return NextResponse.json({ error: "quantity must be a positive integer" }, { status: 400 });
    }

    // Verify event exists and belongs to this store; pull starts_at for default expiry.
    const event = await db.posEvent.findFirst({
      where: { id: eventId },
      select: { id: true, name: true, starts_at: true, ends_at: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Default expiry: event end (or start + 24h if no end), so the hold
    // auto-releases if still active after the event.
    const defaultExpires =
      body.expires_at != null
        ? new Date(body.expires_at)
        : event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 24 * 60 * 60 * 1000);

    const hold = await db.posInventoryHold.create({
      data: {
        store_id: storeId,
        item_id: body.inventory_item_id,
        staff_id: staff.id,
        event_id: eventId,
        quantity: qty,
        reason: body.reason?.trim() || `Prize pool: ${event.name}`,
        expires_at: defaultExpires,
      },
      include: {
        item: { select: { id: true, name: true, quantity: true } },
      },
    });

    return NextResponse.json({ hold }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
