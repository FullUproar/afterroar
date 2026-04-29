/**
 * DELETE /api/cafe/recipes/[id] — remove an ingredient link from a menu item.
 *
 * Auth: requires session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const { db } = await requireStaff();
    await db.posMenuRecipe.delete({ where: { id } });
    return NextResponse.json({ id, removed: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
