/**
 * Shared types for catalog integrations (Scryfall, BGG, ComicVine, etc.).
 *
 * Every adapter exposes the same surface — search / lookup / mapToCatalog /
 * testConnection — so the inventory edit UI and the integrations dashboard
 * can call them uniformly. Source-specific fields end up in
 * `PosCatalogProduct.attributes` and the `external_ids` map.
 */

export interface CatalogSearchResult {
  /** Source-native id (Scryfall id, BGG id, ComicVine API id, etc.). */
  external_id: string;
  /** Best display string for the result (e.g. "Black Lotus (LEA)" or "Saga #54"). */
  title: string;
  /** Optional subtitle (set name, publisher, year). */
  subtitle?: string;
  /** Optional thumbnail URL. */
  image_url?: string;
  /** Optional preview of the full mapped record so the UI can show fields
   *  before committing. */
  preview?: Partial<CatalogRecord>;
}

export interface CatalogRecord {
  /** Source-native id. */
  external_id: string;
  /** Display name. */
  name: string;
  /** Suggested category. */
  category: string;
  /** Source-native barcode (UPC/EAN/ISBN) if present. */
  barcode?: string;
  /** Suggested SKU (often null for community sources; we mint our own). */
  sku?: string;
  /** Image URL (catalog hero image). */
  image_url?: string;
  /** Suggested retail price in cents (when source provides it). */
  msrp_cents?: number;
  /** Live secondary-market price in cents (when source provides it). */
  market_price_cents?: number;
  /** Source-mapped attributes — populates PosInventoryItem.attributes. */
  attributes: Record<string, unknown>;
  /** Cross-source identifiers; merged into PosCatalogProduct.external_ids. */
  external_ids: Record<string, string>;
}

export type ConnectionStatus = "ok" | "degraded" | "down" | "unconfigured";

export interface ConnectionTestResult {
  status: ConnectionStatus;
  /** Latency in ms for the test ping (best-effort). */
  latency_ms?: number;
  /** Truncated error message if status != ok. */
  error?: string;
  /** Optional: source-side rate limit + remaining count, if exposed. */
  rate_limit?: { limit: number; remaining: number; reset_at?: string };
}

export interface CatalogAdapter {
  id: string;
  /** Cheap reachability ping. Implementations should target a no-cost endpoint. */
  testConnection(): Promise<ConnectionTestResult>;
  /** Free-text search. Returns up to N candidates. */
  search?(query: string, opts?: { limit?: number }): Promise<CatalogSearchResult[]>;
  /** Lookup by source-native id OR barcode (when source supports it). */
  lookup?(idOrBarcode: string): Promise<CatalogRecord | null>;
}
