import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { TitleBar, SecHero, TYPE } from '@/app/components/ui';
import { LibraryPageClient } from './library-page-client';

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gameLibrary: true },
  });

  let library: Array<{ title: string; slug?: string; bggId?: number; tags?: string[] }> = [];
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
      <div style={{ padding: '1rem var(--pad-x) 1.5rem', ...TYPE.body }}>
        <LibraryPageClient initialGames={library} />
      </div>
    </>
  );
}
