/**
 * Per-store vertical-module catalog.
 *
 * Each module bundles a product line (TCGs, comics, miniatures, ...) into
 * a single store-level toggle. Turning a module off hides:
 *   - related sidebar nav entries
 *   - related inventory categories from the Add-Item dropdowns
 *   - related catalog-lookup integrations on the inventory edit page
 *
 * Toggles are **UI-only**. They flip a flag in `store.settings.enabled_verticals`,
 * which is just a Json column. No data is deleted when a module is turned off:
 *   - existing inventory items in that category stay in the DB
 *   - existing pull lists, recipes, holds, etc. stay
 *   - flipping the module back on instantly restores all surfaces
 *
 * That contract is critical because shops change their mix all the time
 * (a board-game-only shop adds TCG mid-year; a hybrid shop drops cafe in
 * winter). The toggle has to be reversible without consequence.
 *
 * Default behavior when `enabled_verticals` is undefined: all enabled
 * (backward-compat for existing stores).
 *
 * Default behavior when `enabled_verticals` is an empty array: nothing
 * enabled (the operator actively turned everything off — their choice).
 *
 * See docs/INVENTORY_AUDIT_2026_04_28.md for the product-line context.
 */

import type { ItemCategory } from "./types";

export type VerticalModuleKey =
  | "tcg"
  | "board_games"
  | "rpgs"
  | "miniatures"
  | "comics"
  | "collectibles"
  | "cafe"
  | "events"
  | "food_drink_retail";

export interface VerticalModuleDef {
  key: VerticalModuleKey;
  label: string;
  /** One-liner shown next to the toggle. */
  description: string;
  /** Sidebar nav hrefs hidden when this module is off. */
  navHrefs: string[];
  /** Item categories hidden from inventory pickers when this module is off. */
  itemCategories: ItemCategory[];
  /** Catalog-adapter ids whose Lookup widget hides when off. Optional. */
  integrationIds?: string[];
  /** True if a typical FLGS would have this on by default. Used for the
   *  initial-setup wizard to seed sensible defaults. */
  defaultOnForFlgs: boolean;
}

export const VERTICAL_MODULES: VerticalModuleDef[] = [
  {
    key: "tcg",
    label: "TCG",
    description:
      "Magic, Pokémon, Lorcana, Flesh & Blood, etc. Singles, sealed, deck builder, buylist, trade-ins.",
    navHrefs: [
      "/dashboard/catalog",
      "/dashboard/singles",
      "/dashboard/deck-builder",
      "/dashboard/buylist",
      "/dashboard/trade-ins",
    ],
    itemCategories: ["tcg_single", "sealed"],
    integrationIds: ["scryfall", "pokemon_tcg", "tcgplayer", "manapool", "cardtrader"],
    defaultOnForFlgs: true,
  },
  {
    key: "board_games",
    label: "Board games",
    description:
      "Retail board games + hobby games. Includes the on-shelf game library lending workflow.",
    navHrefs: ["/dashboard/game-library"],
    itemCategories: ["board_game"],
    integrationIds: ["bgg", "boardgameatlas"],
    defaultOnForFlgs: true,
  },
  {
    key: "rpgs",
    label: "RPGs",
    description: "Tabletop RPG books — D&D, Pathfinder, Call of Cthulhu, indie systems.",
    navHrefs: [],
    itemCategories: ["rpg"],
    integrationIds: ["drivethrurpg", "openlibrary"],
    defaultOnForFlgs: true,
  },
  {
    key: "miniatures",
    label: "Miniatures",
    description: "Wargaming + skirmish miniatures. 40k, AoS, Star Wars Legion, Battletech, etc.",
    navHrefs: [],
    itemCategories: ["miniature"],
    defaultOnForFlgs: false,
  },
  {
    key: "comics",
    label: "Comics",
    description:
      "Single-issue comics, trades, graphic novels. Includes the pull-list management + Wednesday receive workflow.",
    navHrefs: ["/dashboard/pull-lists"],
    itemCategories: ["comic"],
    integrationIds: ["comicvine", "gcd", "marvel", "openlibrary"],
    defaultOnForFlgs: false,
  },
  {
    key: "collectibles",
    label: "Collectibles",
    description: "Apparel, figurines, Funkos, signed memorabilia, art prints.",
    navHrefs: [],
    itemCategories: ["collectible"],
    defaultOnForFlgs: false,
  },
  {
    key: "cafe",
    label: "Cafe",
    description:
      "Counter food + drink with menu items, recipes, ingredient decrement, 86 list, tab management.",
    navHrefs: ["/dashboard/cafe"],
    itemCategories: [],
    integrationIds: ["openfoodfacts"],
    defaultOnForFlgs: false,
  },
  {
    key: "events",
    label: "Events & tournaments",
    description:
      "FNM, prereleases, RPG nights, ticketed events. Includes prize-pool inventory holds and bracket management.",
    navHrefs: ["/dashboard/events", "/dashboard/tournaments"],
    itemCategories: [],
    defaultOnForFlgs: true,
  },
  {
    key: "food_drink_retail",
    label: "Packaged food & drink (retail)",
    description:
      "Bagged snacks, energy drinks, candy on the shelf — distinct from the cafe menu. Hides the food_drink inventory category when off.",
    navHrefs: [],
    itemCategories: ["food_drink"],
    integrationIds: ["openfoodfacts", "upcdb"],
    defaultOnForFlgs: false,
  },
];

const ALL_KEYS = new Set<VerticalModuleKey>(VERTICAL_MODULES.map((m) => m.key));

export function getModuleDef(key: VerticalModuleKey): VerticalModuleDef | undefined {
  return VERTICAL_MODULES.find((m) => m.key === key);
}

/**
 * Resolve enabled modules from settings.
 *
 *   undefined  → all enabled (backward-compat for stores predating the toggle)
 *   string[]   → exactly those (empty = nothing enabled)
 */
export function resolveEnabledModules(
  enabled: VerticalModuleKey[] | undefined,
): Set<VerticalModuleKey> {
  if (enabled === undefined) return new Set(ALL_KEYS);
  return new Set(enabled.filter((k): k is VerticalModuleKey => ALL_KEYS.has(k as VerticalModuleKey)));
}

/** True if the nav href is gated to a module that is currently disabled. */
export function isNavHrefGatedOff(
  href: string,
  enabled: Set<VerticalModuleKey>,
): boolean {
  for (const m of VERTICAL_MODULES) {
    if (!enabled.has(m.key) && m.navHrefs.includes(href)) return true;
  }
  return false;
}

/** True if the inventory category is gated to a module that is currently disabled. */
export function isCategoryGatedOff(
  category: ItemCategory,
  enabled: Set<VerticalModuleKey>,
): boolean {
  for (const m of VERTICAL_MODULES) {
    if (!enabled.has(m.key) && m.itemCategories.includes(category)) return true;
  }
  return false;
}

/** True if the integration id is gated to a module that is currently disabled.
 *  An integration tied to multiple modules is gated only if ALL its parent
 *  modules are off (so OFF stays available for stores that have either cafe
 *  or food_drink_retail enabled, even if the other is off). */
export function isIntegrationGatedOff(
  integrationId: string,
  enabled: Set<VerticalModuleKey>,
): boolean {
  const parents = VERTICAL_MODULES.filter((m) => m.integrationIds?.includes(integrationId));
  if (parents.length === 0) return false;
  return parents.every((m) => !enabled.has(m.key));
}

/** Default seed for new FLGS stores. */
export function defaultFlgsModules(): VerticalModuleKey[] {
  return VERTICAL_MODULES.filter((m) => m.defaultOnForFlgs).map((m) => m.key);
}
