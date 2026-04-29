/**
 * PATCH  /api/pull-lists/[id] — update qty/notes/wants_variants/status
 * DELETE /api/pull-lists/[id] — soft cancel (status='cancelled')
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

const PATCHABLE = [
  "series_title",
  "publisher",
  "wants_variants",
  "qty_per_issue",
  "notes",
  "status",
] as const;

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
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
    if (updates.status === "paused") updates.paused_at = new Date();
    if (updates.status === "cancelled") updates.cancelled_at = new Date();

    const list = await db.posPullList.update({ where: { id }, data: updates });
    return NextResponse.json({ pullList: list });
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
    const { db } = await requirePermission("customers.edit");
    await db.posPullList.update({
      where: { id },
      data: { status: "cancelled", cancelled_at: new Date() },
    });
    return NextResponse.json({ id, cancelled: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
