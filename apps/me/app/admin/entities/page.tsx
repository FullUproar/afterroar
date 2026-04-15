import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { audit } from '@/lib/audit';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

/**
 * /admin/entities — God-mode panel for approving/suspending Connect entities.
 * Restricted to ADMIN_EMAILS.
 */
export default async function AdminEntitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/admin/entities');
  if (!isAdmin(session.user.email)) {
    return (
      <main style={{ maxWidth: '32rem', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 900 }}>Not authorized</h1>
        <p style={{ color: '#9ca3af' }}>This panel is admin-only.</p>
        <Link href="/" style={{ color: '#FF8200' }}>← Back</Link>
      </main>
    );
  }

  const entities = await prisma.afterroarEntity.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      members: { include: { user: { select: { email: true, displayName: true } } } },
      _count: { select: { consents: true } },
    },
  });

  async function setStatus(formData: FormData) {
    'use server';
    const session = await auth();
    if (!isAdmin(session?.user?.email)) return;
    const id = formData.get('id') as string;
    const action = formData.get('action') as string;
    if (!id) return;

    if (action === 'approve') {
      await prisma.afterroarEntity.update({
        where: { id },
        data: { status: 'approved', approvedAt: new Date(), suspendedAt: null },
      });
    } else if (action === 'suspend') {
      await prisma.afterroarEntity.update({
        where: { id },
        data: { status: 'suspended', suspendedAt: new Date() },
      });
    } else if (action === 'reject') {
      await prisma.afterroarEntity.update({
        where: { id },
        data: { status: 'rejected' },
      });
    } else if (action === 'reopen') {
      await prisma.afterroarEntity.update({
        where: { id },
        data: { status: 'pending', suspendedAt: null },
      });
    }

    audit({
      actorUserId: session?.user?.id as string | undefined,
      actorEmail: session?.user?.email,
      actorRole: 'admin',
      action: `entity.${action}`,
      targetType: 'AfterroarEntity',
      targetId: id,
      entityId: id,
    });

    revalidatePath('/admin/entities');
  }

  const pending = entities.filter((e) => e.status === 'pending');
  const approved = entities.filter((e) => e.status === 'approved');
  const others = entities.filter((e) => !['pending', 'approved'].includes(e.status));

  return (
    <main style={{ maxWidth: '64rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <p style={{ color: '#7D55C7', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 0.35rem' }}>
        God Mode
      </p>
      <h1 style={{ color: '#FBDB65', fontSize: '1.75rem', fontWeight: 900, margin: '0 0 2rem' }}>
        Connect entities
      </h1>

      <Section title={`Pending (${pending.length})`} entities={pending} action={setStatus} actions={['approve', 'reject']} />
      <Section title={`Approved (${approved.length})`} entities={approved} action={setStatus} actions={['suspend']} />
      {others.length > 0 && (
        <Section title={`Suspended / Rejected (${others.length})`} entities={others} action={setStatus} actions={['reopen', 'approve']} />
      )}
    </main>
  );
}

type EntityRow = Awaited<ReturnType<typeof loadEntities>>[number];
async function loadEntities() {
  return prisma.afterroarEntity.findMany({
    include: {
      members: { include: { user: { select: { email: true, displayName: true } } } },
      _count: { select: { consents: true } },
    },
  });
}

function Section({
  title,
  entities,
  action,
  actions,
}: {
  title: string;
  entities: EntityRow[];
  action: (formData: FormData) => Promise<void>;
  actions: Array<'approve' | 'suspend' | 'reject' | 'reopen'>;
}) {
  if (entities.length === 0) return null;
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ color: '#e2e8f0', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem' }}>{title}</h2>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {entities.map((e) => {
          const owner = e.members.find((m) => m.role === 'owner') || e.members[0];
          return (
            <div key={e.id} style={{
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
                <p style={{ margin: 0, color: '#FBDB65', fontWeight: 700 }}>{e.name}</p>
                <p style={{ margin: '0.2rem 0', color: '#9ca3af', fontSize: '0.8rem' }}>
                  {e.type}
                  {e.city && e.state && ` · ${e.city}, ${e.state}`}
                  {' · '}slug: <code style={{ color: '#FF8200' }}>{e.slug}</code>
                </p>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.75rem' }}>
                  Owner: {owner?.user?.displayName || owner?.user?.email || '—'} · {e._count.consents} connected customers · applied {new Date(e.createdAt).toLocaleString()}
                </p>
                {e.description && (
                  <p style={{ margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.75rem', fontStyle: 'italic' }}>
                    &ldquo;{e.description}&rdquo;
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {actions.map((a) => (
                  <form key={a} action={action}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="action" value={a} />
                    <button type="submit" style={btnFor(a)}>{labelFor(a)}</button>
                  </form>
                ))}
                {e.status === 'approved' && (
                  <Link href={`/store/${e.slug}`} style={{
                    padding: '0.4rem 0.85rem',
                    background: 'transparent',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    color: '#9ca3af',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}>View →</Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function labelFor(a: string) {
  return { approve: 'Approve', suspend: 'Suspend', reject: 'Reject', reopen: 'Reopen' }[a as 'approve'];
}
function btnFor(a: 'approve' | 'suspend' | 'reject' | 'reopen'): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    approve: { bg: '#10b981', fg: '#0a0a0a' },
    suspend: { bg: '#f59e0b', fg: '#0a0a0a' },
    reject: { bg: '#ef4444', fg: '#fff' },
    reopen: { bg: '#7D55C7', fg: '#fff' },
  };
  const c = colors[a];
  return {
    padding: '0.4rem 0.85rem',
    background: c.bg,
    border: 'none',
    borderRadius: '6px',
    color: c.fg,
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
  };
}
