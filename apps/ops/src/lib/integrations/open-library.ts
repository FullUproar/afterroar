/**
 * Open Library adapter.
 * Docs: https://openlibrary.org/developers/api
 *
 * Free, no auth, no rate-limit registration. Lookup by ISBN works for any
 * ISBN-13 barcode — useful for graphic novel TPBs, RPG books, and anything
 * with an ISBN. Search is broad enough for fuzzy lookup.
 */

import type { CatalogAdapter, CatalogRecord, CatalogSearchResult, ConnectionTestResult } from "./types";

const BASE = "https://openlibrary.org";

interface OpenLibraryDoc {
  key: string;
  title: string;
  subtitle?: string;
  author_name?: string[];
  publisher?: string[];
  publish_year?: number[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  language?: string[];
  subject?: string[];
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibraryDoc[];
  numFound?: number;
}

interface OpenLibraryBookData {
  title?: string;
  subtitle?: string;
  authors?: Array<{ key?: string; name?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  number_of_pages?: number;
  cover?: { large?: string; medium?: string; small?: string };
  identifiers?: { isbn_13?: string[]; isbn_10?: string[] };
  subjects?: Array<{ name?: string }>;
}

function inferCategory(doc: OpenLibraryDoc | OpenLibraryBookData): string {
  const subjectsArr =
    (doc as OpenLibraryDoc).subject ??
    (doc as OpenLibraryBookData).subjects?.map((s) => s.name).filter((s): s is string => !!s) ??
    [];
  const subjectsLower = subjectsArr.map((s) => s.toLowerCase());

  const isComic = subjectsLower.some((s) => /\b(comic|graphic novel|manga)\b/.test(s));
  if (isComic) return "comic";

  const isRPG = subjectsLower.some((s) => /\brole.?playing|tabletop rpg|dungeons|pathfinder\b/.test(s));
  if (isRPG) return "rpg";

  return "other";
}

function coverUrlFromDoc(doc: OpenLibraryDoc): string | undefined {
  if (!doc.cover_i) return undefined;
  return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
}

function mapSearchDoc(doc: OpenLibraryDoc): CatalogRecord {
  const isbn13 = doc.isbn?.find((i) => i.length === 13);
  const isbn10 = doc.isbn?.find((i) => i.length === 10);
  const category = inferCategory(doc);
  return {
    external_id: doc.key,
    name: doc.subtitle ? `${doc.title}: ${doc.subtitle}` : doc.title,
    category,
    barcode: isbn13,
    image_url: coverUrlFromDoc(doc),
    attributes: {
      author: doc.author_name?.join(", "),
      publisher: doc.publisher?.[0],
      release_year: doc.first_publish_year ?? doc.publish_year?.[0],
      isbn: isbn13 ?? isbn10,
      page_count: doc.number_of_pages_median,
      language: doc.language?.[0],
      ...(category === "rpg" ? { book_type: "supplement" } : {}),
      ...(category === "comic" ? { book_type: "trade_paperback" } : {}),
    },
    external_ids: {
      open_library: doc.key,
      ...(isbn13 ? { isbn13 } : {}),
      ...(isbn10 ? { isbn10 } : {}),
    },
  };
}

function mapBookByIsbn(isbn: string, data: OpenLibraryBookData): CatalogRecord {
  const category = inferCategory(data);
  return {
    external_id: `isbn:${isbn}`,
    name: data.subtitle ? `${data.title ?? ""}: ${data.subtitle}` : data.title ?? "Unknown",
    category,
    barcode: isbn,
    image_url: data.cover?.large ?? data.cover?.medium ?? data.cover?.small,
    attributes: {
      author: data.authors?.map((a) => a.name).filter(Boolean).join(", "),
      publisher: data.publishers?.[0]?.name,
      release_year: data.publish_date ? parseInt(data.publish_date.slice(-4)) || undefined : undefined,
      isbn,
      page_count: data.number_of_pages,
      ...(category === "rpg" ? { book_type: "supplement" } : {}),
      ...(category === "comic" ? { book_type: "trade_paperback" } : {}),
    },
    external_ids: {
      isbn13: isbn.length === 13 ? isbn : "",
      isbn10: isbn.length === 10 ? isbn : "",
    },
  };
}

export const openLibraryAdapter: CatalogAdapter = {
  id: "openlibrary",

  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}/search.json?q=harry+potter&limit=1`, {
        headers: { "User-Agent": "Afterroar POS/1.0 (afterroar.store)" },
      });
      const latency = Date.now() - start;
      if (!res.ok) {
        return { status: "down", latency_ms: latency, error: `HTTP ${res.status}` };
      }
      return { status: "ok", latency_ms: latency };
    } catch (err) {
      return { status: "down", latency_ms: Date.now() - start, error: errMsg(err) };
    }
  },

  async search(query, opts) {
    const limit = Math.min(20, opts?.limit ?? 10);
    const url = `${BASE}/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Afterroar POS/1.0 (afterroar.store)" },
    });
    if (!res.ok) throw new Error(`Open Library search failed: HTTP ${res.status}`);
    const data = (await res.json()) as OpenLibrarySearchResponse;
    return (data.docs ?? []).map<CatalogSearchResult>((d) => ({
      external_id: d.key,
      title: d.title,
      subtitle: [d.author_name?.[0], d.first_publish_year].filter(Boolean).join(" · ") || undefined,
      image_url: coverUrlFromDoc(d),
      preview: mapSearchDoc(d),
    }));
  },

  /** Open Library lookup is by ISBN. The id-string can be a raw ISBN or a path
   *  like "isbn:9781234567890". */
  async lookup(idOrBarcode) {
    const isbn = idOrBarcode.replace(/^isbn:/, "").replace(/[-\s]/g, "");
    if (!/^\d{10}(\d{3})?$/.test(isbn)) return null;
    const res = await fetch(
      `${BASE}/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      { headers: { "User-Agent": "Afterroar POS/1.0 (afterroar.store)" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, OpenLibraryBookData>;
    const book = data[`ISBN:${isbn}`];
    if (!book) return null;
    return mapBookByIsbn(isbn, book);
  },
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
