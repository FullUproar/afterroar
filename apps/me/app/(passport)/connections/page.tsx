import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { TitleBar, SecHero, Button, EmptyState, TYPE } from '@/app/components/ui';

/**
 * /connections — dedicated user-facing surface for connection management.
 *
 * Connections in Passport are `EntityConsent` rows: a (user, entity, scopes)
 * tuple that grants a tenant app (Full Uproar, an FLGS Store Ops install,
 * etc.) read access to a slice of the user's Passport data. Revoking the
 * consent cuts that tenant off; the user can re-grant later by signing in
 * to that tenant again.
 *
 * Settings has had the same revoke action embedded since launch; this page
 * promotes connection management to a first-class destination so it can be
 * deep-linked, surfaced from notifications, and eventually carry richer
 * info (last-accessed-at, scope diff prompts, webhook delivery state).
 *
 * Searchable URL pattern: ?show=all opens the revoked-history view.
 */
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { show } = await searchParams;
  const showRevoked = show === 'all';

  const userId = session.user.id;
  const consents = await prisma.entityConsent.findMany({
    where: showRevoked ? { userId } : { userId, revokedAt: null },
    include: {
      entity: {
        select: { id: true, name: true, slug: true, type: true, city: true, state: true },
      },
    },
    orderBy: [{ revokedAt: 'asc' }, { grantedAt: 'desc' }],
  });

  const active = consents.filter((c) => c.revokedAt === null);
  const revoked = consents.filter((c) => c.revokedAt !== null);

  async function revokeConnection(formData: FormData) {
    'use server';
    const entityId = formData.get('entityId') as string;
    if (!entityId) return;
    await prisma.entityConsent.update({
      where: { userId_entityId: { userId, entityId } },
      data: { revokedAt: new Date(), scopes: [] },
    });
    audit({
      actorUserId: userId,
      actorEmail: session?.user?.email,
      actorRole: 'self',
      action: 'consent.revoke',
      targetType: 'EntityConsent',
      entityId,
    });
    // TODO (next sprint): fire webhook to tenant for instant session
    // invalidation + tenant-side anonymization. See diagram doc:
    // ops-afterroar-store/docs/passport-system-diagram-2026-05-19.md
    revalidatePath('/connections');
  }

  return (
    <>
      <TitleBar left="Connections" right={`${active.length} active`} />
      <SecHero
        fieldNum="08"
        fieldType="Identity"
        title="Your connections"
        desc="Stores, creators, and platforms that can see a slice of your Passport. Revoke any of them at any time. They lose access immediately and can't re-read your data until you grant again."
      />

      <div
        style={{
          padding: '1rem var(--pad-x) 1.5rem',
          ...TYPE.body,
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
        }}
      >
        {/* Active connections */}
        <section>
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '0.5rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <h2
              style={{
                ...TYPE.mono,
                fontSize: '0.65rem',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                fontWeight: 600,
                margin: 0,
              }}
            >
              Active
            </h2>
            <Link
              href={showRevoked ? '/connections' : '/connections?show=all'}
              style={{
                ...TYPE.mono,
                fontSize: '0.7rem',
                color: 'var(--ink-soft)',
                textDecoration: 'underline',
              }}
            >
              {showRevoked ? 'Hide revoked history' : 'Show revoked history'}
            </Link>
          </header>

          {active.length === 0 ? (
            <EmptyState
              title="No active connections"
              desc="When you sign in to a store, RSVP to a Full Uproar event, or check in at an FLGS register, you create a connection. Each connection is consent-gated and shows up here."
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                background: 'var(--rule)',
                border: '1px solid var(--rule)',
              }}
            >
              {active.map((ec) => (
                <ConnectionRow key={ec.id} ec={ec} status="active" onRevoke={revokeConnection} />
              ))}
            </div>
          )}
        </section>

        {/* Revoked history (only when toggled on) */}
        {showRevoked && revoked.length > 0 && (
          <section>
            <h2
              style={{
                ...TYPE.mono,
                fontSize: '0.65rem',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                fontWeight: 600,
                margin: '0 0 0.5rem',
              }}
            >
              Revoked
            </h2>
            <p
              style={{
                ...TYPE.body,
                color: 'var(--ink-soft)',
                fontSize: '0.78rem',
                margin: '0 0 0.85rem',
              }}
            >
              Connections you&apos;ve cut off. They can&apos;t see your Passport
              data anymore. To restore one, sign back in to that store or
              app — it&apos;ll prompt for fresh consent.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                background: 'var(--rule)',
                border: '1px solid var(--rule)',
              }}
            >
              {revoked.map((ec) => (
                <ConnectionRow key={ec.id} ec={ec} status="revoked" />
              ))}
            </div>
          </section>
        )}

        {/* Cross-link to broader settings */}
        <section>
          <p
            style={{
              ...TYPE.body,
              color: 'var(--ink-soft)',
              fontSize: '0.78rem',
              margin: 0,
            }}
          >
            Looking for marketing toggles, identity edits, or account
            deletion? Those live on{' '}
            <Link href="/settings" style={{ color: 'var(--cream)' }}>
              your settings page
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}

interface ConnectionRowProps {
  ec: {
    id: string;
    grantedAt: Date;
    revokedAt: Date | null;
    scopes: string[];
    entity: {
      id: string;
      name: string;
      slug: string;
      type: string | null;
      city: string | null;
      state: string | null;
    };
  };
  status: 'active' | 'revoked';
  onRevoke?: (fd: FormData) => Promise<void>;
}

function ConnectionRow({ ec, status, onRevoke }: ConnectionRowProps) {
  const isActive = status === 'active';
  const accent = isActive ? 'var(--green)' : 'var(--rule)';
  const metaParts = [
    ec.entity.type,
    ec.entity.city && ec.entity.state ? `${ec.entity.city}, ${ec.entity.state}` : null,
    `since ${new Date(ec.grantedAt).toLocaleDateString()}`,
    ec.revokedAt ? `revoked ${new Date(ec.revokedAt).toLocaleDateString()}` : null,
  ].filter(Boolean);

  const content = (
    <>
      <input type="hidden" name="entityId" value={ec.entity.id} />
      <div style={{ flex: 1, minWidth: '12rem' }}>
        <p
          style={{
            ...TYPE.displayMd,
            color: isActive ? 'var(--cream)' : 'var(--ink-soft)',
            margin: '0 0 0.15rem',
            fontSize: '0.95rem',
          }}
        >
          {ec.entity.name}
        </p>
        <p
          style={{
            ...TYPE.mono,
            color: 'var(--ink-soft)',
            fontSize: '0.66rem',
            margin: '0 0 0.35rem',
            letterSpacing: '0.04em',
          }}
        >
          {metaParts.join(' · ')}
        </p>
        {isActive && ec.scopes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {ec.scopes.map((s) => (
              <span
                key={s}
                style={{
                  padding: '0.1rem 0.4rem',
                  background: 'var(--orange-weak)',
                  border: '1px solid var(--orange)',
                  color: 'var(--orange)',
                  ...TYPE.mono,
                  fontSize: '0.58rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      {isActive && onRevoke && (
        <Button size="sm" variant="danger" type="submit">
          Revoke
        </Button>
      )}
    </>
  );

  if (isActive && onRevoke) {
    return (
      <form
        action={onRevoke}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.9rem 1rem',
          background: 'var(--panel-mute)',
          borderLeft: `2px solid ${accent}`,
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        {content}
      </form>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.9rem 1rem',
        background: 'var(--panel-mute)',
        borderLeft: `2px solid ${accent}`,
        gap: '1rem',
        flexWrap: 'wrap',
        opacity: isActive ? 1 : 0.6,
      }}
    >
      {content}
    </div>
  );
}
