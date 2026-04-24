import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DeletePassport } from './delete-passport';
import { TitleBar, SecHero, Panel, EmptyState, TYPE, Chip } from '@/app/components/ui';

export default async function DataPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

  const [user, consents, pointsCount, activityCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, displayName: true, passportCode: true, gameLibrary: true, createdAt: true },
    }),
    prisma.userConsent.findMany({ where: { userId }, select: { category: true, granted: true } }),
    prisma.pointsLedger.count({ where: { userId } }),
    prisma.userActivity.count({ where: { userId } }),
  ]);

  const storeInteractions = await prisma.pointsLedger.findMany({
    where: { userId, storeId: { not: null } },
    distinct: ['storeId'],
    select: { storeId: true, description: true },
  });

  const connectedStores = storeInteractions
    .filter((s) => s.storeId)
    .map((s) => {
      const meta = s.description || '';
      return {
        storeId: s.storeId!,
        name: meta.includes(' at ') ? meta.split(' at ').pop() || 'Store' : `Store ${s.storeId!.slice(0, 12)}…`,
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
    <>
      <TitleBar left="Your Data" right={user?.passportCode ? `FU · ${user.passportCode}` : undefined} />
      <SecHero
        fieldNum="08"
        fieldType="Sovereignty"
        title="Your Data"
        desc="Everything Afterroar knows about you. Export it all, or delete it. Per the Afterroar Credo: your data belongs to you."
      />

      <div style={{ padding: '1rem var(--pad-x) 1.5rem', ...TYPE.body, display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Summary */}
        <section>
          <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.6rem' }}>What We Have</h2>
          <Panel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { label: 'Identity', value: `${user?.displayName || user?.email} (since ${user?.createdAt?.toLocaleDateString()})` },
                { label: 'Passport code', value: user?.passportCode || 'Not generated' },
                { label: 'Game library', value: `${libraryCount} games` },
                { label: 'Loyalty points', value: `${pointsCount} transactions` },
                { label: 'Activity history', value: `${activityCount} entries` },
                { label: 'Consent grants', value: `${consents.length} categories tracked` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <span style={{ ...TYPE.body, color: 'var(--cream)', fontSize: '0.88rem' }}>{label}</span>
                  <span style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.78rem', textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        {/* Connected stores */}
        <section>
          <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.6rem' }}>
            Stores That Have Accessed Your Passport
          </h2>
          {connectedStores.length === 0 ? (
            <EmptyState title="No stores yet" desc="No stores have accessed your data yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
              {connectedStores.map((store) => (
                <div key={store.storeId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.9rem 1rem',
                  background: 'var(--panel-mute)',
                  gap: '0.75rem',
                }}>
                  <div>
                    <p style={{ ...TYPE.displayMd, color: 'var(--cream)', margin: 0, fontSize: '0.9rem' }}>{store.name}</p>
                    <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0.2rem 0 0', fontSize: '0.76rem' }}>
                      Store Ops — deletion is automatic if you delete your Passport
                    </p>
                  </div>
                  <Chip tone="green">Verified deletion</Chip>
                </div>
              ))}
            </div>
          )}
          <p style={{ ...TYPE.body, color: 'var(--ink-faint)', fontSize: '0.75rem', margin: '0.75rem 0 0', lineHeight: 1.5 }}>
            For stores running Afterroar Store Ops, deletion is automatic and verified.
            For other stores, we revoke access and send a deletion request but cannot
            guarantee they purge their own records.{' '}
            <Link href="/privacy" style={{ color: 'var(--orange)' }}>Learn more</Link>
          </p>
        </section>

        {/* Actions */}
        <section>
          <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.6rem' }}>Actions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <a href="/api/export-data" className="ar-stripe" style={{
              display: 'block',
              padding: '1rem 1.1rem',
              background: 'var(--panel-mute)',
              border: '1px solid var(--rule)',
              textDecoration: 'none',
              color: 'var(--cream)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <p style={{ ...TYPE.displayMd, margin: '0 0 0.2rem', fontSize: '0.95rem', color: 'var(--orange)' }}>
                Export all my data
              </p>
              <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: 0, fontSize: '0.8rem', lineHeight: 1.5 }}>
                Downloads a JSON file with everything Afterroar knows about you. Your identity,
                consents, points, activity — all of it, in a format you can read.
              </p>
            </a>

            <DeletePassport userEmail={user?.email || ''} />
          </div>
        </section>
      </div>
    </>
  );
}
