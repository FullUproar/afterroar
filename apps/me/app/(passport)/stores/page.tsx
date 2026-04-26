import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { TitleBar, SecHero, EmptyState, TYPE } from '@/app/components/ui';
import { SuggestStoreCard } from './SuggestStoreCard';

export default async function StoresPage() {
  // Include crowdsourced + unclaimed rows alongside curated/rated stores so
  // the directory reflects the actual network. The rating filter used to
  // exclude both — now we show everything except explicitly hidden rows
  // and let the sort surface the most-reviewed stores at the top.
  const stores = await prisma.venue.findMany({
    where: {
      status: { not: 'hidden' },
    },
    orderBy: [
      { reviewCount: { sort: 'desc', nulls: 'last' } },
      { name: 'asc' },
    ],
    take: 200,
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
      status: true,
      metadata: true,
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
          <>
            <EmptyState
              title="The directory is still filling up"
              desc="We're adding game stores across the country. Don't see your favorite local? Add it below — the actual owner can claim and verify the listing later."
            />
            <SuggestStoreCard />
          </>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1px',
              background: 'var(--rule)',
              border: '1px solid var(--rule)',
            }} className="ar-stagger">
              {stores.map((store) => {
                const meta = (store.metadata as Record<string, unknown> | null) ?? {};
                const isCrowdsourced = meta.crowdsourced === true;
                const isUnclaimed = store.status === 'unclaimed' || store.status === 'pending';
                return (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {store.googleRating ? (
                        <span style={{ ...TYPE.mono, color: 'var(--yellow)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Star size={12} fill="currentColor" strokeWidth={0} />
                          {store.googleRating} <span style={{ color: 'var(--ink-faint)' }}>({store.reviewCount})</span>
                        </span>
                      ) : null}
                      {isCrowdsourced && (
                        <span style={{
                          ...TYPE.mono,
                          fontSize: '0.58rem',
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          color: 'var(--orange)',
                          padding: '2px 6px',
                          border: '1px solid rgba(255, 130, 0, 0.4)',
                          background: 'rgba(255, 130, 0, 0.08)',
                        }}>
                          Community-added
                        </span>
                      )}
                      {isUnclaimed && !isCrowdsourced && (
                        <span style={{
                          ...TYPE.mono,
                          fontSize: '0.58rem',
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          color: 'var(--ink-faint)',
                          padding: '2px 6px',
                          border: '1px solid var(--rule-hi)',
                        }}>
                          Unclaimed
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
            <SuggestStoreCard />
          </>
        )}
      </div>
    </>
  );
}
