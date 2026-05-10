import { NextRequest, NextResponse } from "next/server";
import { requireFeature, requirePermissionAndFeature, handleAuthError } from "@/lib/require-staff";
import { prisma } from "@/lib/prisma";
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
    await requireFeature("tcg_engine");

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

    // Bubble exact-name matches to the top so a query like "Lightning Bolt"
    // doesn't lead with split/dual-faced cards that happen to contain the
    // phrase in one half ("Emeritus of Conflict // Lightning Bolt"). Cashiers
    // searching a common card name expect the canonical printing first.
    // (UX-023)
    const qLower = q.toLowerCase();
    const ranked = [...cards].sort((a, b) => {
      const aName = (a.name || "").toLowerCase();
      const bName = (b.name || "").toLowerCase();
      const aExact = aName === qLower ? 0 : 1;
      const bExact = bName === qLower ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aStarts = aName.startsWith(qLower) ? 0 : 1;
      const bStarts = bName.startsWith(qLower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      // Prefer non-split cards (no " // ") at same precedence level
      const aSplit = aName.includes(" // ") ? 1 : 0;
      const bSplit = bName.includes(" // ") ? 1 : 0;
      return aSplit - bSplit;
    });
    const mapped = ranked.slice(0, 30).map(scryfallToCatalogCard);

    return NextResponse.json({ cards: mapped, total });
  } catch (error) {
    // Verbose server-side log so we can pinpoint the failure mode in prod
    console.error("[catalog/scryfall] search failed", {
      q: request.nextUrl.searchParams.get("q"),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
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
    const { db, storeId } = await requirePermissionAndFeature("inventory.adjust", "tcg_engine");

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

    // Find or create catalog product for this Scryfall card
    const scryfallExternalKey = `scryfall:${card.id}`;
    let catalogProduct = await prisma.posCatalogProduct.findFirst({
      where: {
        external_ids: { path: ["scryfall_id"], equals: card.id },
      },
    });

    if (!catalogProduct) {
      // Try by name + set as fallback
      catalogProduct = await prisma.posCatalogProduct.findFirst({
        where: {
          name: foil ? `${card.name} (Foil)` : card.name,
          set_code: card.set.toUpperCase(),
          game: "MTG",
        },
      });
    }

    if (!catalogProduct) {
      catalogProduct = await prisma.posCatalogProduct.create({
        data: {
          name: foil ? `${card.name} (Foil)` : card.name,
          category: "tcg_single",
          subcategory: "mtg-singles",
          game: "MTG",
          product_type: "single",
          set_name: card.set_name,
          set_code: card.set.toUpperCase(),
          attributes: {
            rarity: card.rarity,
            foil,
            collector_number: card.collector_number,
            type_line: card.type_line || "",
            mana_cost: card.mana_cost || "",
          },
          external_ids: {
            scryfall_id: card.id,
            primary: scryfallExternalKey,
          },
          image_url: mapped.image_url,
          contributed_by_store_id: storeId,
        },
      });
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
          catalog_product_id: catalogProduct.id,
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

    // Create new inventory item linked to catalog
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
        catalog_product_id: catalogProduct.id,
        shared_to_catalog: false,
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
