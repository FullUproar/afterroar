/**
 * GET  /api/inventory/[id]/reservations  — list active queue for a lendable item
 * POST /api/inventory/[id]/reservations  — add a customer to the queue
 *
 * The reservation queue is the game-library equivalent of "wait, I want
 * Gloomhaven when it comes back." Position is implicit by created_at.
 *
 * Auth: session-based, requires `inventory.view` (read) and `customers.view`
 * (write — staff is acting on behalf of a customer).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await ctx.params;
  try {
    const { db } = await requireStaff();

    const reservations = await db.posGameReservation.findMany({
      where: {
        inventory_item_id: itemId,
        status: { in: ["active", "notified"] },
      },
      orderBy: { created_at: "asc" },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      reservations: reservations.map((r, idx) => ({
        id: r.id,
        position: idx + 1,
        status: r.status,
        notes: r.notes,
        notified_at: r.notified_at,
        notification_expires_at: r.notification_expires_at,
        customer: r.customer,
        staff: r.staff,
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await ctx.params;
  try {
    const { staff, storeId, db } = await requireStaff();

    let body: { customer_id?: string; notes?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body.customer_id) {
      return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
    }

    // Verify the item is lendable (and belongs to this store).
    const item = await db.posInventoryItem.findFirst({
      where: { id: itemId },
      select: { id: true, lendable: true, name: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (!item.lendable) {
      return NextResponse.json(
        { error: "Item is not flagged as lendable; cannot reserve." },
        { status: 400 },
      );
    }

    // Reject duplicate active reservations for the same customer + item.
    const existing = await db.posGameReservation.findFirst({
      where: {
        inventory_item_id: itemId,
        customer_id: body.customer_id,
        status: { in: ["active", "notified"] },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Customer already has an active reservation for this item" },
        { status: 409 },
      );
    }

    const reservation = await db.posGameReservation.create({
      data: {
        store_id: storeId,
        inventory_item_id: itemId,
        customer_id: body.customer_id,
        staff_id: staff.id,
        notes: body.notes?.trim() || null,
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
