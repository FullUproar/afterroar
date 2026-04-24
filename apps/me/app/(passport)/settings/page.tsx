import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { BadgeIcon } from '@/app/components/badge-icon';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { TitleBar, SecHero, Panel, Button, EmptyState, TYPE } from '@/app/components/ui';

const CONSENT_LABELS: Record<string, { label: string; description: string }> = {
  platform_functional: {
    label: 'Platform essentials',
    description: 'Order confirmations, security alerts, password resets. Required for the platform to work.',
  },
  platform_product: {
    label: 'Platform updates',
    description: 'New features, improvements, and community content from Afterroar.',
  },
  game_night_functional: {
    label: 'Game night reminders',
    description: 'RSVP confirmations, day-of reminders, recap notifications for nights you joined.',
  },
  crew_activity: {
    label: 'Crew activity',
    description: 'Updates from your game groups — new nights planned, recap shares, friend activity.',
  },
  fulluproar_marketing: {
    label: 'Full Uproar marketing',
    description: 'New game releases, drops, and launches from Full Uproar Games. They built this platform but follow the same consent rules as everyone.',
  },
  fulluproar_personalization: {
    label: 'Full Uproar personalization',
    description: 'Personalized recommendations based on your purchases and library. "Because you bought X" type emails.',
  },
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

  const [user, consents, userBadges, entityConsents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        passportCode: true,
        membershipTier: true,
        identityVerified: true,
        reputationScore: true,
        gameLibrary: true,
        createdAt: true,
      },
    }),
    prisma.userConsent.findMany({
      where: { userId },
      select: { category: true, granted: true, grantedAt: true, revokedAt: true, source: true },
      orderBy: { category: 'asc' },
    }),
    prisma.userBadge.findMany({
      where: { userId, revokedAt: null },
      include: { badge: true },
      orderBy: { issuedAt: 'desc' },
    }),
    prisma.entityConsent.findMany({
      where: { userId, revokedAt: null },
      include: { entity: { select: { id: true, name: true, slug: true, type: true, city: true, state: true } } },
      orderBy: { grantedAt: 'desc' },
    }),
  ]);

  if (!user) redirect('/login');

  const consentMap = new Map(consents.map((c) => [c.category, c]));

  async function toggleConsent(formData: FormData) {
    'use server';
    const category = formData.get('category') as string;
    const currentlyGranted = formData.get('granted') === 'true';
    if (category === 'platform_functional') return;

    await prisma.userConsent.upsert({
      where: { userId_category: { userId, category } },
      create: {
        userId, category, granted: !currentlyGranted,
        grantedAt: !currentlyGranted ? new Date() : null,
        revokedAt: currentlyGranted ? new Date() : null,
        source: 'passport_settings',
      },
      update: {
        granted: !currentlyGranted,
        grantedAt: !currentlyGranted ? new Date() : undefined,
        revokedAt: currentlyGranted ? new Date() : undefined,
      },
    });
    revalidatePath('/settings');
  }

  async function revokeEntityConsent(formData: FormData) {
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
    revalidatePath('/settings');
  }

  return (
    <>
      <TitleBar left="Settings" right={user.passportCode ? `FU · ${user.passportCode}` : undefined} />
      <SecHero
        fieldNum="07"
        fieldType="Identity"
        title="Settings"
        desc="Your data, your rules. See what Afterroar knows, control who can reach you, delete anything."
      />

      <div style={{ padding: '1rem var(--pad-x) 1.5rem', ...TYPE.body, display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Identity */}
        <section>
          <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.75rem' }}>Your Identity</h2>
          <Panel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Display name', value: user.displayName || '—' },
                { label: 'Username', value: user.username || '—' },
                { label: 'Email', value: user.email },
                { label: 'Passport code', value: user.passportCode || 'Not generated' },
                { label: 'Tier', value: user.membershipTier === 'AFTERROAR_PLUS' ? 'Fugly Prime' : user.membershipTier || 'FREE' },
                { label: 'Verified', value: user.identityVerified ? 'Yes' : 'No' },
                { label: 'Reputation', value: String(user.reputationScore) },
                { label: 'Member since', value: user.createdAt.toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.58rem', margin: '0 0 0.25rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</p>
                  <p style={{ ...TYPE.body, color: 'var(--cream)', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>{value}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        {/* Badges */}
        {userBadges.length > 0 ? (
          <section>
            <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.35rem' }}>Your Badges</h2>
            <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.82rem', margin: '0 0 0.85rem' }}>
              Identity markers you&apos;ve earned, received, or collected. Portable across every app that reads your Passport.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {userBadges.map((ub) => (
                <div key={ub.id} style={{
                  background: 'var(--panel-mute)',
                  border: `1px solid ${ub.badge.color}44`,
                  padding: '0.9rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.7rem',
                }}>
                  <BadgeIcon
                    iconUrl={ub.badge.iconUrl}
                    iconEmoji={ub.badge.iconEmoji}
                    name={ub.badge.name}
                    size={52}
                    glowColor={ub.badge.color}
                  />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ ...TYPE.displayMd, fontSize: '0.85rem', margin: 0, color: ub.badge.color }}>{ub.badge.name}</p>
                    <p style={{ ...TYPE.body, fontSize: '0.72rem', color: 'var(--ink-soft)', margin: '0.2rem 0', lineHeight: 1.35 }}>{ub.badge.description}</p>
                    <p style={{ ...TYPE.mono, fontSize: '0.6rem', color: 'var(--ink-faint)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {ub.badge.issuerName || ub.badge.issuerType}{ub.badge.isLimited ? ' · limited' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Connected entities */}
        <section>
          <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.35rem' }}>Connected Stores &amp; Creators</h2>
          <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.82rem', margin: '0 0 0.85rem' }}>
            Stores and creators you&apos;ve granted access to your Passport data. Revoke any time — they lose access immediately.
          </p>
          {entityConsents.length === 0 ? (
            <EmptyState title="No connections yet" desc="Stores can generate a QR code for you to scan when they want to connect to your Passport." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
              {entityConsents.map((ec) => (
                <form key={ec.id} action={revokeEntityConsent} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.9rem 1rem',
                  background: 'var(--panel-mute)',
                  borderLeft: '2px solid var(--green)',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}>
                  <input type="hidden" name="entityId" value={ec.entity.id} />
                  <div style={{ flex: 1, minWidth: '12rem' }}>
                    <p style={{ ...TYPE.displayMd, color: 'var(--cream)', margin: '0 0 0.15rem', fontSize: '0.95rem' }}>{ec.entity.name}</p>
                    <p style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.66rem', margin: '0 0 0.35rem', letterSpacing: '0.04em' }}>
                      {ec.entity.type}
                      {ec.entity.city && ec.entity.state ? ` · ${ec.entity.city}, ${ec.entity.state}` : ''}
                      {' · since '}{new Date(ec.grantedAt).toLocaleDateString()}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {ec.scopes.map((s) => (
                        <span key={s} style={{
                          padding: '0.1rem 0.4rem',
                          background: 'var(--orange-weak)',
                          border: '1px solid var(--orange)',
                          color: 'var(--orange)',
                          ...TYPE.mono,
                          fontSize: '0.58rem',
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                        }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="danger" type="submit">Revoke</Button>
                </form>
              ))}
            </div>
          )}
        </section>

        {/* Consents */}
        <section>
          <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.35rem' }}>What Afterroar Can Talk To You About</h2>
          <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.82rem', margin: '0 0 0.85rem' }}>
            Each toggle controls a specific category. Changes take effect immediately — no 10-day propagation delay.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
            {Object.entries(CONSENT_LABELS).map(([category, { label, description }]) => {
              const consent = consentMap.get(category);
              const granted = consent?.granted ?? (category === 'platform_functional');
              const isFunctional = category === 'platform_functional';

              return (
                <form key={category} action={toggleConsent} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.9rem 1rem',
                  background: 'var(--panel-mute)',
                  gap: '1rem',
                  borderLeft: granted ? '2px solid var(--green)' : '2px solid var(--rule)',
                }}>
                  <input type="hidden" name="category" value={category} />
                  <input type="hidden" name="granted" value={String(granted)} />
                  <div style={{ flex: 1 }}>
                    <p style={{ ...TYPE.displayMd, color: 'var(--cream)', fontSize: '0.9rem', margin: '0 0 0.2rem' }}>{label}</p>
                    <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.78rem', margin: 0, lineHeight: 1.4 }}>{description}</p>
                  </div>
                  <button type="submit" disabled={isFunctional} style={{
                    padding: '0.35rem 0.9rem',
                    border: `1.5px solid ${granted ? 'var(--green)' : 'var(--rule)'}`,
                    background: granted ? 'var(--green-mute)' : 'transparent',
                    color: granted ? 'var(--green)' : 'var(--ink-soft)',
                    ...TYPE.mono,
                    fontSize: '0.68rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    cursor: isFunctional ? 'not-allowed' : 'pointer',
                    opacity: isFunctional ? 0.5 : 1,
                    minWidth: '3.5rem',
                  }}>{granted ? 'On' : 'Off'}</button>
                </form>
              );
            })}
          </div>
        </section>

        {/* Data summary */}
        <section>
          <h2 style={{ ...TYPE.mono, fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, margin: '0 0 0.35rem' }}>Your Data</h2>
          <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.82rem', margin: '0 0 0.85rem' }}>
            Everything Afterroar knows about you. Full export + delete lives on the <a href="/data" style={{ color: 'var(--orange)' }}>Data</a> page.
          </p>
          <Panel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {[
                { label: 'Game library', value: user.gameLibrary ? 'Has entries' : 'Empty' },
                { label: 'Consent grants', value: `${consents.length} categories tracked` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...TYPE.body, color: 'var(--cream)', fontSize: '0.88rem' }}>{label}</span>
                  <span style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.78rem' }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '0.75rem', marginTop: '0.85rem' }}>
              <a href="/api/export-data" style={{ color: 'var(--orange)', ...TYPE.body, fontSize: '0.85rem', textDecoration: 'underline' }}>
                Export all my data as JSON →
              </a>
            </div>
          </Panel>
        </section>

        <p style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.7rem', textAlign: 'center', marginTop: '1rem', fontStyle: 'italic', letterSpacing: '0.04em' }}>
          Per the Afterroar Credo: your data belongs to you. See it, control it, delete it anytime.
        </p>
      </div>
    </>
  );
}
