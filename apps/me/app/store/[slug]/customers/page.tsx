import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

/**
 * /store/[slug]/customers — All customers who have granted this entity consent.
 * Member-only.
 */
export default async function StoreCustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/store');
  const callerId = session.user.id as string;

  const entity = await prisma.afterroarEntity.findUnique({
    where: { slug },
    include: { members: { where: { userId: callerId } } },
  });

  if (!entity || entity.members.length === 0 || entity.status !== 'approved') {
    redirect('/store');
  }

  const consents = await prisma.entityConsent.findMany({
    where: { entityId: entity.id, revokedAt: null },
    orderBy: { grantedAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          passportCode: true,
          identityVerified: true,
        },
      },
    },
  });

  // Per-user points balances (Prisma groupBy avoids raw SQL injection risks)
  const balances = consents.length === 0 ? [] : await prisma.pointsLedger.groupBy({
    by: ['userId'],
    where: { storeId: entity.id, userId: { in: consents.map((c) => c.userId) } },
    _sum: { amount: true },
  });
  const balanceMap = new Map(balances.map((b) => [b.userId, b._sum.amount ?? 0]));

  return (
    <main style={{ maxWidth: '64rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link href={`/store/${slug}`} style={{ color: '#6b7280', fontSize: '0.8rem', textDecoration: 'none' }}>
            ← {entity.name}
          </Link>
          <h1 style={{ color: '#FBDB65', fontSize: '1.5rem', fontWeight: 900, margin: '0.5rem 0 0' }}>
            Connected customers ({consents.length})
          </h1>
        </div>
      </div>

      {consents.length === 0 ? (
        <div style={{ padding: '2rem', background: '#1f2937', borderRadius: '12px', textAlign: 'center', color: '#9ca3af' }}>
          No customers connected yet. Generate a consent QR from your dashboard.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {consents.map((c) => (
            <div key={c.id} style={{
              padding: '1rem 1.25rem',
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '10px',
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: '14rem' }}>
                <p style={{ margin: 0, color: '#e2e8f0', fontWeight: 700 }}>
                  {c.user.displayName || c.user.email.split('@')[0]}
                  {c.user.identityVerified && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#10b981' }}>✓ verified</span>
                  )}
                </p>
                <p style={{ margin: '0.2rem 0 0', color: '#6b7280', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  {c.user.passportCode} · since {new Date(c.grantedAt).toLocaleDateString()}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
                  {c.scopes.map((s) => (
                    <span key={s} style={{
                      padding: '0.15rem 0.5rem',
                      background: 'rgba(255, 130, 0, 0.1)',
                      border: '1px solid rgba(255, 130, 0, 0.3)',
                      borderRadius: '999px',
                      color: '#FF8200',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}>{s}</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, color: '#FBDB65', fontWeight: 900, fontSize: '1.15rem' }}>
                  {balanceMap.get(c.userId) ?? 0}
                </p>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  points
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
