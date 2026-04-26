import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { TitleBar, SecHero, EmptyState, TYPE } from '@/app/components/ui';

export default async function StoresPage() {
  const stores = await prisma.venue.findMany({
    where: {
      status: { not: 'hidden' },
      googleRating: { gte: 4.0 },
      reviewCount: { gte: 50 },
    },
    orderBy: { reviewCount: 'desc' },
    take: 100,
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      googleRating: true,
      reviewCount: true,
      shortDescription: true,
      venueType: true,
    },
  });

  return (
    <>
      <TitleBar left="Stores" right={`${stores.length} in directory`} />
      <SecHero
        fieldNum="06"
        fieldType="Waypoints"
        title="Stores"
        desc="Game stores in your area. Walk in, show your Passport at the counter, and the store can recognize you, recommend games, and credit points to your account."
      />

      <div style={{ padding: '1rem var(--pad-x) 1.5rem', ...TYPE.body }}>
        {stores.length === 0 ? (
          <EmptyState
            title="The directory is still filling up"
            desc="We're adding game stores across the country. Don't see your favorite local? Tell them about Afterroar — we'll handle the integration."
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1px',
            background: 'var(--rule)',
            border: '1px solid var(--rule)',
          }} className="ar-stagger">
            {stores.map((store) => (
              <Link key={store.id} href={`/stores/${store.slug}`} className="ar-stripe" style={{
                display: 'block',
                padding: '1rem 1.1rem',
                background: 'var(--panel-mute)',
                textDecoration: 'none',
                color: 'inherit',
              }}>
                <h3 style={{ ...TYPE.display, color: 'var(--cream)', margin: '0 0 0.25rem', fontSize: '1.05rem' }}>{store.name}</h3>
                <p style={{ ...TYPE.mono, fontSize: '0.66rem', letterSpacing: '0.08em', color: 'var(--ink-soft)', margin: '0 0 0.5rem' }}>
                  {[store.city, store.state].filter(Boolean).join(', ')}
                </p>
                {store.googleRating ? (
                  <span style={{ ...TYPE.mono, color: 'var(--yellow)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Star size={12} fill="currentColor" strokeWidth={0} />
                    {store.googleRating} <span style={{ color: 'var(--ink-faint)' }}>({store.reviewCount})</span>
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
