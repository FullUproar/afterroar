import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import {
  BookOpen, Heart, ArrowLeftRight, Coins,
  Activity, MapPin, SlidersHorizontal, Download,
  QrCode,
} from 'lucide-react';
import { TitleBar, ActionTile, TYPE } from '@/app/components/ui';

export default async function DashboardHub() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

  const [user, libraryCount, wishlistCount, pointsAgg, badgeCount, activeLoansCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true, passportCode: true, membershipTier: true, createdAt: true, gameLibrary: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { gameLibrary: true } }).then((u) => {
      if (!u?.gameLibrary) return 0;
      try { const arr = JSON.parse(u.gameLibrary); return Array.isArray(arr) ? arr.length : 0; } catch { return 0; }
    }),
    prisma.wishlistItem.count({ where: { userId } }).catch(() => 0),
    prisma.pointsLedger.aggregate({ where: { userId }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    prisma.userBadge.count({ where: { userId, revokedAt: null } }).catch(() => 0),
    prisma.gameLoan.count({ where: { userId, returnedAt: null } }).catch(() => 0),
  ]);

  const pointsTotal = pointsAgg?._sum?.amount ?? 0;
  const memberSince = user?.createdAt ? Math.floor((Date.now() - user.createdAt.getTime()) / 86400000) : 0;

  const first = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'You';
  const initials = ((user?.displayName?.split(' ')[0]?.[0] || '') + (user?.displayName?.split(' ')[1]?.[0] || user?.email?.[0] || '')).toUpperCase() || 'A';

  const tierLabel = user?.membershipTier === 'AFTERROAR_PLUS' ? 'Fugly Prime'
    : user?.membershipTier === 'CONNECT' ? 'Connect'
    : user?.membershipTier === 'STORE_OPS' ? 'Store Ops'
    : 'Passport · Free';

  return (
    <>
      <TitleBar
        left={<>Player Card</>}
        right={user?.passportCode ? `FU · ${user.passportCode}` : undefined}
      />

      {/* Hero */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'clamp(64px, 20vw, 120px) 1fr',
        gap: '1rem',
        alignItems: 'center',
        padding: '1rem var(--pad-x)',
        borderBottom: '1px solid var(--rule)',
      }}>
        <div style={{
          width: 'clamp(64px, 20vw, 120px)',
          aspectRatio: '1',
          background: 'var(--void)',
          border: '2px solid var(--orange)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cream)',
          ...TYPE.display,
          fontSize: 'clamp(1.6rem, 5vw, 3rem)',
          position: 'relative',
        }} aria-hidden="true">
          {initials}
          <span style={{
            position: 'absolute',
            bottom: '6px',
            right: '6px',
            width: '11px',
            height: '11px',
            background: 'var(--yellow)',
            border: '2px solid var(--void)',
            borderRadius: '50%',
          }} title="Active" />
        </div>
        <div>
          <h1 style={{
            ...TYPE.display,
            fontSize: 'clamp(1.6rem, 6vw, 2.9rem)',
            lineHeight: 0.95,
            margin: 0,
            color: 'var(--cream)',
          }}>{first}</h1>
          <p style={{
            ...TYPE.mono,
            fontSize: '0.7rem',
            color: 'var(--ink-soft)',
            margin: '0.5rem 0 0',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}>
            <span style={{
              color: 'var(--yellow)',
              border: '1px solid rgba(251, 219, 101, 0.3)',
              padding: '1px 6px',
              fontSize: '0.58rem',
              letterSpacing: '0.22em',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>{tierLabel}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
          </p>
        </div>
      </section>

      {/* Code chip — full-width tappable row */}
      {user?.passportCode ? (
        <Link href="/" aria-label="Show your Passport code" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '0.85rem var(--pad-x)',
          borderBottom: '1px solid var(--rule)',
          background: 'linear-gradient(180deg, rgba(255, 130, 0, 0.05), transparent)',
          color: 'inherit',
          textDecoration: 'none',
          minHeight: '60px',
        }}>
          <span style={{
            width: 34,
            height: 34,
            border: '1px dashed var(--orange)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <QrCode size={20} color="var(--orange)" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              ...TYPE.mono,
              fontSize: '0.58rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'var(--orange)',
              fontWeight: 700,
              display: 'block',
              marginBottom: '0.1rem',
            }}>Your Code</span>
            <span style={{
              ...TYPE.mono,
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'var(--yellow)',
              letterSpacing: '0.18em',
            }}>{user.passportCode}</span>
          </span>
          <span style={{
            ...TYPE.mono,
            fontSize: '0.62rem',
            color: 'var(--ink-soft)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>Tap to show →</span>
        </Link>
      ) : null}

      {/* Resource rail */}
      <section aria-label="Player stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        borderBottom: '1px solid var(--rule)',
      }} className="ar-rail-responsive">
        <RailCell k="Library" v={libraryCount.toLocaleString()} />
        <RailCell k="Wishlist" v={String(wishlistCount)} hideBelow640 />
        <RailCell k="Points" v={pointsTotal.toLocaleString()} />
        <RailCell k="Badges" v={String(badgeCount)} hideBelow640 />
        <RailCell k="Loans" v={String(activeLoansCount)} last />
      </section>

      <p style={{
        padding: '1rem var(--pad-x) 0.7rem',
        ...TYPE.mono,
        fontSize: '0.6rem',
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: 'var(--ink-soft)',
        fontWeight: 600,
        margin: 0,
      }}>Actions</p>

      <nav aria-label="Passport sections" className="ar-stagger" style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1px',
        background: 'var(--rule)',
        margin: '0 var(--pad-x)',
        border: '1px solid var(--rule)',
      }}>
        <ActionTile href="/library" n="01 · Inventory" icon={<BookOpen size={28} strokeWidth={2.2} />} title="Library" desc="Games you own. Add manually or scan a shelf." />
        <ActionTile href="/wishlist" n="02 · Desires" icon={<Heart size={28} strokeWidth={2.2} />} title="Wishlist" desc="Games you want — share with stores or family." />
        <ActionTile href="/loans" n="03 · In Transit" icon={<ArrowLeftRight size={28} strokeWidth={2.2} />} title="Loans" desc="Track games you've lent out. Never lose a copy again." />
        <ActionTile href="/points" n="04 · Ledger" icon={<Coins size={28} strokeWidth={2.2} />} title="Points" desc="Loyalty balance per store, transaction history." />
        <ActionTile href="/history" n="05 · Record" icon={<Activity size={28} strokeWidth={2.2} />} title="History" desc="Check-ins, events, tournaments — your activity log." />
        <ActionTile href="/stores" n="06 · Waypoints" icon={<MapPin size={28} strokeWidth={2.2} />} title="Stores" desc="Find stores using Afterroar near you." />
        <ActionTile href="/settings" n="07 · Identity" icon={<SlidersHorizontal size={28} strokeWidth={2.2} />} title="Settings" desc="Identity, badges, connected stores, consent toggles." />
        <ActionTile href="/data" n="08 · Sovereignty" icon={<Download size={28} strokeWidth={2.2} />} title="Data" desc="Export everything as JSON. Delete anytime." />
      </nav>

      <p style={{
        margin: '1.25rem var(--pad-x) 0',
        ...TYPE.body,
        fontStyle: 'italic',
        fontSize: '0.85rem',
        color: 'var(--ink-soft)',
        lineHeight: 1.5,
        paddingLeft: '0.9rem',
        borderLeft: '2px solid var(--orange)',
      }}>Your tabletop identity. Your rules. Your data.</p>

      <style>{`
        @media (min-width: 640px) {
          .ar-rail-responsive { grid-template-columns: repeat(5, 1fr) !important; }
          .ar-rail-hide-sm { display: block !important; }
          nav[aria-label="Passport sections"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 960px) {
          nav[aria-label="Passport sections"] { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>
    </>
  );
}

function RailCell({ k, v, hideBelow640, last }: { k: string; v: string; hideBelow640?: boolean; last?: boolean }) {
  return (
    <div className={hideBelow640 ? 'ar-rail-hide-sm' : undefined} style={{
      padding: '0.8rem 0.9rem',
      borderRight: last ? 'none' : '1px solid var(--rule)',
      display: hideBelow640 ? 'none' : 'block',
    }}>
      <p style={{
        ...TYPE.mono,
        fontSize: '0.56rem',
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: 'var(--ink-soft)',
        fontWeight: 600,
        margin: '0 0 0.3rem',
      }}>{k}</p>
      <p style={{
        ...TYPE.display,
        fontSize: '1.35rem',
        lineHeight: 1,
        color: 'var(--cream)',
        margin: 0,
      }}>{v}</p>
    </div>
  );
}
