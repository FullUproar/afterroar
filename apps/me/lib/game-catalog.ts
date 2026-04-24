import { prisma } from './prisma';

/**
 * Shared read access to the `BoardGameMetadata` catalog.
 *
 * The table lives in full-uproar-site's Prisma schema (same DB). Here we
 * treat it as read-mostly reference data; writes are scoped to backfills
 * from BGG-live paths (e.g. library import).
 */

export interface CatalogEntry {
  bggId: number | null;
  slug: string;
  title: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  minPlayMinutes: number | null;
  maxPlayMinutes: number | null;
  complexity: number | null;
  bggRating: number | null;
  yearPublished: number | null;
  categories: string | null;
  mechanics: string | null;
}

/**
 * Fetch catalog entries for a set of games identified by either bggId or slug.
 * Returns a single merged map keyed by:
 *   - `bgg:<id>` if bggId was supplied
 *   - `slug:<slug>` if only slug was supplied
 * Caller can pick whichever key their game has.
 */
export async function getCatalogEntries(refs: Array<{ bggId?: number | null; slug?: string | null }>): Promise<Map<string, CatalogEntry>> {
  const bggIds = Array.from(new Set(refs.map((r) => r.bggId).filter((v): v is number => typeof v === 'number' && v > 0)));
  const slugs = Array.from(new Set(refs.map((r) => r.slug).filter((v): v is string => typeof v === 'string' && v.length > 0)));

  const out = new Map<string, CatalogEntry>();
  if (bggIds.length === 0 && slugs.length === 0) return out;

  try {
    type Row = {
      bggId: number | null;
      slug: string;
      title: string;
      minPlayers: number | null;
      maxPlayers: number | null;
      minPlayMinutes: number | null;
      maxPlayMinutes: number | null;
      complexity: number | null;
      bggRating: number | null;
      yearPublished: number | null;
      categories: string | null;
      mechanics: string | null;
    };

    const clauses: string[] = [];
    const params: unknown[] = [];
    if (bggIds.length > 0) {
      const placeholders = bggIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      clauses.push(`"bggId" IN (${placeholders})`);
      params.push(...bggIds);
    }
    if (slugs.length > 0) {
      const placeholders = slugs.map((_, i) => `$${params.length + i + 1}`).join(',');
      clauses.push(`slug IN (${placeholders})`);
      params.push(...slugs);
    }

    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT "bggId", slug, title,
              "minPlayers", "maxPlayers",
              "minPlayMinutes", "maxPlayMinutes",
              complexity, "bggRating", "yearPublished",
              categories, mechanics
       FROM "BoardGameMetadata"
       WHERE ${clauses.join(' OR ')}`,
      ...params,
    );

    for (const row of rows) {
      if (row.bggId != null) out.set(`bgg:${row.bggId}`, row);
      out.set(`slug:${row.slug}`, row);
    }
  } catch {
    // Catalog table may be unavailable in this DB; return empty map.
  }

  return out;
}

/**
 * Upsert a minimal set of BGG-sourced fields into the catalog.
 * Called from BGG-live paths (import) to enrich the shared catalog as users add games.
 * Silent on failure — catalog growth is a bonus, not required for correctness.
 */
export async function upsertCatalogFromBGG(game: {
  bggId: number;
  title: string;
  yearPublished?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  bggRating?: number | null;
}): Promise<void> {
  if (!game.bggId || !game.title) return;
  const slug = game.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return;

  // Only write non-null fields; don't clobber existing richer data (complexity, playtime)
  // that came from Store Ops sync or earlier BGG enrichment.
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "BoardGameMetadata" (title, slug, "minPlayers", "maxPlayers", "bggId", "bggRating", "yearPublished", "createdAt", "updatedAt")
       VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), $5, $6, $7, NOW(), NOW())
       ON CONFLICT ("bggId") DO UPDATE SET
         title = EXCLUDED.title,
         "minPlayers" = CASE WHEN "BoardGameMetadata"."minPlayers" = 0 THEN EXCLUDED."minPlayers" ELSE "BoardGameMetadata"."minPlayers" END,
         "maxPlayers" = CASE WHEN "BoardGameMetadata"."maxPlayers" = 0 THEN EXCLUDED."maxPlayers" ELSE "BoardGameMetadata"."maxPlayers" END,
         "bggRating" = COALESCE(EXCLUDED."bggRating", "BoardGameMetadata"."bggRating"),
         "yearPublished" = COALESCE(EXCLUDED."yearPublished", "BoardGameMetadata"."yearPublished"),
         "updatedAt" = NOW()`,
      game.title,
      slug,
      game.minPlayers ?? null,
      game.maxPlayers ?? null,
      game.bggId,
      game.bggRating ?? null,
      game.yearPublished ?? null,
    );
  } catch {
    // Best effort. If the upsert fails (e.g. slug collision with different bggId),
    // skip and move on — catalog integrity is not critical-path for library add.
  }
}
