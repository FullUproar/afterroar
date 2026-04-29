/**
 * MusicBrainz adapter — backup music metadata source.
 *
 * **Future-vertical scaffold.** Same future-vertical reasoning as Discogs:
 * not used by FLGS today, but landed early so the registry pattern
 * proves it handles vinyl/record-store inventory cleanly. MusicBrainz
 * is the open-data fallback if Discogs is degraded — it has UPC indexing
 * for a smaller but well-curated catalog.
 *
 * Auth model: anonymous, no key. Strict rate limit of 1 req/sec per
 * host — we send a User-Agent so MB can identify us if we hit them too
 * fast. The dashboard's "Test all" already serializes calls so we won't
 * blow this in practice.
 *
 * Docs: https://musicbrainz.org/doc/MusicBrainz_API
 */

import type { CatalogAdapter, CatalogRecord, CatalogSearchResult, ConnectionTestResult } from "./types";

const BASE = "https://musicbrainz.org/ws/2";
const UA = { "User-Agent": "Afterroar POS/1.0 (https://afterroar.store)", Accept: "application/json" };

interface MbArtistCredit {
  name?: string;
  artist?: { id?: string; name?: string };
}

interface MbReleaseSearchHit {
  id?: string;
  title?: string;
  date?: string;
  country?: string;
  packaging?: string;
  status?: string;
  "artist-credit"?: MbArtistCredit[];
  barcode?: string;
  "release-events"?: Array<{ date?: string; area?: { name?: string } }>;
}

interface MbReleaseSearchResponse {
  releases?: MbReleaseSearchHit[];
  count?: number;
}

interface MbRelease extends MbReleaseSearchHit {
  asin?: string;
  "label-info"?: Array<{
    "catalog-number"?: string;
    label?: { id?: string; name?: string };
  }>;
  media?: Array<{ format?: string; "track-count"?: number; tracks?: Array<{ title?: string }> }>;
  genres?: Array<{ name?: string; count?: number }>;
}

function bestArtist(hit: MbReleaseSearchHit): string | undefined {
  const credits = hit["artist-credit"];
  if (!credits || credits.length === 0) return undefined;
  return credits.map((c) => c.artist?.name ?? c.name).filter(Boolean).join(", ");
}

function mapSearchHit(hit: MbReleaseSearchHit): CatalogSearchResult {
  const id = hit.id ?? "";
  const artist = bestArtist(hit);
  const title = hit.title ?? "Untitled";
  const subtitle = [artist, hit.date, hit.country].filter(Boolean).join(" · ");
  return {
    external_id: id,
    title: artist ? `${artist} — ${title}` : title,
    subtitle: subtitle || undefined,
  };
}

function mapRelease(r: MbRelease): CatalogRecord {
  const id = r.id ?? "";
  const artist = bestArtist(r);
  const labelInfo = r["label-info"]?.[0];
  const formats = r.media?.map((m) => m.format).filter((x): x is string => Boolean(x));
  const trackCount = r.media?.reduce((sum, m) => sum + (m["track-count"] ?? 0), 0);
  const genres = r.genres?.filter((g) => (g.count ?? 0) > 0).map((g) => g.name).filter(Boolean);

  return {
    external_id: id,
    name: artist ? `${artist} — ${r.title ?? "Untitled"}` : r.title ?? `Release ${id}`,
    category: "vinyl",
    barcode: r.barcode || undefined,
    attributes: {
      ...(artist ? { artist } : {}),
      ...(labelInfo?.label?.name ? { label: labelInfo.label.name } : {}),
      ...(labelInfo?.["catalog-number"] ? { catalog_no: labelInfo["catalog-number"] } : {}),
      ...(r.date ? { release_date: r.date } : {}),
      ...(r.country ? { country: r.country } : {}),
      ...(r.status ? { status: r.status } : {}),
      ...(r.packaging ? { packaging: r.packaging } : {}),
      ...(formats && formats.length > 0 ? { formats } : {}),
      ...(trackCount ? { track_count: trackCount } : {}),
      ...(genres && genres.length > 0 ? { genres } : {}),
    },
    external_ids: {
      musicbrainz: id,
      ...(r.barcode ? { upc: r.barcode } : {}),
      ...(r.asin ? { amazon_asin: r.asin } : {}),
    },
  };
}

export const musicBrainzAdapter: CatalogAdapter = {
  id: "musicbrainz",

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}/release/?query=ramones&fmt=json&limit=1`, { headers: UA });
      const latency = Date.now() - start;
      if (!res.ok) {
        if (res.status === 503) {
          return { status: "degraded", latency_ms: latency, error: "Rate-limited (1 req/sec)" };
        }
        return { status: "down", latency_ms: latency, error: `HTTP ${res.status}` };
      }
      return { status: "ok", latency_ms: latency };
    } catch (err) {
      return { status: "down", latency_ms: Date.now() - start, error: errMsg(err) };
    }
  },

  async search(query, opts): Promise<CatalogSearchResult[]> {
    const limit = opts?.limit ?? 10;
    const url = new URL(`${BASE}/release/`);
    url.searchParams.set("query", query);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", String(limit));
    try {
      const res = await fetch(url.toString(), { headers: UA });
      if (!res.ok) return [];
      const data = (await res.json()) as MbReleaseSearchResponse;
      return (data.releases ?? []).slice(0, limit).map(mapSearchHit);
    } catch {
      return [];
    }
  },

  async lookup(idOrBarcode): Promise<CatalogRecord | null> {
    const trimmed = idOrBarcode.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

    if (isUuid) {
      try {
        const url = new URL(`${BASE}/release/${trimmed}`);
        url.searchParams.set("fmt", "json");
        url.searchParams.set("inc", "artist-credits+labels+release-groups+media+genres");
        const res = await fetch(url.toString(), { headers: UA });
        if (!res.ok) return null;
        const data = (await res.json()) as MbRelease;
        return mapRelease(data);
      } catch {
        return null;
      }
    }

    // Barcode path: query by `barcode:` lucene field, then fetch the first hit.
    const cleaned = trimmed.replace(/[-\s]/g, "");
    if (/^\d{8,14}$/.test(cleaned)) {
      try {
        const url = new URL(`${BASE}/release/`);
        url.searchParams.set("query", `barcode:${cleaned}`);
        url.searchParams.set("fmt", "json");
        url.searchParams.set("limit", "1");
        const sr = await fetch(url.toString(), { headers: UA });
        if (!sr.ok) return null;
        const search = (await sr.json()) as MbReleaseSearchResponse;
        const first = search.releases?.[0];
        if (!first?.id) return null;
        return this.lookup ? this.lookup(first.id) : null;
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
