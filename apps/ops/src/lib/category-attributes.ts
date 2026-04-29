/**
 * Category-aware attribute schema registry.
 *
 * Each product category can declare a list of category-specific fields that
 * the inventory edit UI renders dynamically. The actual values live in
 * `PosInventoryItem.attributes` JSON; this registry just describes what's
 * expected, how to label/render it, and whether it's searchable.
 *
 * Why this exists (per docs/INVENTORY_AUDIT_2026_04_28.md):
 *   The previous pattern was hand-coded UI branches per category (the
 *   inventory edit form had `if (item.category === 'board_game') { ... }`
 *   checks scattered around). That worked for 2 categories. With 9, it
 *   collapses into copy-paste. This registry codifies the pattern so adding
 *   a category is "add an entry here" rather than "edit four files."
 *
 * Why TypeScript (not DB-driven yet):
 *   v1 keeps the schema in code. Per-store customization is plausible
 *   eventually but YAGNI today. When/if a store wants to add their own
 *   field ("paint state for our miniatures pickup line"), the next iteration
 *   moves this to a PosCategoryAttribute table with code-defaults. For now,
 *   one source of truth in TS.
 *
 * Why this is "vertical-agnostic core, FLGS-specific extensions on top":
 *   The registry mechanism is generic. The specific category entries are
 *   FLGS-vertical-specific. A future bookstore vertical would add its own
 *   entries (book genre, ISBN, signed-by, etc.) using the same mechanism.
 */

import type { ItemCategory } from "./types";

export type AttributeType = "string" | "number" | "boolean" | "enum" | "date";

export interface AttributeField {
  /** JSON key inside `PosInventoryItem.attributes`. snake_case for consistency. */
  key: string;
  /** Human-readable label for the form. */
  label: string;
  type: AttributeType;
  /** Help text shown under the input. Optional. */
  hint?: string;
  /** Allowed values when type='enum'. */
  enumValues?: { value: string; label: string }[];
  /** Surface the field as a badge in the inventory list view + on the detail page. */
  displayInRow?: boolean;
  /** Used by category-aware search UI. v2. Recorded today, consumed later. */
  searchable?: boolean;
  /** Field is required when this category is selected. */
  required?: boolean;
}

export interface CategorySchema {
  category: ItemCategory;
  /** Display label for the category itself. */
  label: string;
  /** Optional plain-language hint shown when the category is selected. */
  description?: string;
  /** Fields specific to this category. Generic fields (name, sku, qty, price)
   *  are NOT included here — they're already first-class columns. */
  attributes: AttributeField[];
}

/* ------------------------------------------------------------------ */
/*  TCG single — already partially first-class. Fields here are the   */
/*  ones that should EVENTUALLY be promoted to columns; until then,   */
/*  they live in attributes for indexing-via-Postgres-jsonb-paths.    */
/* ------------------------------------------------------------------ */
const TCG_CONDITIONS = [
  { value: "M", label: "Mint" },
  { value: "NM", label: "Near Mint" },
  { value: "LP", label: "Lightly Played" },
  { value: "MP", label: "Moderately Played" },
  { value: "HP", label: "Heavily Played" },
  { value: "DMG", label: "Damaged" },
];

/* ------------------------------------------------------------------ */
/*  Comic conditions follow the Overstreet grading scale (most common */
/*  retail scale). Numeric grades (CGC/CBCS slabs) are a different    */
/*  field captured separately when present.                            */
/* ------------------------------------------------------------------ */
const COMIC_CONDITIONS = [
  { value: "M", label: "Mint" },
  { value: "NM", label: "Near Mint" },
  { value: "VF", label: "Very Fine" },
  { value: "FN", label: "Fine" },
  { value: "VG", label: "Very Good" },
  { value: "GD", label: "Good" },
  { value: "FR", label: "Fair" },
  { value: "PR", label: "Poor" },
];

const RPG_BOOK_TYPES = [
  { value: "core", label: "Core Rulebook" },
  { value: "supplement", label: "Supplement" },
  { value: "adventure", label: "Adventure / Module" },
  { value: "setting", label: "Setting Guide" },
  { value: "screen", label: "GM Screen" },
  { value: "accessory", label: "Accessory" },
];

const MINIATURE_STATES = [
  { value: "sealed", label: "Sealed (in box)" },
  { value: "sprued", label: "On sprue" },
  { value: "assembled", label: "Assembled" },
  { value: "primed", label: "Primed" },
  { value: "painted", label: "Painted" },
];

const MINIATURE_MATERIALS = [
  { value: "plastic", label: "Plastic" },
  { value: "resin", label: "Resin" },
  { value: "metal", label: "Metal" },
  { value: "mixed", label: "Mixed" },
];

const BOARD_GAME_CONDITIONS = [
  { value: "new_sealed", label: "New / Sealed" },
  { value: "open_complete", label: "Open / Complete" },
  { value: "used_good", label: "Used / Good" },
  { value: "used_fair", label: "Used / Fair" },
  { value: "incomplete", label: "Incomplete" },
];

export const CATEGORY_SCHEMAS: Record<ItemCategory, CategorySchema> = {
  tcg_single: {
    category: "tcg_single",
    label: "TCG Single",
    attributes: [
      {
        key: "foil",
        label: "Foil",
        type: "boolean",
        displayInRow: true,
        searchable: true,
      },
      {
        key: "condition",
        label: "Condition",
        type: "enum",
        enumValues: TCG_CONDITIONS,
        displayInRow: true,
        searchable: true,
      },
      { key: "language", label: "Language", type: "string", hint: "EN, JP, DE, etc." },
      { key: "set_name", label: "Set", type: "string", searchable: true },
      { key: "collector_number", label: "Collector #", type: "string" },
      {
        key: "graded_by",
        label: "Grading",
        type: "enum",
        enumValues: [
          { value: "", label: "Ungraded" },
          { value: "PSA", label: "PSA" },
          { value: "BGS", label: "BGS" },
          { value: "CGC", label: "CGC" },
          { value: "SGC", label: "SGC" },
        ],
        displayInRow: true,
      },
      { key: "graded_score", label: "Grade", type: "string", hint: "10, 9.5, 9, etc." },
      { key: "signed_by", label: "Signed By", type: "string" },
    ],
  },

  sealed: {
    category: "sealed",
    label: "Sealed Product",
    attributes: [
      { key: "set_name", label: "Set", type: "string", searchable: true, displayInRow: true },
      {
        key: "product_type",
        label: "Product Type",
        type: "enum",
        enumValues: [
          { value: "booster_pack", label: "Booster Pack" },
          { value: "booster_box", label: "Booster Box" },
          { value: "case", label: "Case" },
          { value: "starter_deck", label: "Starter Deck" },
          { value: "preconstructed", label: "Preconstructed Deck" },
          { value: "bundle", label: "Bundle / Gift Box" },
          { value: "collector_set", label: "Collector Set" },
        ],
        displayInRow: true,
      },
      { key: "language", label: "Language", type: "string" },
    ],
  },

  board_game: {
    category: "board_game",
    label: "Board Game",
    attributes: [
      {
        key: "edition",
        label: "Edition",
        type: "string",
        hint: "1st, Kickstarter, Deluxe, Retail, etc.",
        searchable: true,
      },
      { key: "language", label: "Language", type: "string", hint: "EN, FR, JP, etc." },
      {
        key: "condition",
        label: "Condition",
        type: "enum",
        enumValues: BOARD_GAME_CONDITIONS,
        displayInRow: true,
      },
      { key: "expansion_of", label: "Expansion Of", type: "string", hint: "Base game name (free text for now)" },
      { key: "publisher", label: "Publisher", type: "string", searchable: true },
    ],
  },

  rpg: {
    category: "rpg",
    label: "RPG Book",
    description:
      "Tabletop RPG books — core rulebooks, supplements, adventures, settings. Use 'system' for the game line (D&D 5e, Pathfinder 2e, Call of Cthulhu, etc.).",
    attributes: [
      {
        key: "system",
        label: "System",
        type: "string",
        hint: "D&D 5e, Pathfinder 2e, Call of Cthulhu 7e, Mörk Borg, etc.",
        searchable: true,
        displayInRow: true,
      },
      { key: "edition", label: "Edition", type: "string", hint: "5e, 2e, etc." },
      {
        key: "book_type",
        label: "Book Type",
        type: "enum",
        enumValues: RPG_BOOK_TYPES,
        displayInRow: true,
      },
      { key: "setting", label: "Setting", type: "string", hint: "Forgotten Realms, Eberron, Greyhawk, etc." },
      { key: "publisher", label: "Publisher", type: "string", searchable: true },
      {
        key: "format",
        label: "Format",
        type: "enum",
        enumValues: [
          { value: "hardcover", label: "Hardcover" },
          { value: "softcover", label: "Softcover" },
          { value: "spiral", label: "Spiral Bound" },
          { value: "boxed_set", label: "Boxed Set" },
          { value: "pdf", label: "PDF / Digital" },
        ],
      },
      { key: "isbn", label: "ISBN", type: "string", hint: "13-digit if available" },
    ],
  },

  miniature: {
    category: "miniature",
    label: "Miniature",
    description:
      "Wargaming and RPG miniatures. Track system, faction, painted state. Used by stores running 40k / AoS / Star Wars Legion / etc. inventory.",
    attributes: [
      {
        key: "system",
        label: "Game System",
        type: "string",
        hint: "Warhammer 40k, Age of Sigmar, Star Wars Legion, Battletech, Bolt Action, etc.",
        searchable: true,
        displayInRow: true,
      },
      { key: "faction", label: "Faction / Army", type: "string", searchable: true, displayInRow: true },
      {
        key: "unit_type",
        label: "Unit Type",
        type: "string",
        hint: "HQ, Troops, Elites, Heavy Support, etc. — game-specific roles",
      },
      {
        key: "scale",
        label: "Scale",
        type: "enum",
        enumValues: [
          { value: "32mm", label: "32mm (heroic)" },
          { value: "28mm", label: "28mm" },
          { value: "15mm", label: "15mm" },
          { value: "6mm", label: "6mm / Epic" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "material",
        label: "Material",
        type: "enum",
        enumValues: MINIATURE_MATERIALS,
      },
      {
        key: "state",
        label: "State",
        type: "enum",
        enumValues: MINIATURE_STATES,
        displayInRow: true,
      },
      {
        key: "manufacturer",
        label: "Manufacturer",
        type: "string",
        hint: "Games Workshop, Atomic Mass, Wargames Atlantic, etc.",
      },
    ],
  },

  comic: {
    category: "comic",
    label: "Comic",
    description:
      "Comic books — single issues, variant covers, one-shots. For graphic novels and trade paperbacks, use this category too with book_type='trade_paperback'.",
    attributes: [
      {
        key: "series_title",
        label: "Series Title",
        type: "string",
        hint: "Saga, The Department of Truth, Spider-Man, etc.",
        required: true,
        searchable: true,
        displayInRow: true,
      },
      {
        key: "issue_number",
        label: "Issue #",
        type: "string",
        hint: "1, 2, 100, Annual 1, etc. (string to allow specials)",
        searchable: true,
        displayInRow: true,
      },
      {
        key: "variant_cover",
        label: "Variant Cover",
        type: "string",
        hint: "Cover A / B / 1:25 / etc. (free text)",
        displayInRow: true,
      },
      { key: "cover_artist", label: "Cover Artist", type: "string" },
      {
        key: "publisher",
        label: "Publisher",
        type: "string",
        searchable: true,
        hint: "Marvel, DC, Image, Dark Horse, BOOM!, etc.",
      },
      { key: "release_date", label: "Release Date", type: "date" },
      {
        key: "book_type",
        label: "Book Type",
        type: "enum",
        enumValues: [
          { value: "single_issue", label: "Single Issue" },
          { value: "trade_paperback", label: "Trade Paperback" },
          { value: "hardcover", label: "Hardcover Collection" },
          { value: "graphic_novel", label: "Original Graphic Novel" },
          { value: "magazine", label: "Magazine / Companion" },
          { value: "one_shot", label: "One-Shot" },
        ],
        displayInRow: true,
      },
      {
        key: "condition",
        label: "Condition",
        type: "enum",
        enumValues: COMIC_CONDITIONS,
        displayInRow: true,
      },
      {
        key: "is_signed",
        label: "Signed",
        type: "boolean",
      },
      { key: "signed_by", label: "Signed By", type: "string" },
      {
        key: "graded_by",
        label: "Grading Service",
        type: "enum",
        enumValues: [
          { value: "", label: "Ungraded (raw)" },
          { value: "CGC", label: "CGC" },
          { value: "CBCS", label: "CBCS" },
          { value: "PGX", label: "PGX" },
        ],
      },
      { key: "graded_score", label: "Numerical Grade", type: "string", hint: "9.8, 9.6, 9.4, etc." },
      { key: "graded_serial", label: "Slab Serial #", type: "string" },
    ],
  },

  accessory: {
    category: "accessory",
    label: "Accessory",
    attributes: [
      {
        key: "accessory_type",
        label: "Type",
        type: "enum",
        enumValues: [
          { value: "deck_box", label: "Deck Box" },
          { value: "sleeves", label: "Card Sleeves" },
          { value: "playmat", label: "Playmat" },
          { value: "binder", label: "Binder" },
          { value: "dice", label: "Dice" },
          { value: "storage", label: "Storage" },
          { value: "paint", label: "Paint / Hobby" },
          { value: "tools", label: "Hobby Tools" },
          { value: "other", label: "Other" },
        ],
        displayInRow: true,
      },
      { key: "manufacturer", label: "Manufacturer", type: "string", searchable: true },
    ],
  },

  collectible: {
    category: "collectible",
    label: "Collectible",
    description:
      "Limited / numbered / signed merchandise. Apparel, figurines, art prints, signed memorabilia.",
    attributes: [
      {
        key: "collectible_type",
        label: "Type",
        type: "enum",
        enumValues: [
          { value: "apparel", label: "Apparel" },
          { value: "figurine", label: "Figurine / Statue" },
          { value: "funko", label: "Funko / Vinyl" },
          { value: "print", label: "Art Print / Poster" },
          { value: "memorabilia", label: "Signed Memorabilia" },
          { value: "other", label: "Other" },
        ],
        displayInRow: true,
      },
      { key: "franchise", label: "Franchise / IP", type: "string", searchable: true, hint: "Star Wars, Marvel, etc." },
      { key: "manufacturer", label: "Manufacturer", type: "string" },
      { key: "scale", label: "Scale", type: "string", hint: "1/6, 1/12, 12-inch, etc." },
      { key: "size", label: "Size", type: "string", hint: "S/M/L/XL for apparel; height/inches for figurines" },
      { key: "color", label: "Color", type: "string", hint: "for apparel/variants" },
      {
        key: "is_limited",
        label: "Limited Edition",
        type: "boolean",
        displayInRow: true,
      },
      { key: "edition_size", label: "Edition Size", type: "number", hint: "Total run, e.g. 500" },
      { key: "edition_number", label: "Edition #", type: "string", hint: "e.g. 042 of 500" },
      {
        key: "is_signed",
        label: "Signed",
        type: "boolean",
        displayInRow: true,
      },
      { key: "signed_by", label: "Signed By", type: "string" },
    ],
  },

  food_drink: {
    category: "food_drink",
    label: "Food & Drink",
    description: "Cafe items live in PosMenuItem (separate model). This category covers packaged retail (snacks, drinks for sale).",
    attributes: [
      {
        key: "subcategory",
        label: "Type",
        type: "enum",
        enumValues: [
          { value: "drink", label: "Drink" },
          { value: "snack", label: "Snack" },
          { value: "candy", label: "Candy" },
          { value: "alcohol", label: "Alcohol" },
          { value: "energy", label: "Energy / Caffeine" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "age_restricted",
        label: "Age Restricted",
        type: "boolean",
        hint: "Tobacco / alcohol / energy drink — POS will prompt for ID",
        displayInRow: true,
      },
      { key: "expiration_date", label: "Expiration Date", type: "date" },
    ],
  },

  other: {
    category: "other",
    label: "Other",
    attributes: [],
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers used by the inventory edit + list UIs.                     */
/* ------------------------------------------------------------------ */

export function schemaFor(category: ItemCategory | string): CategorySchema {
  return CATEGORY_SCHEMAS[category as ItemCategory] ?? CATEGORY_SCHEMAS.other;
}

/** Fields that should appear as badges/columns in the list view. */
export function rowDisplayFields(category: ItemCategory | string): AttributeField[] {
  return schemaFor(category).attributes.filter((a) => a.displayInRow);
}

/** Fields that should be available in category-aware search/filter UI. */
export function searchableFields(category: ItemCategory | string): AttributeField[] {
  return schemaFor(category).attributes.filter((a) => a.searchable);
}

/** Returns a human-readable summary string from the attributes JSON, useful
 *  for compact list rows. e.g. for a comic: "Saga #54 · Cover B · NM" */
export function summarizeAttributes(
  category: ItemCategory | string,
  attributes: Record<string, unknown> | null | undefined,
): string {
  if (!attributes) return "";
  const fields = rowDisplayFields(category);
  const parts: string[] = [];
  for (const f of fields) {
    const v = attributes[f.key];
    if (v == null || v === "") continue;
    if (f.type === "boolean") {
      if (v === true) parts.push(f.label);
      continue;
    }
    if (f.type === "enum") {
      const enumLabel = f.enumValues?.find((e) => e.value === v)?.label;
      parts.push(enumLabel ?? String(v));
      continue;
    }
    parts.push(String(v));
  }
  return parts.join(" · ");
}
