import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/library/search?q=catan
 *
 * Searches BoardGameGeek's public XML API for board games matching the
 * query. Returns up to 15 results in the shape the library editor expects.
 *
 * Background: this endpoint previously queried a `BoardGameMetadata`
 * table that lived on the FU side of the platform's database. After the
 * 2026-04-27 schema split, apps/me sits on afterroar-pos-prod which
 * doesn't have that table. The previous implementation silently caught
 * the "table doesn't exist" error and returned `{ results: [] }`, which
 * presented as a "borked" search to users. This rewrite removes the
 * cross-DB dependency entirely by going to BGG directly.
 *
 * Trade-offs:
 *   - BGG is single-source-of-truth for board games. Always fresh.
 *   - Latency is BGG's network round-trip (~200-800ms typical). Slower
 *     than a local DB query but fine for user-driven search.
 *   - BGG asks for ~1 req/sec rate limit. User-driven search is well
 *     within that. We don't pre-fetch or batch.
 *   - We return title + slug (= bgg:N). minPlayers / maxPlayers /
 *     complexity would require a second BGG /thing call per result;
 *     skipping for snappiness. Library editor handles them as undefined.
 *
 * BGG XML API:
 *   GET https://boardgamegeek.com/xmlapi2/search?query={Q}&type=boardgame
 *   Response: XML with <item id="N" type="boardgame"><name value="..."/></item>
 *
 * Auth: BGG started requiring Bearer auth on their XML API in 2026. Token
 * lives in BGG_API_TOKEN env var (already configured in Vercel for the
 * /api/cron/bgg-refresh job; we share the same token here).
 *
 * Cached 60s at the framework level — BGG content rarely changes, users
 * often retry the same query, and caching protects us if BGG is briefly slow.
 */

const BGG_SEARCH_URL = 'https://boardgamegeek.com/xmlapi2/search';

export const revalidate = 60;

interface SearchResult {
  title: string;
  slug: string;
  minPlayers?: number;
  maxPlayers?: number;
  complexity?: number;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number.parseInt(n, 10)));
}

function relevanceScore(title: string, query: string): number {
  const t = title.toLowerCase();
  const q = query.toLowerCase().trim();
  if (t === q) return 0;                               // exact match
  if (t.startsWith(q + ' ')) return 1;                 // "Catan (1995)" beats "Catan: Cities..."
  if (t.startsWith(q)) return 2;                       // "Catan: Cities & Knights"
  // De-prioritize fan expansions, alternate editions, and sub-titled forks
  // — anything where the query appears mid-title or in parentheses.
  if (/\bfan expansion\b/i.test(title)) return 50;
  if (/\(.*\)/.test(title)) return 40;
  if (t.includes(q)) return 10;
  return 20;
}

function parseSearchXml(xml: string, query: string): SearchResult[] {
  // BGG response is simple enough for regex extraction. Each result is:
  //   <item type="boardgame" id="13">
  //     <name type="primary" value="Catan"/>
  //     <yearpublished value="1995"/>
  //   </item>
  // We capture id + the primary name (BGG sometimes lists multiple
  // <name> entries — one primary plus alternates). XML entities in the
  // value attribute (e.g. &amp; for &) get decoded before returning.
  const itemRegex = /<item\s+type="boardgame"\s+id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  const raw: SearchResult[] = [];
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const id = match[1];
    const inner = match[2];
    const primaryNameMatch = /<name[^>]*type="primary"[^>]*value="([^"]+)"/.exec(inner);
    const anyNameMatch = /<name[^>]*value="([^"]+)"/.exec(inner);
    const rawTitle = primaryNameMatch?.[1] ?? anyNameMatch?.[1];
    if (!id || !rawTitle) continue;
    raw.push({ title: decodeXmlEntities(rawTitle), slug: `bgg:${id}` });
  }

  // BGG returns alphabetical, so "Bards Against Humanity" beats "Cards
  // Against Humanity" without re-ranking. Sort by relevance score, ties
  // broken by title length (shorter wins — base game over expansions),
  // then alpha.
  raw.sort((a, b) => {
    const sa = relevanceScore(a.title, query);
    const sb = relevanceScore(b.title, query);
    if (sa !== sb) return sa - sb;
    if (a.title.length !== b.title.length) return a.title.length - b.title.length;
    return a.title.localeCompare(b.title);
  });

  return raw.slice(0, 15);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL(BGG_SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('type', 'boardgame');

  const headers: Record<string, string> = {
    'User-Agent': 'Afterroar Passport/1.0',
  };
  const bggToken = process.env.BGG_API_TOKEN;
  if (bggToken) headers['Authorization'] = `Bearer ${bggToken}`;

  try {
    const res = await fetch(url.toString(), {
      headers,
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { results: [], error: `BGG returned ${res.status}` },
        { status: 502 },
      );
    }
    const xml = await res.text();
    return NextResponse.json({ results: parseSearchXml(xml, query) });
  } catch (err) {
    return NextResponse.json(
      {
        results: [],
        error: err instanceof Error ? err.message : 'BGG search failed',
      },
      { status: 502 },
    );
  }
}
