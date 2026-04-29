/**
 * Discogs adapter — vinyl + physical music catalog.
 *
 * **Future-vertical scaffold.** Per the data integrations strategy doc,
 * Discogs is the canonical metadata source for record stores. We're not
 * a record-store vertical today, but the registry pattern lets us land
 * the adapter early so it's ready when/if a record-store-vertical pilot
 * happens. The integrations dashboard surfaces this as inactive until
 * the `vinyl` category is added.
 *
 * Auth model: Discogs allows anonymous search at 25 req/min. With a
 * token (free, set via DISCOGS_TOKEN env) the limit is 60 req/min.
 * The adapter sends the token if present, otherwise hits the public tier.
 *
 * Discogs API requires User-Agent (else 403). We send "Afterroar POS/1.0".
 */

import type { CatalogAdapter, CatalogRecord, CatalogSearchResult, ConnectionTestResult } from "./types";

const BASE = "https://api.discogs.com";

interface DiscogsArtistRef {
  name?: string;
  anv?: string; // artist name variation
  id?: number;
}

interface DiscogsImage {
  type?: string;
  resource_url?: string;
  uri?: string;
  uri150?: string;
}

interface DiscogsSearchResult {
  id?: number;
  type?: string;
  title?: string;
  year?: string | number;
  country?: string;
  format?: string[];
  label?: string[];
  thumb?: string;
  cover_image?: string;
  barcode?: string[];
}

interface DiscogsSearchResponse {
  results?: DiscogsSearchResult[];
}

interface DiscogsRelease {
  id?: number;
  title?: string;
  artists?: DiscogsArtistRef[];
  artists_sort?: string;
  year?: number;
  released?: string;
  country?: string;
  formats?: Array<{ name?: string; descriptions?: string[]; qty?: string }>;
  labels?: Array<{ name?: string; catno?: string }>;
  genres?: string[];
  styles?: string[];
  identifiers?: Array<{ type?: string; value?: string; description?: string }>;
  images?: DiscogsImage[];
  thumb?: string;
  master_id?: number;
}

function token(): string | undefined {
  return process.env.DISCOGS_TOKEN || undefined;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": "Afterroar POS/1.0" };
  const t = token();
  if (t) headers["Authorization"] = `Discogs token=${t}`;
  return headers;
}

function bestArtist(release: DiscogsRelease): string | undefined {
  if (release.artists_sort) return release.artists_sort;
  if (release.artists && release.artists.length > 0) {
    const a = release.artists[0];
    return a?.name ?? a?.anv;
  }
  return undefined;
}

function pickBarcode(identifiers?: Array<{ type?: string; value?: string }>): string | undefined {
  if (!identifiers) return undefined;
  const found = identifiers.find(
    (i) => i.type?.toLowerCase() === "barcode" && i.value && /^\d{8,14}$/.test(i.value.replace(/\s/g, "")),
  );
  return found?.value?.replace(/\s/g, "");
}

function mapSearchHit(r: DiscogsSearchResult): CatalogSearchResult {
  const id = r.id != null ? String(r.id) : "";
  const title = r.title ?? `Release ${id}`;
  const subtitle = [
    r.year != null ? String(r.year) : undefined,
    r.format?.join(", "),
    r.label?.[0],
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    external_id: id,
    title,
    subtitle: subtitle || undefined,
    image_url: r.cover_image ?? r.thumb,
  };
}

function mapRelease(r: DiscogsRelease): CatalogRecord {
  const id = r.id != null ? String(r.id) : "";
  const artist = bestArtist(r);
  const barcode = pickBarcode(r.identifiers);
  const formatNames = r.formats?.map((f) => f.name).filter((x): x is string => Boolean(x));
  const formatDescriptions = r.formats?.flatMap((f) => f.descriptions ?? []);
  const label = r.labels?.[0];

  return {
    external_id: id,
    name: artist ? `${artist} — ${r.title ?? "Untitled"}` : r.title ?? `Release ${id}`,
    category: "vinyl", // future-vertical category
    barcode,
    image_url: r.images?.[0]?.uri ?? r.thumb,
    attributes: {
      ...(artist ? { artist } : {}),
      ...(label?.name ? { label: label.name } : {}),
      ...(label?.catno ? { catalog_no: label.catno } : {}),
      ...(r.year ? { year: r.year } : {}),
      ...(r.country ? { country: r.country } : {}),
      ...(formatNames && formatNames.length > 0 ? { formats: formatNames } : {}),
      ...(formatDescriptions && formatDescriptions.length > 0
        ? { format_descriptions: formatDescriptions }
        : {}),
      ...(r.genres && r.genres.length > 0 ? { genres: r.genres } : {}),
      ...(r.styles && r.styles.length > 0 ? { styles: r.styles } : {}),
    },
    external_ids: {
      discogs: id,
      ...(r.master_id != null ? { discogs_master: String(r.master_id) } : {}),
      ...(barcode ? { upc: barcode } : {}),
    },
  };
}

export const discogsAdapter: CatalogAdapter = {
  id: "discogs",

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      // Cheap server status ping.
      const res = await fetch(`${BASE}/`, { headers: authHeaders() });
      const latency = Date.now() - start;
      if (!res.ok) {
        if (res.status === 429) {
          return { status: "degraded", latency_ms: latency, error: "Rate-limited" };
        }
        return { status: "down", latency_ms: latency, error: `HTTP ${res.status}` };
      }
      const remaining = res.headers.get("x-discogs-ratelimit-remaining");
      const limit = res.headers.get("x-discogs-ratelimit");
      return {
        status: "ok",
        latency_ms: latency,
        ...(remaining && limit
          ? {
              rate_limit: {
                limit: parseInt(limit, 10),
                remaining: parseInt(remaining, 10),
              },
            }
          : {}),
      };
    } catch (err) {
      return { status: "down", latency_ms: Date.now() - start, error: errMsg(err) };
    }
  },

  async search(query, opts): Promise<CatalogSearchResult[]> {
    const limit = opts?.limit ?? 10;
    const url = new URL(`${BASE}/database/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("type", "release");
    url.searchParams.set("per_page", String(limit));
    try {
      const res = await fetch(url.toString(), { headers: authHeaders() });
      if (!res.ok) return [];
      const data = (await res.json()) as DiscogsSearchResponse;
      const results = data.results ?? [];
      return results.slice(0, limit).map(mapSearchHit);
    } catch {
      return [];
    }
  },

  async lookup(idOrBarcode): Promise<CatalogRecord | null> {
    const trimmed = idOrBarcode.trim();
    // Numeric Discogs id path
    if (/^\d+$/.test(trimmed)) {
      try {
        const res = await fetch(`${BASE}/releases/${trimmed}`, { headers: authHeaders() });
        if (!res.ok) return null;
        const data = (await res.json()) as DiscogsRelease;
        return mapRelease(data);
      } catch {
        return null;
      }
    }
    // Barcode path: search by barcode, then fetch the first hit's release.
    const cleanedBarcode = trimmed.replace(/[-\s]/g, "");
    if (/^\d{8,14}$/.test(cleanedBarcode)) {
      try {
        const url = new URL(`${BASE}/database/search`);
        url.searchParams.set("barcode", cleanedBarcode);
        url.searchParams.set("type", "release");
        url.searchParams.set("per_page", "1");
        const sr = await fetch(url.toString(), { headers: authHeaders() });
        if (!sr.ok) return null;
        const search = (await sr.json()) as DiscogsSearchResponse;
        const first = search.results?.[0];
        if (!first?.id) return null;
        const res = await fetch(`${BASE}/releases/${first.id}`, { headers: authHeaders() });
        if (!res.ok) return null;
        const data = (await res.json()) as DiscogsRelease;
        return mapRelease(data);
      } catch {
        return null;
      }
    }
    return null;
  },
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
