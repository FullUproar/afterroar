import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gameLibrary: true },
  });

  let library: Array<{ name: string; bggId?: number; addedAt?: string }> = [];
  if (user?.gameLibrary) {
    try {
      const parsed = JSON.parse(user.gameLibrary);
      library = Array.isArray(parsed) ? parsed : [];
    } catch {
      library = [];
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FF8200', marginBottom: '0.5rem' }}>
        Game Library
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
        Games you own, declared by you or auto-added from consented purchases.
      </p>

      {library.length === 0 ? (
        <div style={{
          padding: '3rem',
          background: '#1f2937',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>
            Your library is empty
          </p>
          <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: 0 }}>
            Games will appear here when you add them manually or when a
            consented purchase adds them automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {library.map((game, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              background: '#1f2937',
              borderRadius: '8px',
            }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{game.name}</span>
              {game.addedAt && (
                <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                  Added {new Date(game.addedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
