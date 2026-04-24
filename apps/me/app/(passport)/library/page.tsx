import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { TitleBar, SecHero, TYPE } from '@/app/components/ui';
import { LibraryPageClient } from './library-page-client';
import { getCatalogEntries } from '@/lib/game-catalog';

interface LibraryRow {
  title: string;
  slug?: string;
  bggId?: number;
  tags?: string[];
  minPlayers?: number | null;
  maxPlayers?: number | null;
  minPlayMinutes?: number | null;
  maxPlayMinutes?: number | null;
  complexity?: number | null;
}

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gameLibrary: true },
  });

  let library: LibraryRow[] = [];
  if (user?.gameLibrary) {
    try {
      const parsed = JSON.parse(user.gameLibrary);
      if (Array.isArray(parsed)) {
        library = parsed.map((g: Record<string, unknown>) => ({
          title: (g.title || g.name || '') as string,
          slug: g.slug as string | undefined,
          bggId: g.bggId as number | undefined,
          tags: Array.isArray(g.tags) ? (g.tags as string[]) : undefined,
        }));
      }
    } catch {
      library = [];
    }
  }

  // Enrich with catalog metadata (single batched query)
  const catalog = await getCatalogEntries(library.map((g) => ({ bggId: g.bggId, slug: g.slug })));
  library = library.map((g) => {
    const entry = (g.bggId != null ? catalog.get(`bgg:${g.bggId}`) : undefined)
      ?? (g.slug ? catalog.get(`slug:${g.slug}`) : undefined);
    if (!entry) return g;
    return {
      ...g,
      minPlayers: entry.minPlayers ?? undefined,
      maxPlayers: entry.maxPlayers ?? undefined,
      minPlayMinutes: entry.minPlayMinutes ?? undefined,
      maxPlayMinutes: entry.maxPlayMinutes ?? undefined,
      complexity: entry.complexity ?? undefined,
    };
  });

  return (
    <>
      <TitleBar left="Library" right={`${library.length} game${library.length !== 1 ? 's' : ''}`} />
      <SecHero
        fieldNum="01"
        fieldType="Inventory"
        title="Library"
        count={`${library.length} ${library.length === 1 ? 'game' : 'games'}`}
        desc="Games you own. Apps you connect to your Passport can use this for recommendations and matchmaking."
      />
      <div style={{ padding: '1rem var(--pad-x) 0.75rem', ...TYPE.body }}>
        <LibraryPageClient initialGames={library} />
      </div>
      <p style={{
        margin: '0 var(--pad-x) 1.5rem',
        ...TYPE.mono,
        fontSize: '0.6rem',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--ink-faint)',
        textAlign: 'center',
      }}>
        Game data from <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink-soft)', textDecoration: 'none', borderBottom: '1px dotted var(--ink-faint)' }}>BoardGameGeek</a>
      </p>
    </>
  );
}
