import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DeletePassport } from './delete-passport';

export default async function DataPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

  const [user, consents, pointsCount, activityCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        displayName: true,
        passportCode: true,
        gameLibrary: true,
        createdAt: true,
      },
    }),
    prisma.userConsent.findMany({
      where: { userId },
      select: { category: true, granted: true },
    }),
    prisma.pointsLedger.count({ where: { userId } }),
    prisma.userActivity.count({ where: { userId } }),
  ]);

  // Get unique stores from points ledger (stores this user has interacted with)
  const storeInteractions = await prisma.pointsLedger.findMany({
    where: { userId, storeId: { not: null } },
    distinct: ['storeId'],
    select: { storeId: true, description: true },
  });

  const connectedStores = storeInteractions
    .filter(s => s.storeId)
    .map(s => {
      const meta = s.description || '';
      return {
        storeId: s.storeId!,
        name: meta.includes(' at ') ? meta.split(' at ').pop() : `Store ${s.storeId!.slice(0, 12)}...`,
        type: 'store_ops' as const,
      };
    });

  let libraryCount = 0;
  if (user?.gameLibrary) {
    try {
      const parsed = JSON.parse(user.gameLibrary);
      libraryCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch { /* ignore */ }
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FF8200', marginBottom: '0.5rem' }}>
        Your Data
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
        Everything Afterroar knows about you. Export it all, or delete it.
        Per the Afterroar Credo: your data belongs to you.
      </p>

      {/* Data summary */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.75rem' }}>
          What we have
        </h2>
        <div style={{
          background: '#1f2937',
          borderRadius: '8px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          {[
            { label: 'Identity', value: `${user?.displayName || user?.email} (since ${user?.createdAt?.toLocaleDateString()})` },
            { label: 'Passport code', value: user?.passportCode || 'Not generated' },
            { label: 'Game library', value: `${libraryCount} games` },
            { label: 'Loyalty points', value: `${pointsCount} transactions` },
            { label: 'Activity history', value: `${activityCount} entries` },
            { label: 'Consent grants', value: `${consents.length} categories tracked` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{label}</span>
              <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Connected stores */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.75rem' }}>
          Stores that have accessed your Passport
        </h2>
        {connectedStores.length === 0 ? (
          <div style={{
            background: '#1f2937',
            borderRadius: '8px',
            padding: '1.25rem',
            color: '#6b7280',
            textAlign: 'center',
          }}>
            No stores have accessed your data yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {connectedStores.map((store) => (
              <div key={store.storeId} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                background: '#1f2937',
                borderRadius: '8px',
              }}>
                <div>
                  <p style={{ color: '#e2e8f0', fontWeight: 600, margin: 0, fontSize: '0.9rem' }}>
                    {store.name}
                  </p>
                  <p style={{ color: '#6b7280', margin: '0.2rem 0 0 0', fontSize: '0.75rem' }}>
                    Store Ops — deletion is automatic if you delete your Passport
                  </p>
                </div>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}>
                  Verified deletion
                </span>
              </div>
            ))}
          </div>
        )}
        <p style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: '0.75rem' }}>
          For stores running Afterroar Store Ops, deletion is automatic and verified.
          For other stores, we revoke access and send a deletion request but cannot
          guarantee they purge their own records.{' '}
          <Link href="/privacy" style={{ color: '#FF8200' }}>Learn more</Link>
        </p>
      </section>

      {/* Actions */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.75rem' }}>
          Actions
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <a
            href="/api/export-data"
            style={{
              display: 'block',
              padding: '1rem 1.25rem',
              background: '#1f2937',
              borderRadius: '8px',
              border: '1px solid #374151',
              textDecoration: 'none',
              color: '#e2e8f0',
            }}
          >
            <p style={{ fontWeight: 700, margin: '0 0 0.25rem 0', fontSize: '0.95rem', color: '#FF8200' }}>
              Export all my data
            </p>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '0.8rem' }}>
              Downloads a JSON file with everything Afterroar knows about you.
              Your identity, consents, points, activity — all of it, in a format you can read.
            </p>
          </a>

          <DeletePassport userEmail={user?.email || ''} />
        </div>
      </section>

      {/* Legal links */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '1.5rem',
        marginTop: '2rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid #1f2937',
      }}>
        <Link href="/privacy" style={{ color: '#6b7280', fontSize: '0.8rem' }}>Privacy Policy</Link>
        <Link href="/terms" style={{ color: '#6b7280', fontSize: '0.8rem' }}>Terms of Service</Link>
      </div>
    </div>
  );
}
