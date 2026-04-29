/**
 * UPC barcode lookup adapter (community sources).
 *
 * Strategy:
 *   1. UPCitemdb's free trial endpoint (no key, ~100/day per IP)
 *      https://api.upcitemdb.com/prod/trial/lookup?upc=...
 *   2. Open Food Facts (food-only) as a secondary check for groceries.
 *
 * This is a fallback for first-receive of unknown barcodes when the
 * specialized adapters (Scryfall/BGG/ComicVine) don't have a match. The
 * data quality is mid (mostly "name + manufacturer + image"), so the
 * resulting catalog record is shallow on purpose. Operators can edit
 * fields after import.
 */

import type { CatalogAdapter, CatalogRecord, ConnectionTestResult, CatalogSearchResult } from "./types";

const UPCITEMDB_BASE = "https://api.upcitemdb.com/prod/trial";
const OFF_BASE = "https://world.openfoodfacts.org/api/v2";

interface UpcItemDbItem {
  ean?: string;
  upc?: string;
  title?: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  category?: string;
  images?: string[];
  asin?: string;
  model?: string;
}

interface UpcItemDbResponse {
  code?: string;
  total?: number;
  items?: UpcItemDbItem[];
}

interface OffProduct {
  product?: {
    product_name?: string;
    brands?: string;
    image_url?: string;
    nutriments?: Record<string, unknown>;
    allergens_tags?: string[];
    quantity?: string;
  };
  status?: number;
  status_verbose?: string;
}

function inferCategory(item: UpcItemDbItem): string {
  const cat = (item.category ?? "").toLowerCase();
  if (/food|beverage|grocery/.test(cat)) return "food_drink";
  if (/toy|game/.test(cat)) return "other";
  if (/apparel|clothing|shirt/.test(cat)) return "collectible";
  return "other";
}

function mapUpcItem(item: UpcItemDbItem): CatalogRecord {
  const barcode = item.ean ?? item.upc ?? "";
  return {
    external_id: barcode,
    name: item.title ?? "Unknown product",
    category: inferCategory(item),
    barcode,
    image_url: item.images?.[0],
    attributes: {
      manufacturer: item.manufacturer ?? item.brand,
      ...(item.description ? { description: item.description.slice(0, 500) } : {}),
      ...(item.model ? { model: item.model } : {}),
    },
    external_ids: {
      upc: barcode,
      ...(item.asin ? { amazon_asin: item.asin } : {}),
    },
  };
}

async function lookupOpenFoodFacts(barcode: string): Promise<CatalogRecord | null> {
  try {
    const res = await fetch(`${OFF_BASE}/product/${encodeURIComponent(barcode)}.json`, {
      headers: { "User-Agent": "Afterroar POS/1.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OffProduct;
    if (data.status !== 1 || !data.product?.product_name) return null;
    return {
      external_id: `off:${barcode}`,
      name: data.product.product_name,
      category: "food_drink",
      barcode,
      image_url: data.product.image_url,
      attributes: {
        manufacturer: data.product.brands,
        size: data.product.quantity,
        allergens: data.product.allergens_tags?.map((a) => a.replace(/^en:/, "")),
      },
      external_ids: { upc: barcode, openfoodfacts: barcode },
    };
  } catch {
    return null;
  }
}

export const upcdbAdapter: CatalogAdapter = {
  id: "upcdb",

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      // Use a known UPC for the test ping (a Coca-Cola can — universally indexed).
      const res = await fetch(`${UPCITEMDB_BASE}/lookup?upc=049000000443`);
      const latency = Date.now() - start;
      if (!res.ok) {
        if (res.status === 429) {
          return { status: "degraded", latency_ms: latency, error: "Rate-limited (free tier)" };
        }
        return { status: "down", latency_ms: latency, error: `HTTP ${res.status}` };
      }
      return { status: "ok", latency_ms: latency };
    } catch (err) {
      return { status: "down", latency_ms: Date.now() - start, error: errMsg(err) };
    }
  },

  // No general search — barcode lookup only. Search returns empty.
  async search(): Promise<CatalogSearchResult[]> {
    return [];
  },

  async lookup(barcode) {
    const cleaned = barcode.replace(/[-\s]/g, "");
    if (!/^\d{8,14}$/.test(cleaned)) return null;

    // Try UPCitemdb first (broader catalog).
    try {
      const res = await fetch(`${UPCITEMDB_BASE}/lookup?upc=${encodeURIComponent(cleaned)}`);
      if (res.ok) {
        const data = (await res.json()) as UpcItemDbResponse;
        if (data.items && data.items.length > 0 && data.items[0]) {
          return mapUpcItem(data.items[0]);
        }
      }
    } catch {
      // fall through to OFF
    }

    // Fall back to Open Food Facts (only matches if it's food).
    return lookupOpenFoodFacts(cleaned);
  },
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
