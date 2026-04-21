/* ------------------------------------------------------------------ */
/*  Scryfall batch metadata lookup                                      */
/*  Uses /cards/collection (up to 75 identifiers per request, 1 call). */
/*  Ref: https://scryfall.com/docs/api/cards/collection                 */
/* ------------------------------------------------------------------ */

export interface ScryfallCardMetadata {
  name: string;
  mana_cost: string | null;    // e.g. "{2}{U}{U}"
  cmc: number;                 // converted mana cost
  type_line: string;
  colors: string[];            // on-card colors, e.g. ["U"]
  color_identity: string[];    // deck-building identity, e.g. ["U"]
  rarity: string;
  set: string;
  set_name: string;
  image_small: string | null;
  image_normal: string | null;
  legalities: Record<string, "legal" | "not_legal" | "banned" | "restricted">;
}

const MAX_PER_REQUEST = 75;
const SCRYFALL_DELAY_MS = 100; // Scryfall asks for 50-100ms between requests

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Batch-fetch Scryfall metadata for a list of card names.
 * Returns a map keyed by lower-cased normalized name → metadata.
 * Cards that fail to resolve are omitted silently.
 */
export async function fetchCardMetadataByName(
  names: string[],
): Promise<Map<string, ScryfallCardMetadata>> {
  const result = new Map<string, ScryfallCardMetadata>();
  if (names.length === 0) return result;

  // De-dupe and normalize
  const unique = Array.from(new Set(names.map((n) => n.trim()))).filter(Boolean);

  for (let i = 0; i < unique.length; i += MAX_PER_REQUEST) {
    const batch = unique.slice(i, i + MAX_PER_REQUEST);
    try {
      const identifiers = batch.map((n) => ({ name: n }));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ identifiers }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      const cards: unknown[] = Array.isArray(data.data) ? data.data : [];

      for (const raw of cards) {
        const c = raw as Record<string, unknown>;
        const name = String(c.name ?? "");
        if (!name) continue;

        const imageUris = (c.image_uris ?? null) as Record<string, string> | null;
        const cardFaces = (c.card_faces ?? []) as Array<{ image_uris?: Record<string, string> }>;
        const image_small = imageUris?.small ?? cardFaces[0]?.image_uris?.small ?? null;
        const image_normal = imageUris?.normal ?? cardFaces[0]?.image_uris?.normal ?? null;

        // Some cards (dual-faced) don't have mana_cost at the top level — use front face.
        let mana_cost = (c.mana_cost as string | null) ?? null;
        if (!mana_cost && cardFaces.length > 0) {
          mana_cost = (cardFaces[0] as Record<string, unknown>).mana_cost as string | null;
        }

        result.set(name.toLowerCase(), {
          name,
          mana_cost: mana_cost ?? null,
          cmc: typeof c.cmc === "number" ? c.cmc : 0,
          type_line: String(c.type_line ?? ""),
          colors: Array.isArray(c.colors) ? (c.colors as string[]) : [],
          color_identity: Array.isArray(c.color_identity) ? (c.color_identity as string[]) : [],
          rarity: String(c.rarity ?? ""),
          set: String(c.set ?? ""),
          set_name: String(c.set_name ?? ""),
          image_small,
          image_normal,
          legalities: (c.legalities ?? {}) as ScryfallCardMetadata["legalities"],
        });
      }
    } catch {
      // Network / parse error — skip this batch silently
    }

    if (i + MAX_PER_REQUEST < unique.length) {
      await delay(SCRYFALL_DELAY_MS);
    }
  }

  return result;
}
