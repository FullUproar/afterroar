import { NextRequest, NextResponse } from "next/server";
import { requireStaff, requirePermission, handleAuthError } from "@/lib/require-staff";
import {
  searchCards,
  getCard,
  autocomplete,
  scryfallToCatalogCard,
  scryfallToInventoryItem,
} from "@/lib/scryfall";

/**
 * GET /api/catalog/scryfall?q=lightning+bolt
 * GET /api/catalog/scryfall?autocomplete=light
 *
 * Search Scryfall for MTG cards. Server-side to avoid CORS.
 */
export async function GET(request: NextRequest) {
  try {
    await requireStaff();

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim();
    const ac = searchParams.get("autocomplete")?.trim();

    // Autocomplete mode — fast name suggestions
    if (ac) {
      if (ac.length < 2) {
        return NextResponse.json([]);
      }
      const suggestions = await autocomplete(ac);
      return NextResponse.json(suggestions);
    }

    // Full search mode
    if (!q || q.length < 2) {
      return NextResponse.json({ cards: [], total: 0 });
    }

    const { cards, total } = await searchCards(q);
    const mapped = cards.slice(0, 30).map(scryfallToCatalogCard);

    return NextResponse.json({ cards: mapped, total });
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * POST /api/catalog/scryfall
 *
 * Add a Scryfall card to inventory.
 * Body: { scryfall_id, foil, quantity, cost_cents, condition, price_cents? }
 */
export async function POST(request: NextRequest) {
  try {
    const { db, storeId } = await requirePermission("inventory.adjust");

    const body = await request.json();
    const {
      scryfall_id,
      foil = false,
      quantity = 1,
      cost_cents = 0,
      condition = "NM",
      price_cents,
    } = body;

    if (!scryfall_id || typeof scryfall_id !== "string") {
      return NextResponse.json(
        { error: "scryfall_id is required" },
        { status: 400 }
      );
    }

    // Fetch full card data from Scryfall
    const card = await getCard(scryfall_id);
    const mapped = scryfallToInventoryItem(card, foil);

    // Override condition
    (mapped.attributes as Record<string, unknown>).condition = condition;

    // Override price if staff provided one
    if (typeof price_cents === "number" && price_cents > 0) {
      mapped.price_cents = price_cents;
    }

    // Check if this card already exists in inventory
    const externalId = mapped.external_id;
    const existing = await db.posInventoryItem.findFirst({
      where: { external_id: externalId },
    });

    if (existing) {
      // Update quantity and optionally price/cost
      const updated = await db.posInventoryItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
          ...(cost_cents > 0 ? { cost_cents } : {}),
          ...(typeof price_cents === "number" && price_cents > 0
            ? { price_cents }
            : {}),
          attributes: {
            ...(existing.attributes as Record<string, unknown>),
            condition,
          },
          updated_at: new Date(),
        },
      });

      return NextResponse.json(
        {
          item: updated,
          action: "updated",
          message: `${mapped.name} updated — now ${updated.quantity} in stock`,
        },
        { status: 200 }
      );
    }

    // Create new inventory item
    const item = await db.posInventoryItem.create({
      data: {
        store_id: storeId,
        name: mapped.name,
        category: mapped.category,
        price_cents: mapped.price_cents,
        cost_cents,
        quantity,
        image_url: mapped.image_url,
        external_id: externalId,
        attributes: mapped.attributes,
      },
    });

    return NextResponse.json(
      {
        item,
        action: "created",
        message: `${mapped.name} added — ${quantity} in stock`,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
