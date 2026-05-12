import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { redirect } from 'next/navigation';
import { InvitesClient } from './InvitesClient';

export const dynamic = 'force-dynamic';

export default async function InvitesAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/admin/invites');
  if (!isAdmin(session.user.email)) {
    return (
      <div style={{ padding: '4rem 1.5rem', textAlign: 'center', minHeight: '100vh', background: '#0a0a0a', color: '#FBDB65' }}>
        <h1 style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 900 }}>Not authorized</h1>
        <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Admins only.</p>
      </div>
    );
  }

  const [requests, codes, counts] = await Promise.all([
    prisma.inviteRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.inviteRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  const statusCounts = counts.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = c._count._all;
    return acc;
  }, {});

  // Serialize for the client component.
  return (
    <InvitesClient
      requests={requests.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        consents: r.consents as Record<string, boolean>,
      }))}
      codes={codes.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        consumedAt: c.consumedAt?.toISOString() ?? null,
        expiresAt: c.expiresAt?.toISOString() ?? null,
      }))}
      statusCounts={statusCounts}
      inviteGateEnabled={process.env.INVITE_GATE_ENABLED === 'true'}
    />
  );
}
