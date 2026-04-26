import Link from 'next/link';
import { MarketingPage, ChromeNav } from '@/app/components/card-shell';
import { TYPE } from '@/app/components/ui';
import { auth } from '@/lib/auth-config';

export const metadata = {
  title: 'What is an Afterroar Passport?',
  description:
    'Your portable tabletop gaming profile — collection, wishlist, points, badges, and stores. One identity, every game store, no platform lock-in.',
};

/* ------------------------------------------------------------------ */
/*  Passport 101 — explainer                                           */
/*  UX rule: show the product, don't narrate it. Each section uses a  */
/*  mocked visual element that *looks like* the real surface, with a  */
/*  short caption that explains the value. We're teaching the user    */
/*  what Passport is by demonstrating, not by writing paragraphs.     */
/* ------------------------------------------------------------------ */

const PILLAR_TONE = {
  orange: 'var(--orange)',
  cream: 'var(--cream)',
  ink: 'var(--ink)',
} as const;

export default async function Passport101Page() {
  const session = await auth();
  const signedIn = !!session?.user?.id;

  return (
    <>
      <ChromeNav signedIn={signedIn} />
      <MarketingPage>
        {/* ── Hero ── */}
        <p style={{ ...TYPE.mono, color: 'var(--orange)', fontSize: '0.7rem', letterSpacing: '0.32em', textTransform: 'uppercase', margin: '0 0 0.5rem', fontWeight: 700 }}>
          Afterroar · Passport 101
        </p>
        <h1 style={{ ...TYPE.display, fontSize: 'clamp(2rem, 6vw, 3rem)', color: 'var(--cream)', margin: '0 0 0.75rem', lineHeight: 0.95 }}>
          Your tabletop<br />gaming, in one place.
        </h1>
        <p style={{ ...TYPE.body, color: 'var(--ink-soft)', marginBottom: '2.5rem', fontSize: '1rem', lineHeight: 1.6 }}>
          A Passport is your portable identity for tabletop gaming. Your collection, your wishlist,
          your points, your badges, your local stores — all in one place that <em>you</em> control.
          It works at any Afterroar store, with no app to install at the counter.
        </p>

        {/* ── Mocked Passport card hero ── */}
        <PassportCardMock />

        {/* ── Three pillars ── */}
        <h2 style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.65rem', letterSpacing: '0.28em', textTransform: 'uppercase', margin: '2.5rem 0 1rem', fontWeight: 700 }}>
          What you do with it
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)', marginBottom: '2.5rem' }}>
          <Pillar
            num="01"
            tone={PILLAR_TONE.orange}
            title="Carry your shelf"
            desc="Track every game you own and want. Stores can recommend matches, friends know what to gift, you stop double-buying."
            mock={<LibraryMock />}
          />
          <Pillar
            num="02"
            tone={PILLAR_TONE.cream}
            title="Get recognized at stores"
            desc="Walk into any Afterroar store. They see your code, you earn points, no rewards-card scavenger hunt."
            mock={<CheckinMock />}
          />
          <Pillar
            num="03"
            tone={PILLAR_TONE.ink}
            title="Connect with players"
            desc="Find a crew, get pinged when game night fires up, earn badges that travel with you across stores and events."
            mock={<BadgesMock />}
          />
        </div>

        {/* ── Data sovereignty ── */}
        <h2 style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.65rem', letterSpacing: '0.28em', textTransform: 'uppercase', margin: '2.5rem 0 1rem', fontWeight: 700 }}>
          Your data is yours
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)', marginBottom: '0.85rem' }}>
          <PrincipleCard glyph="◇" title="Never sold" desc="Not to advertisers, not to publishers, not to anyone." />
          <PrincipleCard glyph="◇" title="Always visible" desc="See exactly what stores can see. Revoke any time." />
          <PrincipleCard glyph="◇" title="Always portable" desc="Export everything. Take your shelf to another platform tomorrow if you want." />
        </div>
        <p style={{ ...TYPE.body, color: 'var(--ink-faint)', fontSize: '0.82rem', margin: '0 0 2.5rem' }}>
          The full philosophy lives in <Link href="/credo" style={{ color: 'var(--orange)' }}>The Credo</Link> —
          the five-tier hierarchy that governs every decision on this platform.
        </p>

        {/* ── What it isn't ── */}
        <h2 style={{ ...TYPE.mono, color: 'var(--ink-soft)', fontSize: '0.65rem', letterSpacing: '0.28em', textTransform: 'uppercase', margin: '2.5rem 0 1rem', fontWeight: 700 }}>
          What this isn&apos;t
        </h2>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          marginBottom: '2.5rem',
        }}>
          <NotThis
            label="Not a social network."
            body="No feeds, no follower counts, no doomscrolling. You connect with players you already know, plus stores you actually visit."
          />
          <NotThis
            label="Not a data-mining product."
            body="We don't sell your data, ever. The business model is store software, not your attention."
          />
          <NotThis
            label="Not pay-to-win."
            body="Passport is free. Stores pay us for tools that make their counters work better — your loyalty isn't the product."
          />
          <NotThis
            label="Not lock-in."
            body="Every byte of your Passport is exportable. Move to a different platform tomorrow and you take your shelf with you."
          />
        </div>

        {/* ── CTA ── */}
        <div style={{
          borderTop: '1px solid var(--rule)',
          paddingTop: '2rem',
          marginTop: '1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <h2 style={{ ...TYPE.display, fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: 'var(--cream)', margin: 0, textAlign: 'center', lineHeight: 1.1 }}>
            {signedIn ? 'Open your Passport' : 'Get your Passport'}
          </h2>
          <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.92rem', textAlign: 'center', margin: 0, maxWidth: '36ch' }}>
            {signedIn
              ? 'Your Passport is already set up. Jump back in.'
              : 'Free, takes about a minute. Email + password or Google.'}
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {signedIn ? (
              <Link href="/" style={ctaPrimary}>
                Open Passport →
              </Link>
            ) : (
              <>
                <Link href="/signup" style={ctaPrimary}>
                  Create my Passport
                </Link>
                <Link href="/login" style={ctaSecondary}>
                  Already have one
                </Link>
              </>
            )}
          </div>
        </div>

        {/* ── Footer mono links ── */}
        <div style={{
          marginTop: '2.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--rule)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.2rem',
          justifyContent: 'center',
          ...TYPE.mono,
          fontSize: '0.7rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>
          <Link href="/" style={{ color: 'var(--orange)', textDecoration: 'none', fontWeight: 700 }}>← Home</Link>
          <Link href="/credo" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>Credo</Link>
          <Link href="/stores" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>Stores</Link>
          <Link href="/privacy" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>Privacy</Link>
        </div>
      </MarketingPage>
    </>
  );
}

/* ============================================================
 * Visual building blocks — kept inline so the page is self-contained
 * ============================================================ */

const ctaPrimary: React.CSSProperties = {
  padding: '0.95rem 1.5rem',
  background: 'var(--orange)',
  color: 'var(--void, #1a1a1a)',
  ...TYPE.display,
  fontSize: '0.95rem',
  fontWeight: 800,
  textDecoration: 'none',
  letterSpacing: '0.02em',
};
const ctaSecondary: React.CSSProperties = {
  padding: '0.95rem 1.5rem',
  background: 'transparent',
  color: 'var(--orange)',
  border: '1.5px solid var(--orange)',
  ...TYPE.display,
  fontSize: '0.95rem',
  fontWeight: 700,
  textDecoration: 'none',
  letterSpacing: '0.02em',
};

function PassportCardMock() {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, #1a1a1f 0%, #0e0e12 100%)',
      border: '1.5px solid var(--rule-hi)',
      padding: '1.4rem 1.4rem 1.1rem',
      maxWidth: '420px',
      margin: '0 auto 1rem',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 2px 0 rgba(255, 130, 0, 0.12) inset',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...TYPE.mono, color: 'var(--orange)', fontSize: '0.55rem', letterSpacing: '0.32em', textTransform: 'uppercase', margin: 0, fontWeight: 700 }}>
            Afterroar Passport
          </p>
          <p style={{ ...TYPE.display, color: 'var(--cream)', fontSize: '1.4rem', margin: '0.3rem 0 0.6rem', lineHeight: 1 }}>
            Pat C.
          </p>
          <code style={{
            ...TYPE.mono,
            color: 'var(--orange)',
            fontSize: '0.95rem',
            letterSpacing: '0.12em',
            fontWeight: 700,
            display: 'inline-block',
            padding: '0.35rem 0.65rem',
            background: 'rgba(255, 130, 0, 0.08)',
            border: '1px solid rgba(255, 130, 0, 0.25)',
          }}>
            G7K-MR4N
          </code>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.85rem', alignItems: 'center' }}>
            {['🦁', '🎲', '⚡'].map((b, i) => (
              <span key={i} style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--panel-mute)',
                border: '1px solid var(--rule)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
              }}>{b}</span>
            ))}
            <span style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.6rem', letterSpacing: '0.12em', marginLeft: '0.2rem' }}>
              + 4 more
            </span>
          </div>
        </div>
        <div style={{
          width: 80,
          height: 80,
          background: 'var(--cream)',
          padding: '6px',
          flexShrink: 0,
        }}>
          {/* Stylised QR — just a grid of squares to suggest one without rendering a real one */}
          <div style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: 'repeat(7, 1fr)',
            gap: '1px',
          }}>
            {QR_PATTERN.map((on, i) => (
              <div key={i} style={{ background: on ? '#0a0a0a' : 'transparent' }} />
            ))}
          </div>
        </div>
      </div>
      <p style={{
        ...TYPE.mono,
        fontSize: '0.6rem',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--ink-faint)',
        margin: '1rem 0 0',
        textAlign: 'center',
      }}>
        Show this anywhere — your code travels with you
      </p>
    </div>
  );
}

// Static pseudo-QR pattern, picked by hand to look credible at this scale
const QR_PATTERN = [
  1,1,1,0,1,1,1,
  1,0,1,0,0,0,1,
  1,0,1,1,0,0,1,
  0,1,0,1,1,0,0,
  1,1,0,0,1,0,1,
  1,0,0,1,0,0,0,
  1,1,1,0,0,1,1,
];

function Pillar({ num, tone, title, desc, mock }: {
  num: string;
  tone: string;
  title: string;
  desc: string;
  mock: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      padding: '1.4rem 1.25rem',
      background: 'var(--panel-mute)',
      borderTop: `2px solid ${tone}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
        <span style={{ ...TYPE.mono, color: tone, fontSize: '0.65rem', letterSpacing: '0.22em', fontWeight: 700 }}>
          {num}
        </span>
        <h3 style={{ ...TYPE.displayMd, color: tone, fontSize: '1.1rem', margin: 0 }}>{title}</h3>
      </div>
      {mock}
      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.85rem', lineHeight: 1.55, margin: 0 }}>
        {desc}
      </p>
    </div>
  );
}

function LibraryMock() {
  const games = [
    { title: 'Catan', meta: 'Owned' },
    { title: 'Pandemic', meta: 'Owned · loaned to Sam' },
    { title: 'Wingspan', meta: 'Wishlist' },
  ];
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--rule)', padding: '0.4rem 0' }}>
      {games.map((g, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0.45rem 0.7rem',
          borderBottom: i < games.length - 1 ? '1px solid var(--rule-faint, var(--rule))' : 'none',
        }}>
          <span style={{ ...TYPE.body, color: 'var(--cream)', fontSize: '0.78rem', fontWeight: 500 }}>{g.title}</span>
          <span style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.62rem', letterSpacing: '0.06em' }}>{g.meta}</span>
        </div>
      ))}
    </div>
  );
}

function CheckinMock() {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--rule)', padding: '0.7rem 0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <p style={{ ...TYPE.body, color: 'var(--cream)', fontSize: '0.82rem', margin: 0, fontWeight: 600 }}>
          FU Games &amp; Café
        </p>
        <span style={{ ...TYPE.mono, color: 'var(--ink-faint)', fontSize: '0.6rem', letterSpacing: '0.06em' }}>2h ago</span>
      </div>
      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.74rem', margin: '0.2rem 0 0' }}>
        Checked in. <span style={{ color: 'var(--orange)' }}>+15 points</span>
      </p>
    </div>
  );
}

function BadgesMock() {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--rule)', padding: '0.7rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
      {['🦁', '🎲', '⚡', '🏆'].map((b, i) => (
        <div key={i} style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: '50%',
          background: 'var(--panel-mute)',
          border: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
        }}>
          {b}
        </div>
      ))}
    </div>
  );
}

function PrincipleCard({ glyph, title, desc }: { glyph: string; title: string; desc: string }) {
  return (
    <div style={{
      padding: '1rem',
      background: 'var(--panel-mute)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
    }}>
      <span style={{ color: 'var(--orange)', fontSize: '1.1rem', lineHeight: 1 }}>{glyph}</span>
      <p style={{ ...TYPE.displayMd, color: 'var(--cream)', margin: 0, fontSize: '0.95rem' }}>{title}</p>
      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.78rem', lineHeight: 1.5, margin: 0 }}>{desc}</p>
    </div>
  );
}

function NotThis({ label, body }: { label: string; body: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.7rem',
      padding: '0.75rem 0.85rem',
      borderLeft: '2px solid var(--rule-hi)',
    }}>
      <span style={{ color: 'var(--ink-faint)', fontSize: '1rem', lineHeight: 1.2, flexShrink: 0 }}>×</span>
      <div>
        <p style={{ ...TYPE.body, color: 'var(--cream)', margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>{label}</p>
        <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0.15rem 0 0', fontSize: '0.82rem', lineHeight: 1.55 }}>{body}</p>
      </div>
    </div>
  );
}
