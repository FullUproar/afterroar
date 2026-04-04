import { NextRequest, NextResponse } from "next/server";
import { requirePermissionAndFeature, handleAuthError } from "@/lib/require-staff";
import {
  searchDecklists,
  parseDecklistText,
  matchDeckToInventory,
  suggestMetaDecks,
} from "@/lib/deck-builder";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermissionAndFeature("checkout", "tcg_engine");

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "search": {
        const { query, format } = body;
        if (!query || typeof query !== "string") {
          return NextResponse.json({ error: "query is required" }, { status: 400 });
        }
        const cards = await searchDecklists(query, format);
        return NextResponse.json({ cards });
      }

      case "parse": {
        const { decklist } = body;
        if (!decklist || typeof decklist !== "string") {
          return NextResponse.json({ error: "decklist is required" }, { status: 400 });
        }
        const cards = parseDecklistText(decklist);
        return NextResponse.json({ cards });
      }

      case "match": {
        const { cards } = body;
        if (!Array.isArray(cards)) {
          return NextResponse.json({ error: "cards array is required" }, { status: 400 });
        }
        const results = await matchDeckToInventory(cards, ctx.storeId);
        return NextResponse.json({ results });
      }

      case "suggest": {
        const { format } = body;
        if (!format || typeof format !== "string") {
          return NextResponse.json({ error: "format is required" }, { status: 400 });
        }
        const decks = suggestMetaDecks(format);
        return NextResponse.json({ decks });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
