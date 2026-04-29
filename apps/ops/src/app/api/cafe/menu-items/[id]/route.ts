/**
 * PATCH  /api/cafe/menu-items/[id] — update a menu item
 * DELETE /api/cafe/menu-items/[id] — soft-disable (sets available=false)
 *
 * Includes the "86" toggle: sold_out_at = now puts an item on the daily 86 list
 * (separate from `available`, which is the permanent on/off). Clear by setting
 * sold_out_at = null.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

const PATCHABLE = [
  "name",
  "category",
  "price_cents",
  "description",
  "available",
  "sold_out_at",
  "sort_order",
  "age_restricted",
  "prep_seconds",
  "dietary_info",
] as const;

type Patchable = (typeof PATCHABLE)[number];

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const { db } = await requireStaff();
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    for (const key of PATCHABLE) {
      if (key in body) {
        // Coerce sold_out_at: accept either ISO string, null, or boolean true (now).
        if (key === "sold_out_at") {
          const v = body.sold_out_at;
          if (v === true) updates.sold_out_at = new Date();
          else if (v === false || v === null) updates.sold_out_at = null;
          else if (typeof v === "string") updates.sold_out_at = new Date(v);
        } else {
          updates[key as Patchable] = body[key];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }

    const item = await db.posMenuItem.update({ where: { id }, data: updates });
    return NextResponse.json({ menuItem: item });
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
    // Soft-disable rather than hard-delete: closed tabs may still reference
    // the menu item by id in their items, and we want history preserved.
    const item = await db.posMenuItem.update({
      where: { id },
      data: { available: false },
    });
    return NextResponse.json({ id: item.id, disabled: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
