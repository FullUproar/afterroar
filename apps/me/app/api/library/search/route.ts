import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/library/search?q=catan
 *
 * Searches the BoardGameMetadata table (BGG synced data) for games.
 * Used by the library editor's search bar.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Search BoardGameMetadata if it exists, otherwise return empty
    const results = await prisma.$queryRawUnsafe<Array<{
      title: string;
      slug: string;
      minPlayers: number | null;
      maxPlayers: number | null;
      complexity: number | null;
    }>>(
      `SELECT title, slug, "minPlayers", "maxPlayers", complexity
       FROM "BoardGameMetadata"
       WHERE title ILIKE $1
       ORDER BY "bggRating" DESC NULLS LAST
       LIMIT 15`,
      `%${query}%`,
    );

    return NextResponse.json({
      results: results.map((r) => ({
        title: r.title,
        slug: r.slug,
        minPlayers: r.minPlayers,
        maxPlayers: r.maxPlayers,
        complexity: r.complexity,
      })),
    });
  } catch {
    // Table might not exist in this schema view — return empty
    return NextResponse.json({ results: [] });
  }
}
