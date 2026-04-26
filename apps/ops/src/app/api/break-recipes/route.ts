import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireStaff, handleAuthError } from "@/lib/require-staff";

/**
 * Break recipes — saved (parent → child × N) presets the operator can pick
 * from when cracking sealed cases or boxes. Recipes are not the only way to
 * break inventory; the /api/inventory/break endpoint accepts ad-hoc children
 * directly. Recipes just save the operator from re-typing the breakdown.
 */

/** GET /api/break-recipes — list all recipes for the store, with item names. */
export async function GET(request: NextRequest) {
  try {
    const { db, storeId } = await requireStaff();
    const parentId = request.nextUrl.searchParams.get("parent_id");

    const recipes = await db.posBreakRecipe.findMany({
      where: {
        store_id: storeId,
        ...(parentId ? { parent_inventory_id: parentId } : {}),
        active: true,
      },
      include: {
        parent: { select: { id: true, name: true, quantity: true } },
        child: { select: { id: true, name: true, quantity: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(recipes);
  } catch (error) {
    return handleAuthError(error);
  }
}

/** POST /api/break-recipes — create a recipe */
export async function POST(request: NextRequest) {
  try {
    const { db, storeId } = await requirePermission("inventory.adjust");
    const body = (await request.json()) as {
      parent_inventory_id: string;
      child_inventory_id: string;
      child_qty_per_parent: number;
      name?: string;
    };

    if (!body.parent_inventory_id || !body.child_inventory_id || !body.child_qty_per_parent) {
      return NextResponse.json(
        { error: "parent_inventory_id, child_inventory_id, child_qty_per_parent required" },
        { status: 400 },
      );
    }
    if (body.child_qty_per_parent <= 0) {
      return NextResponse.json({ error: "child_qty_per_parent must be > 0" }, { status: 400 });
    }
    if (body.parent_inventory_id === body.child_inventory_id) {
      return NextResponse.json({ error: "parent and child must differ" }, { status: 400 });
    }

    // Confirm both items belong to this store
    const items = await db.posInventoryItem.findMany({
      where: { id: { in: [body.parent_inventory_id, body.child_inventory_id] }, store_id: storeId },
      select: { id: true },
    });
    if (items.length !== 2) {
      return NextResponse.json({ error: "Items not found" }, { status: 404 });
    }

    const recipe = await db.posBreakRecipe.upsert({
      where: {
        parent_inventory_id_child_inventory_id: {
          parent_inventory_id: body.parent_inventory_id,
          child_inventory_id: body.child_inventory_id,
        },
      },
      create: {
        store_id: storeId,
        parent_inventory_id: body.parent_inventory_id,
        child_inventory_id: body.child_inventory_id,
        child_qty_per_parent: body.child_qty_per_parent,
        name: body.name ?? null,
        active: true,
      },
      update: {
        child_qty_per_parent: body.child_qty_per_parent,
        name: body.name ?? null,
        active: true,
      },
    });

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

/** DELETE /api/break-recipes?id=... */
export async function DELETE(request: NextRequest) {
  try {
    const { db, storeId } = await requirePermission("inventory.adjust");
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const result = await db.posBreakRecipe.deleteMany({
      where: { id, store_id: storeId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
