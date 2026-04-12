import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function StoreDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const venue = await prisma.venue.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      phone: true,
      email: true,
      website: true,
      description: true,
      shortDescription: true,
      googleRating: true,
      reviewCount: true,
      venueType: true,
      hours: true,
      amenities: true,
      logoUrl: true,
      coverImageUrl: true,
    },
  });

  if (!venue) notFound();

  const location = [venue.address, venue.city, venue.state, venue.zip].filter(Boolean).join(', ');

  return (
    <div>
      <Link href="/stores" style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}>
        ← Back to directory
      </Link>

      <div style={{ marginTop: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FF8200', marginBottom: '0.25rem' }}>
          {venue.name}
        </h1>

        {location && (
          <p style={{ color: '#9ca3af', marginBottom: '0.5rem' }}>{location}</p>
        )}

        {venue.googleRating && (
          <p style={{ color: '#FF8200', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.5rem' }}>
            ⭐ {venue.googleRating} ({venue.reviewCount} reviews)
          </p>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginTop: '1rem',
      }}>
        {/* About */}
        <div style={{
          background: '#1f2937',
          borderRadius: '8px',
          padding: '1.25rem',
        }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            About
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
            {venue.description || venue.shortDescription || 'No description available.'}
          </p>
        </div>

        {/* Contact */}
        <div style={{
          background: '#1f2937',
          borderRadius: '8px',
          padding: '1.25rem',
        }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Contact
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {venue.phone && (
              <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.875rem' }}>
                📞 {venue.phone}
              </p>
            )}
            {venue.email && (
              <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.875rem' }}>
                ✉️ {venue.email}
              </p>
            )}
            {venue.website && (
              <a
                href={venue.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#FF8200', fontSize: '0.875rem' }}
              >
                🌐 {venue.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
            {venue.hours && (
              <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.875rem' }}>
                🕒 {venue.hours}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Canonical URL notice */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: 'rgba(255, 130, 0, 0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 130, 0, 0.15)',
        textAlign: 'center',
      }}>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
          This is the canonical Afterroar page for {venue.name}.
          Neutral ground — not hosted by any publisher or competitor.
        </p>
      </div>
    </div>
  );
}
