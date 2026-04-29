/**
 * GET  /api/cafe/menu-items/[id]/recipes  — list recipe ingredients
 * POST /api/cafe/menu-items/[id]/recipes  — attach an ingredient
 *
 * Each recipe row links a menu item to one inventory item with a quantity.
 * To remove an ingredient, DELETE /api/cafe/recipes/[recipeId].
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const { db } = await requireStaff();
    const recipes = await db.posMenuRecipe.findMany({
      where: { menu_item_id: id },
      include: { inventory_item: { select: { id: true, name: true, quantity: true, sku: true } } },
    });
    return NextResponse.json({ recipes });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const { db } = await requireStaff();
    let body: { inventory_item_id?: string; quantity_used?: number; notes?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body.inventory_item_id) {
      return NextResponse.json({ error: "inventory_item_id is required" }, { status: 400 });
    }
    if (body.quantity_used == null || body.quantity_used <= 0) {
      return NextResponse.json({ error: "quantity_used must be > 0" }, { status: 400 });
    }

    const recipe = await db.posMenuRecipe.create({
      data: {
        menu_item_id: id,
        inventory_item_id: body.inventory_item_id,
        quantity_used: body.quantity_used,
        notes: body.notes?.trim() || null,
      },
      include: { inventory_item: { select: { id: true, name: true, quantity: true } } },
    });
    return NextResponse.json({ recipe }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
