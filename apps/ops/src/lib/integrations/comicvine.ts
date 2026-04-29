/**
 * ComicVine adapter.
 * Docs: https://comicvine.gamespot.com/api/documentation
 *
 * Free tier with API key; rate-limited but generous for our use case.
 * Returns rich comic metadata: series, issue number, cover, creators,
 * variants, publisher.
 *
 * Required env: COMICVINE_API_KEY (sign up at https://comicvine.gamespot.com/api/)
 *
 * Note: ComicVine's API requires a User-Agent header that identifies the app —
 * they reject anonymous-looking traffic.
 */

import type { CatalogAdapter, CatalogRecord, CatalogSearchResult, ConnectionTestResult } from "./types";

const BASE = "https://comicvine.gamespot.com/api";
const USER_AGENT = "Afterroar POS (afterroar.store; identity@afterroar.store)";

interface CvImage {
  small_url?: string;
  medium_url?: string;
  thumb_url?: string;
}

interface CvIssue {
  id: number;
  api_detail_url: string;
  name?: string | null;
  issue_number?: string;
  cover_date?: string;
  store_date?: string;
  description?: string;
  image?: CvImage;
  volume?: { id: number; name: string; api_detail_url: string };
  person_credits?: Array<{ id: number; name: string; role: string }>;
  associated_images?: Array<CvImage & { id: number }>;
  variant_cover?: boolean;
}

function apiKey(): string | null {
  return process.env.COMICVINE_API_KEY ?? null;
}

function authQuery(extra: Record<string, string>): string {
  const params = new URLSearchParams({ format: "json", ...extra });
  const key = apiKey();
  if (key) params.set("api_key", key);
  return params.toString();
}

function isoYear(date: string | undefined): number | undefined {
  if (!date) return undefined;
  const y = parseInt(date.slice(0, 4));
  return Number.isFinite(y) ? y : undefined;
}

function mapIssue(issue: CvIssue): CatalogRecord {
  const seriesTitle = issue.volume?.name ?? "Unknown";
  const issueNumber = issue.issue_number ?? "";
  const writer = issue.person_credits?.find((p) => /writer|story/i.test(p.role))?.name;
  const coverArtist = issue.person_credits?.find((p) => /cover|artist/i.test(p.role))?.name;
  return {
    external_id: String(issue.id),
    name: issue.name
      ? `${seriesTitle} #${issueNumber}: ${issue.name}`
      : `${seriesTitle} #${issueNumber}`,
    category: "comic",
    image_url: issue.image?.medium_url ?? issue.image?.small_url ?? issue.image?.thumb_url,
    attributes: {
      series_title: seriesTitle,
      issue_number: issueNumber,
      cover_artist: coverArtist,
      writer,
      release_date: issue.store_date ?? issue.cover_date,
      release_year: isoYear(issue.store_date ?? issue.cover_date),
      is_variant_cover: !!issue.variant_cover,
      book_type: "single_issue",
    },
    external_ids: {
      comicvine: String(issue.id),
      ...(issue.volume?.id ? { comicvine_volume_id: String(issue.volume.id) } : {}),
    },
  };
}

export const comicvineAdapter: CatalogAdapter = {
  id: "comicvine",

  async testConnection(): Promise<ConnectionTestResult> {
    const key = apiKey();
    if (!key) {
      return { status: "unconfigured", error: "COMICVINE_API_KEY not set" };
    }
    const start = Date.now();
    try {
      const url = `${BASE}/issues/?${authQuery({ limit: "1", field_list: "id,name" })}`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      const latency = Date.now() - start;
      if (!res.ok) {
        return { status: "down", latency_ms: latency, error: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { status_code?: number; error?: string };
      if (data.status_code !== 1) {
        return {
          status: "degraded",
          latency_ms: latency,
          error: data.error ?? `Unexpected status_code ${data.status_code}`,
        };
      }
      return { status: "ok", latency_ms: latency };
    } catch (err) {
      return { status: "down", latency_ms: Date.now() - start, error: errMsg(err) };
    }
  },

  async search(query, opts) {
    if (!apiKey()) throw new Error("COMICVINE_API_KEY not set");
    const limit = Math.min(20, opts?.limit ?? 10);
    const url = `${BASE}/search/?${authQuery({
      query,
      resources: "issue",
      limit: String(limit),
      field_list: "id,name,issue_number,cover_date,store_date,image,volume",
    })}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`ComicVine search failed: HTTP ${res.status}`);
    const data = (await res.json()) as { results?: CvIssue[] };
    return (data.results ?? []).map<CatalogSearchResult>((issue) => ({
      external_id: String(issue.id),
      title: `${issue.volume?.name ?? "?"} #${issue.issue_number ?? "?"}${issue.name ? ` — ${issue.name}` : ""}`,
      subtitle: [issue.cover_date ?? issue.store_date].filter(Boolean).join(" · "),
      image_url: issue.image?.thumb_url ?? issue.image?.small_url,
      preview: mapIssue(issue),
    }));
  },

  async lookup(id) {
    if (!apiKey()) throw new Error("COMICVINE_API_KEY not set");
    // Issue ids in ComicVine are numeric.
    const url = `${BASE}/issue/4000-${encodeURIComponent(id)}/?${authQuery({})}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: CvIssue; status_code?: number };
    if (data.status_code !== 1 || !data.results) return null;
    return mapIssue(data.results);
  },
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
