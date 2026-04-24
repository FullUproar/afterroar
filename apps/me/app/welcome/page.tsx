import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { BadgeIcon } from '@/app/components/badge-icon';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Heart, ArrowLeftRight, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { ChromeNav, Workbench, PlayerCard } from '@/app/components/card-shell';
import { TitleBar, TYPE, Button } from '@/app/components/ui';

interface WelcomePageProps {
  searchParams: Promise<{ event?: string; ref?: string }>;
}

async function issueBadgeBySlug(userId: string, slug: string, reason: string): Promise<{ name: string; emoji: string } | null> {
  const badge = await prisma.passportBadge.findUnique({ where: { slug } });
  if (!badge || badge.retiredAt) return null;
  if (badge.maxSupply && badge.totalIssued >= badge.maxSupply) return null;

  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  });
  if (existing && !existing.revokedAt) {
    return { name: badge.name, emoji: badge.iconEmoji || '🏅' };
  }

  try {
    await prisma.$transaction([
      prisma.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        create: { userId, badgeId: badge.id, issuedBy: 'afterroar', reason },
        update: { revokedAt: null },
      }),
      prisma.passportBadge.update({
        where: { id: badge.id },
        data: { totalIssued: { increment: 1 } },
      }),
    ]);
    return { name: badge.name, emoji: badge.iconEmoji || '🏅' };
  } catch {
    return null;
  }
}

async function ensurePioneerBadge(userId: string): Promise<void> {
  await issueBadgeBySlug(userId, 'passport-pioneer', 'Early Passport adopter');
}

async function issueEventBadge(userId: string, eventSlug: string) {
  const badge = await prisma.passportBadge.findUnique({ where: { slug: eventSlug } });
  const reason = badge ? `Event: ${badge.name}` : `Event: ${eventSlug}`;
  return issueBadgeBySlug(userId, eventSlug, reason);
}

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user?.id) {
    const event = params.event ? `?event=${encodeURIComponent(params.event)}` : '';
    redirect(`/login?callbackUrl=${encodeURIComponent(`/welcome${event}`)}`);
  }

  const userId = session.user.id;

  await ensurePioneerBadge(userId);

  if (params.event) {
    await issueEventBadge(userId, params.event);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, passportCode: true, createdAt: true },
  });

  const userBadges = await prisma.userBadge.findMany({
    where: { userId, revokedAt: null },
    include: { badge: true },
    orderBy: { issuedAt: 'desc' },
    take: 10,
  });

  const firstName = user?.displayName?.split(' ')[0] || 'friend';
  const isFreshPassport = user?.createdAt && (Date.now() - user.createdAt.getTime() < 60_000);

  return (
    <>
      <ChromeNav email={session.user.email} />
      <Workbench>
        <PlayerCard maxWidth="34rem">
          <TitleBar left="Welcome" right={user?.passportCode ? `FU · ${user.passportCode}` : undefined} />

          <div style={{
            padding: '1.5rem var(--pad-x)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            alignItems: 'center',
            textAlign: 'center',
          }}>
            <div>
              <p style={{ ...TYPE.mono, color: 'var(--orange)', fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', margin: 0, fontWeight: 700 }}>
                {isFreshPassport ? 'Your Passport is live' : 'Good to see you'}
              </p>
              <h1 style={{ ...TYPE.display, fontSize: 'clamp(1.8rem, 6vw, 2.5rem)', color: 'var(--cream)', margin: '0.4rem 0 0', lineHeight: 1 }}>
                {isFreshPassport ? `Welcome, ${firstName}!` : `Hey again, ${firstName}!`}
              </h1>
              <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.95rem', margin: '0.6rem 0 0' }}>
                {isFreshPassport
                  ? 'Your Afterroar Passport is ready. Your tabletop identity, your data, your rules.'
                  : 'Good to see you back. Here\'s where you stand.'}
              </p>
            </div>

            {user?.passportCode ? (
              <div style={{ width: '100%', padding: '1rem', background: 'var(--panel)', border: '1px dashed var(--orange)', textAlign: 'center' }}>
                <p style={{ ...TYPE.mono, color: 'var(--orange)', fontSize: '0.6rem', letterSpacing: '0.28em', textTransform: 'uppercase', margin: '0 0 0.3rem', fontWeight: 700 }}>
                  Your Passport Code
                </p>
                <p style={{ ...TYPE.mono, color: 'var(--yellow)', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.2em', margin: 0 }}>
                  {user.passportCode}
                </p>
                <p style={{ ...TYPE.body, color: 'var(--ink-faint)', fontSize: '0.72rem', margin: '0.35rem 0 0', fontStyle: 'italic' }}>
                  Show this at participating stores.
                </p>
              </div>
            ) : null}

            {userBadges.length > 0 ? (
              <div style={{ width: '100%' }}>
                <p style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.62rem', letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 0.6rem', fontWeight: 600 }}>
                  {isFreshPassport ? 'You just earned:' : 'Your badges:'}
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: userBadges.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '0.55rem',
                }}>
                  {userBadges.map((ub) => (
                    <div key={ub.id} style={{
                      background: 'var(--panel-mute)',
                      border: `1px solid ${ub.badge.color}44`,
                      padding: '0.85rem 0.6rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.45rem',
                    }}>
                      <BadgeIcon iconUrl={ub.badge.iconUrl} iconEmoji={ub.badge.iconEmoji} name={ub.badge.name} size={56} glowColor={ub.badge.color} />
                      <p style={{ ...TYPE.displayMd, color: ub.badge.color, fontSize: '0.82rem', margin: 0 }}>{ub.badge.name}</p>
                      {ub.badge.isLimited ? (
                        <p style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.58rem', margin: 0, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Limited</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ width: '100%' }}>
              <p style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.62rem', letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 0.6rem', fontWeight: 600, textAlign: 'left' }}>
                What now?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
                {[
                  { href: '/library', icon: <BookOpen size={16} />, title: 'Add games to your library', desc: 'Snap a photo of your shelf — Fugly will read the boxes.' },
                  { href: '/wishlist', icon: <Heart size={16} />, title: 'Build your wishlist', desc: 'Stores will see this (if you say so) when you walk in.' },
                  { href: '/loans', icon: <ArrowLeftRight size={16} />, title: 'Track games you\'ve lent out', desc: 'Never forget who has your copy of Terraforming Mars.' },
                  { href: '/settings', icon: <SlidersHorizontal size={16} />, title: 'Control what you share', desc: 'Every permission is off by default. You decide who sees what.' },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="ar-lstripe" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    background: 'var(--panel-mute)',
                    textDecoration: 'none',
                    color: 'var(--cream)',
                    textAlign: 'left',
                  }}>
                    <span style={{ color: 'var(--orange)', flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...TYPE.displayMd, color: 'var(--cream)', margin: 0, fontSize: '0.88rem' }}>{item.title}</p>
                      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0.15rem 0 0', fontSize: '0.74rem' }}>{item.desc}</p>
                    </div>
                    <ArrowRight size={14} color="var(--orange)" style={{ flexShrink: 0 }} />
                  </Link>
                ))}
              </div>
            </div>

            <Button href="/">Go to Passport →</Button>

            <p style={{ ...TYPE.body, color: 'var(--ink-faint)', fontSize: '0.75rem', margin: 0, textAlign: 'center' }}>
              Your data belongs to you. <Link href="/credo" style={{ color: 'var(--orange)' }}>The Credo</Link> says so. And we mean it.
            </p>
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}
