import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function StoresPage() {
  // Public page — no auth required. Shows the federated store directory.
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
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FF8200', marginBottom: '0.5rem' }}>
        Store Directory
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
        Game stores in the Afterroar network. Check in, earn points, find your next game night.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '0.75rem',
      }}>
        {stores.map((store) => (
          <Link
            key={store.id}
            href={`/stores/${store.slug}`}
            style={{
              display: 'block',
              padding: '1.25rem',
              background: '#1f2937',
              borderRadius: '8px',
              border: '1px solid #374151',
              textDecoration: 'none',
              transition: 'border-color 0.2s',
            }}
          >
            <h3 style={{ color: '#e2e8f0', margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 700 }}>
              {store.name}
            </h3>
            <p style={{ color: '#9ca3af', margin: '0 0 0.5rem 0', fontSize: '0.8rem' }}>
              {[store.city, store.state].filter(Boolean).join(', ')}
            </p>
            {store.googleRating && (
              <span style={{ color: '#FF8200', fontSize: '0.8rem', fontWeight: 600 }}>
                ⭐ {store.googleRating} ({store.reviewCount} reviews)
              </span>
            )}
          </Link>
        ))}
      </div>

      {stores.length === 0 && (
        <div style={{
          padding: '3rem',
          background: '#1f2937',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#6b7280' }}>No stores in the directory yet.</p>
        </div>
      )}
    </div>
  );
}
