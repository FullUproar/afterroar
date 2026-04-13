import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/library/expansions?bggId=13
 *
 * Fetches expansion list for a base game from BGG.
 * Returns expansion titles and BGG IDs.
 */
export async function GET(request: NextRequest) {
  const bggId = request.nextUrl.searchParams.get('bggId');
  if (!bggId) return NextResponse.json({ error: 'bggId required' }, { status: 400 });

  const bggToken = process.env.BGG_API_TOKEN;
  const headers: Record<string, string> = {};
  if (bggToken) headers['Authorization'] = `Bearer ${bggToken}`;

  try {
    const res = await fetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&type=boardgame`,
      { headers, signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) return NextResponse.json({ expansions: [] });

    const xml = await res.text();
    const expansions: Array<{ title: string; bggId: number }> = [];

    const matches = xml.matchAll(/link type="boardgameexpansion" id="(\d+)" value="([^"]+)"/g);
    for (const match of matches) {
      expansions.push({
        bggId: parseInt(match[1]),
        title: match[2]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"'),
      });
    }

    // Sort alphabetically, limit to 50
    expansions.sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({
      bggId: parseInt(bggId),
      expansions: expansions.slice(0, 50),
      total: expansions.length,
    }, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return NextResponse.json({ expansions: [] });
  }
}
