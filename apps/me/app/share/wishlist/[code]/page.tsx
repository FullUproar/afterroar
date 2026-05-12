import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ code: string }>;
}

const PRIORITY: Record<number, { label: string; color: string }> = {
  1: { label: 'Must have', color: '#dc2626' },
  2: { label: 'Want', color: '#FF8200' },
  3: { label: 'Interested', color: '#3b82f6' },
  4: { label: 'Maybe someday', color: '#94a3b8' },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const user = await prisma.user.findFirst({
    where: { passportCode: code.toUpperCase() },
    select: { displayName: true },
  });
  const name = user?.displayName || 'a gamer';
  return {
    title: `${name}'s wishlist — Afterroar`,
    description: `Games on ${name}'s wishlist. Gift-giving hints from their Afterroar Passport.`,
  };
}

export default async function SharedWishlistPage({ params }: PageProps) {
  const { code } = await params;

  const user = await prisma.user.findFirst({
    where: { passportCode: code.toUpperCase() },
    select: { id: true, displayName: true, passportCode: true },
  });
  if (!user) notFound();

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: [{ priority: 'asc' }, { addedAt: 'desc' }],
    select: { id: true, gameTitle: true, priority: true, notes: true },
  });

  const owner = user.displayName || 'A gamer';

  return (
    <main style={{ minHeight: '100vh', background: 'var(--void, #0a0a0a)', color: 'var(--cream, #f5e9c9)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '2.5rem 1.25rem 4rem' }}>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
            fontSize: '0.6rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: '#FF8200',
            textDecoration: 'none',
            marginBottom: '2rem',
          }}
        >
          Afterroar Passport
        </Link>

        <p
          style={{
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
            fontSize: '0.62rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: '#94a3b8',
            margin: 0,
          }}
        >
          Wishlist · {user.passportCode}
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: 'clamp(1.85rem, 5vw, 2.6rem)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: '0.45rem 0 0.4rem',
          }}
        >
          {owner}'s wishlist
        </h1>
        <p
          style={{
            color: '#94a3b8',
            fontSize: '0.92rem',
            lineHeight: 1.55,
            margin: '0 0 2rem',
            maxWidth: 480,
          }}
        >
          {items.length === 0
            ? `${owner} hasn't added anything yet. Check back later — or nudge them.`
            : `Looking for a gift? Pick anything below. Priorities run from "must have" to "maybe someday".`}
        </p>

        {items.length === 0 ? (
          <div
            style={{
              border: '1px dashed #2a2a4a',
              padding: '2.5rem 1.25rem',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.85rem',
            }}
          >
            Nothing on the wishlist yet.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
            {items.map((item) => {
              const pri = PRIORITY[item.priority] || PRIORITY[3];
              return (
                <li
                  key={item.id}
                  style={{
                    background: '#111',
                    border: '1px solid #1f1f2e',
                    borderLeft: `3px solid ${pri.color}`,
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--cream, #f5e9c9)' }}>
                      {item.gameTitle}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono), ui-monospace, monospace',
                        fontSize: '0.62rem',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: pri.color,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {pri.label}
                    </span>
                  </div>
                  {item.notes ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0, lineHeight: 1.45 }}>
                      {item.notes}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div
          style={{
            marginTop: '3rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #1f1f2e',
            fontSize: '0.78rem',
            color: '#64748b',
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: '#94a3b8', fontWeight: 600 }}>Afterroar Passport</strong> —
          your tabletop identity. Sign up to track your own library, wishlist, and game nights at
          {' '}
          <Link href="/" style={{ color: '#FF8200' }}>afterroar.me</Link>.
        </div>
      </div>
    </main>
  );
}
