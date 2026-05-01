import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { ChromeNav, Workbench, PlayerCard } from '@/app/components/card-shell';
import { TYPE, TitleBar } from '@/app/components/ui';
import UsersTable from './UsersTable';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    filter?: 'all' | 'verified' | 'unverified' | 'banned';
    provider?: 'all' | 'google' | 'password';
    page?: string;
  }>;
}

const PAGE_SIZE = 25;

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await requireAdmin();
  const params = await searchParams;
  const q = params.q?.trim() || '';
  const filter = params.filter || 'all';
  const provider = params.provider || 'all';
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);

  // Build where clause
  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { displayName: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } },
      { passportCode: { equals: q.toUpperCase() } },
    ];
  }
  if (filter === 'verified') where.emailVerified = { not: null };
  if (filter === 'unverified') where.emailVerified = null;
  if (filter === 'banned') where.isFrozen = true;
  if (provider === 'google') where.accounts = { some: { provider: 'google' } };
  if (provider === 'password') {
    where.accounts = { none: {} };
    where.passwordHash = { not: null };
  }

  const [users, totalMatching, totalAll, totalVerified, totalBanned, recent] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        passportCode: true,
        emailVerified: true,
        identityVerified: true,
        isFrozen: true,
        accountStatus: true,
        membershipTier: true,
        isMinor: true,
        createdAt: true,
        accounts: { select: { provider: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.user.count({ where: { isFrozen: true } }),
    prisma.user.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));

  return (
    <>
      <ChromeNav signedIn email={session.user?.email} />
      <Workbench>
        <PlayerCard maxWidth="60rem">
          <TitleBar left="Admin · Users" right={`signed in as ${session.user?.email}`} />
          <div style={{ padding: '1.5rem var(--pad-x) 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Counters */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.5rem',
              }}
            >
              <Counter label="Total" value={totalAll} />
              <Counter label="Verified" value={totalVerified} accent="#10b981" />
              <Counter label="Unverified" value={totalAll - totalVerified} accent="#94a3b8" />
              <Counter label="Banned" value={totalBanned} accent="#ef4444" />
              <Counter label="New (7d)" value={recent} accent="var(--orange)" />
            </div>

            {/* Filters + search */}
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
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search email / name / passport code"
                style={{
                  flex: '1 1 240px',
                  padding: '0.55rem 0.8rem',
                  background: 'var(--panel-mute)',
                  border: '1.5px solid var(--rule)',
                  color: 'var(--cream)',
                  ...TYPE.body,
                  fontSize: '0.9rem',
                  outline: 'none',
                  borderRadius: '0.4rem',
                }}
              />
              <select
                name="filter"
                defaultValue={filter}
                style={selectStyle}
              >
                <option value="all">All states</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
                <option value="banned">Banned</option>
              </select>
              <select name="provider" defaultValue={provider} style={selectStyle}>
                <option value="all">Any auth</option>
                <option value="google">Google OAuth</option>
                <option value="password">Email + password</option>
              </select>
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
              <Link
                href="/admin/users/new"
                style={{
                  padding: '0.55rem 1rem',
                  background: 'var(--panel-mute)',
                  border: '1.5px solid rgba(255, 130, 0, 0.5)',
                  color: 'var(--orange)',
                  ...TYPE.display,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  borderRadius: '0.4rem',
                }}
              >
                + Add user
              </Link>
              <Link
                href="/admin/audit"
                style={{
                  padding: '0.55rem 1rem',
                  background: 'transparent',
                  border: '1.5px solid var(--rule)',
                  color: 'var(--ink-soft)',
                  ...TYPE.display,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  borderRadius: '0.4rem',
                }}
              >
                Audit log
              </Link>
            </form>

            {/* Results meta */}
            <div style={{ ...TYPE.body, fontSize: '0.8rem', color: 'var(--ink-faint)' }}>
              {totalMatching === 0
                ? 'No matches.'
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalMatching)} of ${totalMatching}`}
            </div>

            {/* Table */}
            {users.length > 0 && <UsersTable users={users} />}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                <PageLink page={page - 1} disabled={page === 1} q={q} filter={filter} provider={provider} label="←" />
                <span style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--ink-soft)', alignSelf: 'center' }}>
                  Page {page} of {totalPages}
                </span>
                <PageLink page={page + 1} disabled={page === totalPages} q={q} filter={filter} provider={provider} label="→" />
              </div>
            )}
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}

function Counter({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div
      style={{
        padding: '0.6rem 0.8rem',
        background: 'var(--panel-mute)',
        border: '1px solid var(--rule)',
        borderRadius: '0.5rem',
      }}
    >
      <div
        style={{
          ...TYPE.display,
          fontSize: '1.4rem',
          color: accent || 'var(--cream)',
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          ...TYPE.body,
          fontSize: '0.7rem',
          color: 'var(--ink-faint)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginTop: '0.25rem',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function PageLink({
  page,
  disabled,
  q,
  filter,
  provider,
  label,
}: {
  page: number;
  disabled: boolean;
  q: string;
  filter: string;
  provider: string;
  label: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (filter !== 'all') params.set('filter', filter);
  if (provider !== 'all') params.set('provider', provider);
  params.set('page', String(page));
  if (disabled) {
    return (
      <span
        style={{
          padding: '0.4rem 0.8rem',
          color: 'var(--ink-faint)',
          ...TYPE.display,
          fontSize: '0.85rem',
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/users?${params.toString()}`}
      style={{
        padding: '0.4rem 0.8rem',
        background: 'var(--panel-mute)',
        border: '1px solid var(--rule)',
        borderRadius: '0.3rem',
        color: 'var(--cream)',
        textDecoration: 'none',
        ...TYPE.display,
        fontSize: '0.85rem',
      }}
    >
      {label}
    </Link>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '0.55rem 0.8rem',
  background: 'var(--panel-mute)',
  border: '1.5px solid var(--rule)',
  color: 'var(--cream)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  outline: 'none',
  borderRadius: '0.4rem',
};
