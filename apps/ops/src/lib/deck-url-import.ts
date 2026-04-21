/* ------------------------------------------------------------------ */
/*  Deck URL Import — fetch decklists from popular TCG sites           */
/*  Supports: Moxfield, Archidekt.                                     */
/*  Returns parsed cards in our standard ParsedCard shape.             */
/* ------------------------------------------------------------------ */

import type { ParsedCard } from "./deck-builder";

export type DeckSource = "moxfield" | "archidekt";

export interface ImportedDeck {
  source: DeckSource;
  source_id: string;
  source_url: string;
  deck_name: string | null;
  format: string | null;          // normalized lowercase format if available
  cards: ParsedCard[];            // mainboard
  sideboard: ParsedCard[];
  commanders: ParsedCard[];
}

export interface DeckUrlMatch {
  source: DeckSource;
  id: string;
}

/**
 * Parse a supported deck URL. Returns null if URL is not recognized.
 */
export function parseDeckUrl(url: string): DeckUrlMatch | null {
  const cleaned = url.trim();

  // Moxfield: https://www.moxfield.com/decks/{id}  (id is alphanumeric + _ + -)
  const moxfield = cleaned.match(
    /^(?:https?:\/\/)?(?:www\.)?moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/i,
  );
  if (moxfield) {
    return { source: "moxfield", id: moxfield[1] };
  }

  // Archidekt: https://archidekt.com/decks/{numericId} — also /decks/{id}/{slug}
  const archidekt = cleaned.match(
    /^(?:https?:\/\/)?(?:www\.)?archidekt\.com\/decks\/(\d+)/i,
  );
  if (archidekt) {
    return { source: "archidekt", id: archidekt[1] };
  }

  return null;
}

/**
 * Fetch a deck from a supported source URL.
 * Throws an Error with a user-safe message on failure.
 */
export async function importDeckFromUrl(url: string): Promise<ImportedDeck> {
  const match = parseDeckUrl(url);
  if (!match) {
    throw new Error(
      "URL not recognized. Supported: moxfield.com/decks/..., archidekt.com/decks/...",
    );
  }

  if (match.source === "moxfield") {
    return fetchMoxfieldDeck(match.id);
  }
  return fetchArchidektDeck(match.id);
}

/* ---------- Moxfield ---------- */

async function fetchMoxfieldDeck(id: string): Promise<ImportedDeck> {
  const apiUrl = `https://api2.moxfield.com/v3/decks/all/${encodeURIComponent(id)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json", "User-Agent": "AfterroarOps/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 404) throw new Error("Moxfield deck not found (or it's private).");
    if (!res.ok) throw new Error(`Moxfield returned ${res.status}.`);

    const data = (await res.json()) as Record<string, unknown>;
    const boards = (data.boards ?? {}) as Record<string, unknown>;

    const mainboard = normalizeMoxfieldBoard(boards.mainboard);
    const sideboard = normalizeMoxfieldBoard(boards.sideboard);
    const commanders = normalizeMoxfieldBoard(boards.commanders);

    return {
      source: "moxfield",
      source_id: id,
      source_url: `https://www.moxfield.com/decks/${id}`,
      deck_name: typeof data.name === "string" ? data.name : null,
      format: typeof data.format === "string" ? data.format.toLowerCase() : null,
      cards: mainboard,
      sideboard,
      commanders,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Moxfield timed out. Try again.");
    }
    throw err;
  }
}

function normalizeMoxfieldBoard(board: unknown): ParsedCard[] {
  if (!board || typeof board !== "object") return [];
  const b = board as Record<string, unknown>;
  const cards = (b.cards ?? {}) as Record<string, unknown>;
  const out: ParsedCard[] = [];
  for (const entry of Object.values(cards)) {
    const e = entry as Record<string, unknown>;
    const qty = typeof e.quantity === "number" ? e.quantity : 0;
    const card = (e.card ?? {}) as Record<string, unknown>;
    const name = typeof card.name === "string" ? card.name : null;
    if (name && qty > 0) {
      out.push({ quantity: qty, name });
    }
  }
  return out;
}

/* ---------- Archidekt ---------- */

async function fetchArchidektDeck(id: string): Promise<ImportedDeck> {
  const apiUrl = `https://archidekt.com/api/decks/${encodeURIComponent(id)}/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json", "User-Agent": "AfterroarOps/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 404) throw new Error("Archidekt deck not found (or it's private).");
    if (!res.ok) throw new Error(`Archidekt returned ${res.status}.`);

    const data = (await res.json()) as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name : null;
    const format = typeof data.format === "number" ? mapArchidektFormat(data.format) : null;
    const cards = (Array.isArray(data.cards) ? data.cards : []) as Array<Record<string, unknown>>;

    const main: ParsedCard[] = [];
    const side: ParsedCard[] = [];
    const commanders: ParsedCard[] = [];

    for (const entry of cards) {
      const qty = typeof entry.quantity === "number" ? entry.quantity : 1;
      const card = (entry.card ?? {}) as Record<string, unknown>;
      const oracleCard = (card.oracleCard ?? card) as Record<string, unknown>;
      const cardName = typeof oracleCard.name === "string" ? oracleCard.name : null;
      if (!cardName || qty <= 0) continue;

      // Archidekt uses category labels; "Sideboard" / "Commander" / "Maybeboard"
      const categories = Array.isArray(entry.categories)
        ? (entry.categories as string[]).map((c) => c.toLowerCase())
        : [];

      if (categories.includes("sideboard")) {
        side.push({ quantity: qty, name: cardName });
      } else if (categories.includes("commander")) {
        commanders.push({ quantity: qty, name: cardName });
      } else if (categories.includes("maybeboard")) {
        // skip maybeboard
      } else {
        main.push({ quantity: qty, name: cardName });
      }
    }

    return {
      source: "archidekt",
      source_id: id,
      source_url: `https://archidekt.com/decks/${id}`,
      deck_name: name,
      format,
      cards: main,
      sideboard: side,
      commanders,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Archidekt timed out. Try again.");
    }
    throw err;
  }
}

// Archidekt format codes (partial) — based on their public API docs
function mapArchidektFormat(code: number): string | null {
  const map: Record<number, string> = {
    1: "standard",
    2: "modern",
    3: "commander",
    4: "legacy",
    5: "vintage",
    6: "pauper",
    9: "pioneer",
    10: "brawl",
    11: "historic",
    17: "pioneer",
  };
  return map[code] ?? null;
}
