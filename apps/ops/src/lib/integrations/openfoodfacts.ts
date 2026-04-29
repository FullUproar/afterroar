/**
 * Open Food Facts adapter — packaged retail (drinks, snacks, candy).
 *
 * Public, no API key. The community catalog has detailed nutrition,
 * allergens, ingredients, and barcodes for millions of consumer-packaged
 * goods. We use it for the food_drink category — the cafe shelf and
 * impulse-buy snacks at the register.
 *
 * Two endpoints:
 *   - Search:  https://search.openfoodfacts.org/search?q=...&page_size=N
 *   - Lookup:  https://world.openfoodfacts.org/api/v2/product/{barcode}.json
 *
 * Note: this overlaps with the UPCitemdb fallback (`upcdb.ts`), which
 * already does barcode lookups including OFF as a final fall-through.
 * The dedicated adapter is additive because:
 *   - It surfaces OFF as its own integration in the dashboard (independent
 *     status pill — degradation visible separately from UPCitemdb).
 *   - It supports text search (UPCitemdb is barcode-only).
 *   - It returns richer fields (allergens, nutrition grade, ingredients).
 *
 * OFF asks API consumers to send a User-Agent. We send "Afterroar POS/1.0".
 */

import type { CatalogAdapter, CatalogRecord, CatalogSearchResult, ConnectionTestResult } from "./types";

const SEARCH_BASE = "https://search.openfoodfacts.org";
const PRODUCT_BASE = "https://world.openfoodfacts.org/api/v2";
const UA = { "User-Agent": "Afterroar POS/1.0" };

interface OffSearchHit {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string[] | string;
  quantity?: string;
  image_url?: string;
  image_front_url?: string;
  categories_tags?: string[];
  ingredients_tags?: string[];
  allergens_tags?: string[];
  nutrition_grades?: string;
}

interface OffSearchResponse {
  hits?: OffSearchHit[];
  count?: number;
}

interface OffLookupResponse {
  status?: number;
  product?: OffProduct;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  quantity?: string;
  image_url?: string;
  image_front_url?: string;
  categories_tags?: string[];
  ingredients_tags?: string[];
  allergens_tags?: string[];
  nutrition_grades?: string;
  nutriments?: Record<string, unknown>;
  nova_group?: number;
  serving_size?: string;
}

function brandString(brands: string[] | string | undefined): string | undefined {
  if (!brands) return undefined;
  if (Array.isArray(brands)) return brands.length > 0 ? brands[0] : undefined;
  return brands;
}

function bestImage(p: { image_url?: string; image_front_url?: string }): string | undefined {
  return p.image_front_url ?? p.image_url;
}

function tagList(tags?: string[]): string[] | undefined {
  if (!tags || tags.length === 0) return undefined;
  return tags.map((t) => t.replace(/^[a-z]{2}:/i, "").replace(/-/g, " "));
}

function inferSubcategory(categories?: string[]): string | undefined {
  if (!categories || categories.length === 0) return undefined;
  const joined = categories.join(" ").toLowerCase();
  if (/energy-drink/.test(joined)) return "energy";
  if (/alcohol|beer|wine|spirit/.test(joined)) return "alcohol";
  if (/candy|sweet|chocolate/.test(joined)) return "candy";
  if (/snack|chip|crisp/.test(joined)) return "snack";
  if (/drink|beverage|water|juice|soda/.test(joined)) return "drink";
  return undefined;
}

function isAgeRestricted(categories?: string[]): boolean {
  if (!categories) return false;
  return categories.some((c) => /alcohol|beer|wine|spirit|tobacco|nicotine|cigar/.test(c.toLowerCase()));
}

function mapHit(hit: OffSearchHit): CatalogSearchResult {
  const code = hit.code ?? "";
  const name = hit.product_name_en ?? hit.product_name ?? `Product ${code}`;
  const brand = brandString(hit.brands);
  return {
    external_id: code,
    title: name,
    subtitle: brand ? `${brand}${hit.quantity ? ` · ${hit.quantity}` : ""}` : hit.quantity,
    image_url: bestImage(hit),
  };
}

function mapProduct(p: OffProduct): CatalogRecord {
  const code = p.code ?? "";
  const name = p.product_name_en ?? p.product_name ?? `Product ${code}`;
  const subcategory = inferSubcategory(p.categories_tags);
  const allergens = tagList(p.allergens_tags);
  const ingredients = tagList(p.ingredients_tags);

  return {
    external_id: code,
    name,
    category: "food_drink",
    barcode: code || undefined,
    image_url: bestImage(p),
    attributes: {
      manufacturer: p.brands,
      size: p.quantity,
      serving_size: p.serving_size,
      ...(subcategory ? { subcategory } : {}),
      ...(allergens && allergens.length > 0 ? { allergens } : {}),
      ...(ingredients && ingredients.length > 0
        ? { ingredients: ingredients.slice(0, 30) }
        : {}),
      ...(p.nutrition_grades ? { nutrition_grade: p.nutrition_grades } : {}),
      ...(typeof p.nova_group === "number" ? { nova_group: p.nova_group } : {}),
      ...(p.nutriments ? { nutriments: p.nutriments } : {}),
      age_restricted: isAgeRestricted(p.categories_tags),
    },
    external_ids: {
      upc: code,
      openfoodfacts: code,
    },
  };
}

export const openFoodFactsAdapter: CatalogAdapter = {
  id: "openfoodfacts",

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      // Use a known stable code (Coca-Cola US 12oz can) so the ping is cheap.
      const res = await fetch(`${PRODUCT_BASE}/product/049000000443.json?fields=code,product_name`, {
        headers: UA,
      });
      const latency = Date.now() - start;
      if (!res.ok) {
        return { status: "down", latency_ms: latency, error: `HTTP ${res.status}` };
      }
      // Verify the search endpoint is also up — degraded if only one half works.
      try {
        const sr = await fetch(`${SEARCH_BASE}/search?q=cola&page_size=1`, { headers: UA });
        if (!sr.ok) {
          return {
            status: "degraded",
            latency_ms: latency,
            error: "Lookup OK, search endpoint returning errors",
          };
        }
      } catch {
        return {
          status: "degraded",
          latency_ms: latency,
          error: "Lookup OK, search endpoint unreachable",
        };
      }
      return { status: "ok", latency_ms: latency };
    } catch (err) {
      return { status: "down", latency_ms: Date.now() - start, error: errMsg(err) };
    }
  },

  async search(query, opts): Promise<CatalogSearchResult[]> {
    const limit = opts?.limit ?? 12;
    const url = new URL(`${SEARCH_BASE}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("page_size", String(limit));
    try {
      const res = await fetch(url.toString(), { headers: UA });
      if (!res.ok) return [];
      const data = (await res.json()) as OffSearchResponse;
      const hits = (data.hits ?? []).filter((h) => h.code && (h.product_name || h.product_name_en));
      return hits.slice(0, limit).map(mapHit);
    } catch {
      return [];
    }
  },

  async lookup(barcode): Promise<CatalogRecord | null> {
    const cleaned = barcode.replace(/[-\s]/g, "");
    if (!/^\d{8,14}$/.test(cleaned)) return null;
    try {
      const res = await fetch(
        `${PRODUCT_BASE}/product/${encodeURIComponent(cleaned)}.json`,
        { headers: UA },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as OffLookupResponse;
      if (data.status !== 1 || !data.product) return null;
      return mapProduct(data.product);
    } catch {
      return null;
    }
  },
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
