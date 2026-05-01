import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { ChromeNav, Workbench, PlayerCard } from '@/app/components/card-shell';
import { TYPE, TitleBar } from '@/app/components/ui';

interface PageProps {
  searchParams: Promise<{
    action?: string;
    adminEmail?: string;
    targetId?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'muted' }> = {
  'user.verify': { label: 'Verified email', tone: 'green' },
  'user.unverify': { label: 'Unverified email', tone: 'muted' },
  'user.ban': { label: 'Banned', tone: 'red' },
  'user.unban': { label: 'Unbanned', tone: 'muted' },
  'user.delete': { label: 'Deleted', tone: 'red' },
  'user.update': { label: 'Updated', tone: 'blue' },
  'user.create': { label: 'Created', tone: 'green' },
  'user.resend_verification': { label: 'Resent verification', tone: 'amber' },
};

export default async function AuditLogPage({ searchParams }: PageProps) {
  const session = await requireAdmin();
  const params = await searchParams;
  const action = params.action || '';
  const adminEmail = params.adminEmail || '';
  const targetId = params.targetId || '';
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (targetId) where.targetId = targetId;
  if (adminEmail) {
    where.admin = { email: { contains: adminEmail.toLowerCase(), mode: 'insensitive' } };
  }

  const [rows, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        admin: { select: { id: true, email: true, displayName: true } },
      },
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <ChromeNav signedIn email={session.user?.email} />
      <Workbench>
        <PlayerCard maxWidth="64rem">
          <TitleBar left="Admin · Audit Log" right={`signed in as ${session.user?.email}`} />
          <div style={{ padding: '1.5rem var(--pad-x) 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link href="/admin/users" style={navLinkStyle}>← Users</Link>
              <span style={{ ...TYPE.body, fontSize: '0.82rem', color: 'var(--ink-faint)', alignSelf: 'center' }}>
                Append-only log of every state-changing admin action.
              </span>
            </div>

            {/* Filters */}
            <form
              method="get"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <input
                name="adminEmail"
                type="search"
                defaultValue={adminEmail}
                placeholder="Filter by admin email"
                style={inputStyle}
              />
              <select name="action" defaultValue={action} style={inputStyle}>
                <option value="">All actions</option>
                {Object.entries(ACTION_LABELS).map(([code, meta]) => (
                  <option key={code} value={code}>{meta.label}</option>
                ))}
              </select>
              <input
                name="targetId"
                type="search"
                defaultValue={targetId}
                placeholder="Target user ID"
                style={inputStyle}
              />
              <button
                type="submit"
                style={{
                  padding: '0.55rem 1rem',
                  background: 'var(--orange)',
                  border: 'none',
                  color: 'var(--void, #1a1a1a)',
                  ...TYPE.display,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: '0.4rem',
                }}
              >
                Apply
              </button>
            </form>

            <div style={{ ...TYPE.body, fontSize: '0.8rem', color: 'var(--ink-faint)' }}>
              {total === 0
                ? 'No audit entries match.'
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
            </div>

            {rows.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', ...TYPE.body, fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid var(--rule)', textAlign: 'left' }}>
                      <Th>When</Th>
                      <Th>Admin</Th>
                      <Th>Action</Th>
                      <Th>Target</Th>
                      <Th>Diff / Detail</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const meta = ACTION_LABELS[r.action] || { label: r.action, tone: 'muted' as const };
                      const diff = computeDiff(r.beforeState, r.afterState);
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--rule)', verticalAlign: 'top' }}>
                          <Td>
                            <div style={{ ...TYPE.body, fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                              {r.createdAt.toLocaleString()}
                            </div>
                            {r.ipAddress && (
                              <div style={{ ...TYPE.mono, fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: '0.15rem' }}>
                                {r.ipAddress}
                              </div>
                            )}
                          </Td>
                          <Td>
                            <div style={{ color: 'var(--cream)', fontWeight: 600 }}>
                              {r.admin.email}
                            </div>
                            {r.admin.displayName && (
                              <div style={{ color: 'var(--ink-faint)', fontSize: '0.72rem' }}>
                                {r.admin.displayName}
                              </div>
                            )}
                          </Td>
                          <Td>
                            <Pill label={meta.label} tone={meta.tone} />
                          </Td>
                          <Td>
                            {r.targetId ? (
                              <Link
                                href={`/admin/users/${r.targetId}`}
                                style={{ color: 'var(--orange)', ...TYPE.mono, fontSize: '0.72rem', textDecoration: 'none' }}
                              >
                                {r.targetId}
                              </Link>
                            ) : (
                              <span style={{ color: 'var(--ink-faint)' }}>—</span>
                            )}
                          </Td>
                          <Td>
                            {diff.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', ...TYPE.mono, fontSize: '0.72rem' }}>
                                {diff.map((d, i) => (
                                  <div key={i}>
                                    <span style={{ color: 'var(--ink-soft)' }}>{d.field}: </span>
                                    <span style={{ color: 'var(--red)', textDecoration: 'line-through' }}>{stringify(d.before)}</span>
                                    <span style={{ color: 'var(--ink-faint)' }}> → </span>
                                    <span style={{ color: '#10b981' }}>{stringify(d.after)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--ink-faint)', fontSize: '0.78rem' }}>
                                {r.beforeState == null && r.afterState != null ? 'created' : r.beforeState != null && r.afterState == null ? 'deleted' : '—'}
                              </span>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <PageLink page={page - 1} disabled={page === 1} action={action} adminEmail={adminEmail} targetId={targetId} label="←" />
                <span style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--ink-soft)', alignSelf: 'center' }}>
                  Page {page} of {totalPages}
                </span>
                <PageLink page={page + 1} disabled={page === totalPages} action={action} adminEmail={adminEmail} targetId={targetId} label="→" />
              </div>
            )}
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}

interface DiffEntry { field: string; before: unknown; after: unknown }

function computeDiff(before: unknown, after: unknown): DiffEntry[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const fields = new Set([...Object.keys(b), ...Object.keys(a)]);
  const result: DiffEntry[] = [];
  for (const f of fields) {
    if (JSON.stringify(b[f]) !== JSON.stringify(a[f])) {
      result.push({ field: f, before: b[f], after: a[f] });
    }
  }
  return result;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: '0.5rem 0.6rem', ...TYPE.body, fontSize: '0.72rem', color: 'var(--ink-soft)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '0.6rem', verticalAlign: 'top' }}>{children}</td>;
}

function Pill({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'muted' }) {
  const palette: Record<string, { bg: string; fg: string; border: string }> = {
    green: { bg: 'rgba(16, 185, 129, 0.1)', fg: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
    amber: { bg: 'rgba(251, 191, 36, 0.1)', fg: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' },
    red: { bg: 'rgba(239, 68, 68, 0.1)', fg: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
    blue: { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
    muted: { bg: 'rgba(148, 163, 184, 0.1)', fg: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' },
  };
  const c = palette[tone];
  return (
    <span style={{ padding: '0.15rem 0.5rem', background: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: '0.3rem', ...TYPE.body, fontSize: '0.7rem', fontWeight: 700 }}>
      {label}
    </span>
  );
}

function PageLink({
  page,
  disabled,
  action,
  adminEmail,
  targetId,
  label,
}: {
  page: number;
  disabled: boolean;
  action: string;
  adminEmail: string;
  targetId: string;
  label: string;
}) {
  const params = new URLSearchParams();
  if (action) params.set('action', action);
  if (adminEmail) params.set('adminEmail', adminEmail);
  if (targetId) params.set('targetId', targetId);
  params.set('page', String(page));
  if (disabled) {
    return <span style={{ padding: '0.4rem 0.8rem', color: 'var(--ink-faint)', ...TYPE.display, fontSize: '0.85rem' }}>{label}</span>;
  }
  return (
    <Link
      href={`/admin/audit?${params.toString()}`}
      style={{ padding: '0.4rem 0.8rem', background: 'var(--panel-mute)', border: '1px solid var(--rule)', borderRadius: '0.3rem', color: 'var(--cream)', textDecoration: 'none', ...TYPE.display, fontSize: '0.85rem' }}
    >
      {label}
    </Link>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.55rem 0.8rem',
  background: 'var(--panel-mute)',
  border: '1.5px solid var(--rule)',
  color: 'var(--cream)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  outline: 'none',
  borderRadius: '0.4rem',
};

const navLinkStyle: React.CSSProperties = {
  padding: '0.4rem 0.85rem',
  background: 'var(--panel-mute)',
  border: '1px solid var(--rule)',
  borderRadius: '0.4rem',
  color: 'var(--orange)',
  ...TYPE.body,
  fontSize: '0.82rem',
  textDecoration: 'none',
};
