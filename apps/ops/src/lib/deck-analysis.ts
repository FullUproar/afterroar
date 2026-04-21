/* ------------------------------------------------------------------ */
/*  Deck Analysis — pure functions over card metadata                   */
/*  Turns parsed cards + Scryfall metadata into summary stats:          */
/*  mana curve, color identity, format legality.                        */
/* ------------------------------------------------------------------ */

import type { ScryfallCardMetadata } from "./scryfall-batch";

export interface DeckCardWithQuantity {
  name: string;
  quantity: number;
}

export interface ManaCurveBucket {
  cmc: number;     // 0..7 (7 = 7+)
  count: number;   // total quantity at this CMC
}

export type Color = "W" | "U" | "B" | "R" | "G";

export interface ColorBreakdown {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  colorless: number;
  identity: Color[]; // unique non-colorless colors present
}

export interface LegalityCheck {
  format: string;
  legal: boolean;
  illegal_cards: Array<{ name: string; reason: "not_legal" | "banned" | "restricted" }>;
  total_checked: number;
  missing_metadata: string[]; // cards we couldn't verify
}

export interface DeckAnalysis {
  total_cards: number;
  unique_cards: number;
  mana_curve: ManaCurveBucket[];
  avg_cmc: number;
  colors: ColorBreakdown;
  legality: Record<string, LegalityCheck>;
  nonland_count: number;
  land_count: number;
}

const FORMATS_TO_CHECK = [
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "commander",
  "pauper",
];

/**
 * Analyze a parsed deck using fetched Scryfall metadata.
 * Missing metadata is handled gracefully — cards are still counted,
 * just not included in curve/color calcs.
 */
export function analyzeDeck(
  cards: DeckCardWithQuantity[],
  metadata: Map<string, ScryfallCardMetadata>,
): DeckAnalysis {
  const curve: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  const colors: ColorBreakdown = {
    W: 0, U: 0, B: 0, R: 0, G: 0, colorless: 0, identity: [],
  };

  let totalCards = 0;
  let nonlandCards = 0;
  let landCards = 0;
  let cmcSum = 0;
  let cmcCounted = 0;

  for (const card of cards) {
    const meta = metadata.get(card.name.toLowerCase());
    totalCards += card.quantity;

    const isLand = meta?.type_line?.toLowerCase().includes("land") ?? false;
    if (isLand) {
      landCards += card.quantity;
      continue; // lands don't go in curve or color calc
    }
    nonlandCards += card.quantity;

    if (meta) {
      // Curve bucket
      const bucket = Math.min(Math.floor(meta.cmc), 7);
      curve[bucket] += card.quantity;
      cmcSum += meta.cmc * card.quantity;
      cmcCounted += card.quantity;

      // Colors — count each color pip in mana cost per copy
      const manaColors = extractColorsFromManaCost(meta.mana_cost);
      if (manaColors.length === 0) {
        colors.colorless += card.quantity;
      } else {
        for (const c of manaColors) {
          colors[c] += card.quantity;
        }
      }
    }
  }

  // Build identity array — colors with non-zero presence, in WUBRG order
  const identity: Color[] = [];
  (["W", "U", "B", "R", "G"] as const).forEach((c) => {
    if (colors[c] > 0) identity.push(c);
  });
  colors.identity = identity;

  const mana_curve: ManaCurveBucket[] = Object.entries(curve).map(([cmc, count]) => ({
    cmc: parseInt(cmc, 10),
    count,
  }));

  // Legality check across formats
  const legality: Record<string, LegalityCheck> = {};
  for (const fmt of FORMATS_TO_CHECK) {
    legality[fmt] = checkFormatLegality(cards, metadata, fmt);
  }

  return {
    total_cards: totalCards,
    unique_cards: cards.length,
    mana_curve,
    avg_cmc: cmcCounted > 0 ? cmcSum / cmcCounted : 0,
    colors,
    legality,
    nonland_count: nonlandCards,
    land_count: landCards,
  };
}

/**
 * Extract colored mana pips from a mana_cost string like "{2}{U}{U/R}".
 * Returns unique colors present (each pip counted once per cost — if a card
 * has {U}{U}, we count 2 blue pips per copy).
 */
function extractColorsFromManaCost(manaCost: string | null): Color[] {
  if (!manaCost) return [];
  const result: Color[] = [];
  const tokens = manaCost.match(/\{[^}]+\}/g) ?? [];
  for (const token of tokens) {
    const inner = token.slice(1, -1).toUpperCase();
    // Colored: W, U, B, R, G (also hybrid U/R, Phyrexian W/P, etc.)
    for (const ch of inner) {
      if (ch === "W" || ch === "U" || ch === "B" || ch === "R" || ch === "G") {
        result.push(ch as Color);
      }
    }
  }
  return result;
}

function checkFormatLegality(
  cards: DeckCardWithQuantity[],
  metadata: Map<string, ScryfallCardMetadata>,
  format: string,
): LegalityCheck {
  const illegal: LegalityCheck["illegal_cards"] = [];
  const missing: string[] = [];
  let totalChecked = 0;

  for (const card of cards) {
    const meta = metadata.get(card.name.toLowerCase());
    if (!meta) {
      missing.push(card.name);
      continue;
    }
    totalChecked++;
    const status = meta.legalities[format];
    if (status === "not_legal" || status === "banned" || status === "restricted") {
      illegal.push({ name: card.name, reason: status });
    }
  }

  return {
    format,
    legal: illegal.length === 0 && totalChecked > 0,
    illegal_cards: illegal,
    total_checked: totalChecked,
    missing_metadata: missing,
  };
}
