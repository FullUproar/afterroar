/**
 * Integrations registry.
 *
 * Single source of truth for which external data sources Afterroar talks to,
 * what each provides, what categories it covers, and what config it needs.
 * The /dashboard/integrations page reads this to render status pills and
 * test-connection buttons; adapters at lib/integrations/<name>.ts implement
 * the actual `testConnection`, `search`, `lookup`, `mapToCatalog`.
 *
 * See docs/DATA_INTEGRATIONS_STRATEGY.md for the strategy framing.
 */

import type { ItemCategory } from "../types";

export type IntegrationKind =
  | "metadata" // catalog enrichment (BGG, Scryfall, ComicVine, …)
  | "marketplace" // outbound listings (eBay, ManaPool, CardTrader)
  | "pricing" // secondary-market price feeds (TCGPlayer, GoCollect)
  | "distributor" // wholesale catalogs (Diamond, Lunar, PRH)
  | "payment" // payment processing (Stripe)
  | "barcode" // generic barcode lookup (UPC databases);

export type IntegrationConfigScope = "platform" | "per_store" | "hybrid";

export interface IntegrationDefinition {
  /** Stable id used in URLs, env-vars, db rows. */
  id: string;
  /** Display name. */
  name: string;
  kind: IntegrationKind;
  /** Categories this source can populate metadata for. */
  categories: ItemCategory[];
  /** Marketing one-liner for the integrations dashboard. */
  description: string;
  /** External docs / signup link. */
  docsUrl?: string;
  /** Where the config lives — platform-wide, per-store, or either. */
  configScope: IntegrationConfigScope;
  /** Required env vars. Each adapter reads from these. */
  requiredEnv: string[];
  /** Capabilities exposed by the adapter. */
  capabilities: {
    search?: boolean; // text search returns multiple matches
    lookup?: boolean; // fetch by id / barcode
    mapToCatalog?: boolean; // can normalize records into PosCatalogProduct
    pricing?: boolean; // returns pricing data
    listing?: boolean; // outbound listing creation
  };
  /** True if this integration is shipped & wired into UI. False = adapter
   *  exists but no active call sites; lets us advertise readiness without
   *  pretending it's plumbed end-to-end. */
  active: boolean;
  /** Strategic priority order from DATA_INTEGRATIONS_STRATEGY.md. Lower = higher. */
  priority: number;
}

/* ------------------------------------------------------------------ */
/*  The registry. Order is intentional — by priority then category.     */
/* ------------------------------------------------------------------ */

export const INTEGRATIONS: IntegrationDefinition[] = [
  // -------- TCG metadata --------
  {
    id: "scryfall",
    name: "Scryfall",
    kind: "metadata",
    categories: ["tcg_single", "sealed"],
    description:
      "Magic: The Gathering metadata. Cards by name, set, oracle id, prices, image, legalities, color identity.",
    docsUrl: "https://scryfall.com/docs/api",
    configScope: "platform",
    requiredEnv: [],
    capabilities: { search: true, lookup: true, mapToCatalog: true, pricing: true },
    active: true,
    priority: 1,
  },
  {
    id: "pokemon_tcg",
    name: "Pokémon TCG API",
    kind: "metadata",
    categories: ["tcg_single", "sealed"],
    description:
      "Pokémon TCG cards by name, set, hp, types, attacks, rarity, image, market prices (via TCGPlayer mirrored data).",
    docsUrl: "https://docs.pokemontcg.io",
    configScope: "platform",
    // Optional API key for higher rate limits; works without.
    requiredEnv: [],
    capabilities: { search: true, lookup: true, mapToCatalog: true, pricing: true },
    active: true,
    priority: 3,
  },
  {
    id: "tcgplayer",
    name: "TCGPlayer",
    kind: "pricing",
    categories: ["tcg_single", "sealed"],
    description:
      "Cross-TCG marketplace pricing + listing. Currently blocked on partner approval — adapter ships ready for activation.",
    docsUrl: "https://docs.tcgplayer.com",
    configScope: "platform",
    requiredEnv: ["TCGPLAYER_PUBLIC_KEY", "TCGPLAYER_PRIVATE_KEY"],
    capabilities: { search: true, lookup: true, mapToCatalog: true, pricing: true, listing: true },
    active: false,
    priority: 2,
  },

  // -------- Board games --------
  {
    id: "bgg",
    name: "BoardGameGeek",
    kind: "metadata",
    categories: ["board_game", "rpg"],
    description:
      "The board-game and RPG catalog. Player count, weight, mechanics, themes, ratings. RPGGeek is the RPG subset.",
    docsUrl: "https://boardgamegeek.com/wiki/page/BGG_XML_API2",
    configScope: "platform",
    requiredEnv: [],
    capabilities: { search: true, lookup: true, mapToCatalog: true },
    active: true,
    priority: 1,
  },
  {
    id: "boardgameatlas",
    name: "Board Game Atlas",
    kind: "metadata",
    categories: ["board_game"],
    description:
      "Was the planned BGG fallback. API host (api.boardgameatlas.com) went offline in early 2026 and DNS no longer resolves. Kept as a stub; if a successor API surfaces we can rewire. For now BGG is the sole board-game catalog source.",
    docsUrl: "https://www.boardgameatlas.com/api/docs",
    configScope: "platform",
    requiredEnv: ["BOARDGAMEATLAS_CLIENT_ID"],
    capabilities: { search: true, lookup: true, mapToCatalog: true },
    active: false,
    priority: 11,
  },

  // -------- RPGs --------
  {
    id: "drivethrurpg",
    name: "DriveThruRPG",
    kind: "metadata",
    categories: ["rpg"],
    description:
      "RPG retail catalog. System, edition, book type, ISBN, publisher. Public catalog endpoint, no auth required for read.",
    docsUrl: "https://www.drivethrurpg.com/api",
    configScope: "platform",
    requiredEnv: [],
    capabilities: { search: true, lookup: true, mapToCatalog: true },
    active: true,
    priority: 4,
  },

  // -------- Comics --------
  {
    id: "comicvine",
    name: "ComicVine",
    kind: "metadata",
    categories: ["comic"],
    description:
      "Comic metadata across publishers: series, issue, cover artist, variant, creators. Free tier, requires API key.",
    docsUrl: "https://comicvine.gamespot.com/api/",
    configScope: "hybrid",
    requiredEnv: ["COMICVINE_API_KEY"],
    capabilities: { search: true, lookup: true, mapToCatalog: true },
    active: true,
    priority: 2,
  },
  {
    id: "gcd",
    name: "Grand Comics Database",
    kind: "metadata",
    categories: ["comic"],
    description:
      "Deepest community-curated comics metadata. No clean public REST API — relies on community-maintained mirrors and bulk data dumps.",
    docsUrl: "https://www.comics.org",
    configScope: "platform",
    requiredEnv: [],
    capabilities: { search: false, lookup: false, mapToCatalog: false },
    active: false,
    priority: 12,
  },
  {
    id: "marvel",
    name: "Marvel API",
    kind: "metadata",
    categories: ["comic"],
    description: "Marvel-specific catalog. Limited but official.",
    docsUrl: "https://developer.marvel.com",
    configScope: "platform",
    requiredEnv: ["MARVEL_PUBLIC_KEY", "MARVEL_PRIVATE_KEY"],
    capabilities: { search: true, lookup: true, mapToCatalog: true },
    active: false,
    priority: 13,
  },

  // -------- Universal --------
  {
    id: "openlibrary",
    name: "Open Library",
    kind: "metadata",
    categories: ["comic", "rpg", "other"],
    description:
      "Books by ISBN. Useful for graphic novels, RPG books, anything with an ISBN-13 barcode. Free, no auth.",
    docsUrl: "https://openlibrary.org/developers/api",
    configScope: "platform",
    requiredEnv: [],
    capabilities: { search: true, lookup: true, mapToCatalog: true },
    active: true,
    priority: 5,
  },
  {
    id: "upcdb",
    name: "UPC database (community)",
    kind: "barcode",
    categories: ["accessory", "collectible", "food_drink", "other"],
    description:
      "Generic barcode → product name fallback for unknown UPCs. Last resort when no specialized catalog matches.",
    docsUrl: "https://www.upcitemdb.com",
    configScope: "platform",
    requiredEnv: [],
    capabilities: { lookup: true, mapToCatalog: true },
    active: true,
    priority: 6,
  },
  {
    id: "openfoodfacts",
    name: "Open Food Facts",
    kind: "metadata",
    categories: ["food_drink"],
    description:
      "Open community catalog of packaged food + drink. Allergens, ingredients, nutrition grade, NOVA group, barcodes. Search by name or lookup by barcode.",
    docsUrl: "https://openfoodfacts.github.io/openfoodfacts-server/api/",
    configScope: "platform",
    requiredEnv: [],
    capabilities: { search: true, lookup: true, mapToCatalog: true },
    active: true,
    priority: 7,
  },

  // -------- Future-vertical scaffolds (record stores, etc.) --------
  // These adapters exist today but no active call sites. They prove the
  // registry pattern handles non-game categories cleanly. When a record-
  // store pilot happens, flip `active: true` + add `vinyl` to ItemCategory.
  {
    id: "discogs",
    name: "Discogs",
    kind: "metadata",
    categories: [], // no `vinyl` category in the schema yet
    description:
      "Future-vertical scaffold for record stores. Vinyl + physical music releases by artist/title/barcode. Free auth (token raises rate limit from 25 to 60 req/min).",
    docsUrl: "https://www.discogs.com/developers",
    configScope: "platform",
    requiredEnv: [],
    capabilities: { search: true, lookup: true, mapToCatalog: true },
    active: false,
    priority: 30,
  },
  {
    id: "musicbrainz",
    name: "MusicBrainz",
    kind: "metadata",
    categories: [],
    description:
      "Future-vertical scaffold; open-data backup music metadata. Smaller catalog than Discogs but well-curated, no auth needed. UPC-indexed.",
    docsUrl: "https://musicbrainz.org/doc/MusicBrainz_API",
    configScope: "platform",
    requiredEnv: [],
    capabilities: { search: true, lookup: true, mapToCatalog: true },
    active: false,
    priority: 31,
  },

  // -------- Marketplaces (outbound listing) --------
  {
    id: "manapool",
    name: "ManaPool",
    kind: "marketplace",
    categories: ["tcg_single"],
    description: "TCG marketplace for outbound listings.",
    configScope: "per_store",
    requiredEnv: [],
    capabilities: { listing: true },
    active: true,
    priority: 20,
  },
  {
    id: "cardtrader",
    name: "CardTrader",
    kind: "marketplace",
    categories: ["tcg_single", "sealed"],
    description: "TCG marketplace, EU-strong. Outbound listings.",
    configScope: "per_store",
    requiredEnv: [],
    capabilities: { listing: true },
    active: true,
    priority: 20,
  },
  {
    id: "ebay",
    name: "eBay",
    kind: "marketplace",
    categories: ["tcg_single", "sealed", "comic", "collectible", "miniature"],
    description: "Universal marketplace. Outbound listings.",
    configScope: "per_store",
    requiredEnv: [],
    capabilities: { listing: true },
    active: true,
    priority: 20,
  },

  // -------- Payment (informational — the integration "exists" everywhere) --------
  {
    id: "stripe",
    name: "Stripe",
    kind: "payment",
    categories: [],
    description: "Card sales (Tap-to-Pay + Stripe Elements) and refunds. Not catalog metadata — listed for status visibility.",
    docsUrl: "https://stripe.com/docs",
    configScope: "platform",
    requiredEnv: ["STRIPE_SECRET_KEY"],
    capabilities: {},
    active: true,
    priority: 99,
  },
];

export function getIntegration(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

export function activeMetadataIntegrationsForCategory(category: ItemCategory): IntegrationDefinition[] {
  return INTEGRATIONS.filter(
    (i) => i.active && i.kind === "metadata" && i.categories.includes(category),
  );
}
