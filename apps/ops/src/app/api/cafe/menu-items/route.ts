/**
 * GET  /api/cafe/menu-items     — list all menu items for the active store
 * POST /api/cafe/menu-items     — create a new menu item
 *
 * Used by the (forthcoming) menu-management UI and the public-facing
 * tableside order page. Recipes are managed at /api/cafe/menu-items/[id]/recipes.
 *
 * Auth: GET requires `inventory.view`, POST requires `inventory.create`.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

export async function GET() {
  try {
    const { db } = await requireStaff();
    const items = await db.posMenuItem.findMany({
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      include: {
        recipes: {
          include: { inventory_item: { select: { id: true, name: true, quantity: true } } },
        },
      },
    });
    return NextResponse.json({ menuItems: items });
  } catch (error) {
    return handleAuthError(error);
  }
}

interface CreateBody {
  name?: string;
  category?: string;
  price_cents?: number;
  description?: string;
  available?: boolean;
  age_restricted?: boolean;
  prep_seconds?: number | null;
  sort_order?: number;
  dietary_info?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const { db, storeId } = await requireStaff();
    let body: CreateBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (typeof body.price_cents !== "number" || body.price_cents < 0) {
      return NextResponse.json({ error: "price_cents must be a non-negative number" }, { status: 400 });
    }

    const item = await db.posMenuItem.create({
      data: {
        store_id: storeId,
        name: body.name.trim(),
        category: body.category ?? "other",
        price_cents: body.price_cents,
        description: body.description?.trim() || null,
        available: body.available ?? true,
        age_restricted: body.age_restricted ?? false,
        prep_seconds: body.prep_seconds ?? null,
        sort_order: body.sort_order ?? 0,
        dietary_info: body.dietary_info ?? {},
      },
    });
    return NextResponse.json({ menuItem: item }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
