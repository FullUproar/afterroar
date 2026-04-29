/**
 * PATCH  /api/pull-lists/[id]/items/[itemId] — update issue allocation
 *                                                (status, notes, variant, etc.)
 * DELETE /api/pull-lists/[id]/items/[itemId] — remove an allocation outright
 *
 * Status transitions also stamp the corresponding *_at columns and, when
 * an issue is fulfilled, advance the parent list's last_pickup_at so the
 * landing page can sort by recency.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

const PATCHABLE = ["status", "variant_label", "notes", "inventory_item_id", "expires_at"] as const;

const VALID_STATUSES = ["pending", "held", "fulfilled", "skipped", "expired"] as const;
type ItemStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await ctx.params;
  try {
    const { db } = await requirePermission("customers.edit");
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    for (const k of PATCHABLE) {
      if (k in body) updates[k] = body[k];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }

    if ("status" in updates) {
      const s = updates.status as string;
      if (!VALID_STATUSES.includes(s as ItemStatus)) {
        return NextResponse.json({ error: `Invalid status: ${s}` }, { status: 400 });
      }
      const now = new Date();
      if (s === "held") updates.held_at = now;
      if (s === "fulfilled") updates.fulfilled_at = now;
    }

    // updateMany — enforces both id + parent so an operator can't update
    // an item from a list they didn't navigate into.
    const result = await db.posPullListItem.updateMany({
      where: { id: itemId, pull_list_id: id },
      data: updates,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // When an issue is fulfilled, bump the parent list's last_pickup_at so
    // operators can sort/see at-a-glance which subscribers came in recently.
    if (updates.status === "fulfilled") {
      await db.posPullList.update({
        where: { id },
        data: { last_pickup_at: new Date() },
      });
    }

    const item = await db.posPullListItem.findUnique({ where: { id: itemId } });
    return NextResponse.json({ item });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await ctx.params;
  try {
    const { db } = await requirePermission("customers.edit");
    const result = await db.posPullListItem.deleteMany({
      where: { id: itemId, pull_list_id: id },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ id: itemId, deleted: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
