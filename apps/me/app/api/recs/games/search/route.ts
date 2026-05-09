/**
 * GET /api/recs/games/search?q=catan&limit=10
 *
 * Substring-matches the seidr corpus by game name. Used by the quiz UI
 * to let a user attach feedback signals (loved / owned / tried_disliked)
 * to games not currently in their rec list — "I love a game that's not
 * here" → search → click → signal saved.
 *
 * Anonymous-friendly. No PII in the request, no mutation, the corpus is
 * public-shippable data anyway.
 *
 * Returns games sorted by:
 *   1. Exact name match first
 *   2. Prefix match second
 *   3. Substring match last
 *   4. Within each tier, alphabetical
 */

import { NextRequest, NextResponse } from 'next/server';
import gameMeta from '@/lib/heimdall/game-meta.json';

interface MetaEntry {
  name: string;
  year?: number | null;
  subdomain?: string | null;
}

const MAX_LIMIT = 25;
const MIN_QUERY_LEN = 2;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const rawLimit = Number(url.searchParams.get('limit'));
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= MAX_LIMIT ? rawLimit : 10;

  if (q.length < MIN_QUERY_LEN) {
    return NextResponse.json({ matches: [], note: 'query too short' });
  }

  const meta = gameMeta as Record<string, MetaEntry>;
  type Hit = { game_id: number; name: string; year: number | null; subdomain: string | null; rank: 0 | 1 | 2 };
  const hits: Hit[] = [];

  for (const [idStr, m] of Object.entries(meta)) {
    if (!m?.name) continue;
    const lower = m.name.toLowerCase();
    let rank: 0 | 1 | 2 | -1 = -1;
    if (lower === q) rank = 0;
    else if (lower.startsWith(q)) rank = 1;
    else if (lower.includes(q)) rank = 2;
    if (rank === -1) continue;
    hits.push({
      game_id: Number(idStr),
      name: m.name,
      year: typeof m.year === 'number' ? m.year : null,
      subdomain: m.subdomain ?? null,
      rank,
    });
  }

  hits.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({
    matches: hits.slice(0, limit).map(({ rank: _rank, ...rest }) => rest),
  });
}
