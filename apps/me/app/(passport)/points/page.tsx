import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { TitleBar, SecHero, Panel, EmptyState, TYPE } from '@/app/components/ui';

export default async function PointsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

  const balanceRows = await prisma.$queryRaw<Array<{ storeId: string | null; balance: number }>>`
    SELECT DISTINCT ON ("storeId") "storeId", "balance"
    FROM "PointsLedger"
    WHERE "userId" = ${userId}
    ORDER BY "storeId", "createdAt" DESC
  `;

  const activeBalances = balanceRows.filter((r) => Number(r.balance) > 0);
  const totalBalance = activeBalances.reduce((sum, r) => sum + Number(r.balance), 0);

  const recentTx = await prisma.pointsLedger.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      amount: true,
      balance: true,
      action: true,
      description: true,
      storeId: true,
      createdAt: true,
    },
  });

  return (
    <>
      <TitleBar left="Points" right={`${totalBalance.toLocaleString()} pts`} />
      <SecHero
        fieldNum="04"
        fieldType="Ledger"
        title="Points"
        count={`${activeBalances.length} ${activeBalances.length === 1 ? 'store' : 'stores'}`}
        desc="Loyalty points earned across every store in the Afterroar network."
      />

      <div style={{ padding: '1.25rem var(--pad-x) 1.5rem', ...TYPE.body, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Total balance highlight */}
        <Panel style={{
          background: 'linear-gradient(135deg, rgba(255, 130, 0, 0.1), rgba(255, 130, 0, 0.02))',
          border: '1px solid rgba(255, 130, 0, 0.25)',
          padding: '1.5rem',
          textAlign: 'center',
        }}>
          <p style={{ ...TYPE.mono, fontSize: '0.6rem', letterSpacing: '0.3em', color: 'var(--ink-soft)', textTransform: 'uppercase', margin: '0 0 0.5rem', fontWeight: 700 }}>Total Balance</p>
          <p style={{ ...TYPE.display, fontSize: 'clamp(2.5rem, 8vw, 3.5rem)', color: 'var(--orange)', margin: 0, lineHeight: 1 }}>
            {totalBalance.toLocaleString()}
          </p>
          <p style={{ ...TYPE.mono, fontSize: '0.7rem', color: 'var(--ink-faint)', margin: '0.5rem 0 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            across {activeBalances.length} {activeBalances.length === 1 ? 'store' : 'stores'}
          </p>
        </Panel>

        {/* Per-store breakdown */}
        {activeBalances.length > 0 ? (
          <section>
            <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.75rem' }}>By Store</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
              {activeBalances.map((row, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.85rem 1rem',
                  background: 'var(--panel-mute)',
                }}>
                  <span style={{ ...TYPE.body, color: 'var(--cream)', fontSize: '0.9rem' }}>
                    {row.storeId ? `Store ${row.storeId.slice(0, 8)}…` : 'Afterroar (platform)'}
                  </span>
                  <span style={{ ...TYPE.display, fontSize: '1.1rem', color: 'var(--orange)' }}>
                    {Number(row.balance).toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Recent transactions */}
        <section>
          <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.75rem' }}>Recent Transactions</h2>
          {recentTx.length === 0 ? (
            <EmptyState title="No transactions yet" desc="Earn points by checking in, buying, or playing at Afterroar stores." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
              {recentTx.map((tx, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: 'var(--panel-mute)',
                  gap: '0.75rem',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...TYPE.body, color: 'var(--cream)', margin: 0, fontSize: '0.9rem' }}>{tx.description}</p>
                    <p style={{ ...TYPE.mono, fontSize: '0.66rem', color: 'var(--ink-soft)', letterSpacing: '0.04em', margin: '0.2rem 0 0' }}>
                      {tx.createdAt.toLocaleDateString()} · {tx.action}
                    </p>
                  </div>
                  <span style={{
                    ...TYPE.display,
                    color: tx.amount >= 0 ? 'var(--green)' : 'var(--red)',
                    fontSize: '1rem',
                    whiteSpace: 'nowrap',
                  }}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
