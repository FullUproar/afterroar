import Link from 'next/link';
import { ChromeNav, PlayerCard, Workbench } from '@/app/components/card-shell';
import { TitleBar, TYPE, Button } from '@/app/components/ui';

/**
 * /upgrade — tier overview. The HQ "Learn about Pro" modal links here.
 * Manus's May 11 audit caught it as a 404. Built as a static tier
 * overview rather than a full checkout flow because:
 *   - Pro / Pro+Venue billing isn't wired through Stripe yet
 *   - Connect ($49) signups go through /store (separate qualification flow)
 * Until billing is live, this page sets expectations and routes to the
 * existing surfaces.
 */
export default function UpgradePage() {
  return (
    <>
      <ChromeNav signedIn={false} />
      <Workbench>
        <PlayerCard maxWidth="32rem">
          <TitleBar left="Upgrade" />
          <div
            style={{
              padding: '1.75rem var(--pad-x) 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div>
              <h1 style={{ ...TYPE.display, fontSize: 'clamp(1.6rem, 5vw, 2rem)', color: 'var(--cream)', margin: 0, lineHeight: 1.1 }}>
                Pick your tier
              </h1>
              <p style={{ ...TYPE.body, fontSize: '0.92rem', color: 'var(--ink-soft)', margin: '0.6rem 0 0', lineHeight: 1.55 }}>
                Every Passport starts free. Upgrade unlocks public game-night
                discovery, bigger crews, and venue-owner features.
              </p>
            </div>

            <TierCard
              name="Free"
              price="$0"
              cadence="forever"
              tone="muted"
              perks={[
                'Player identity + Passport code',
                'Track your library, wishlist, loans',
                'Earn Points at participating stores',
                'Private game nights with your crew',
              ]}
            />

            <TierCard
              name="Pro"
              price="$5"
              cadence="per month"
              tone="primary"
              perks={[
                'Verified Pro badge',
                'Publish public game nights to discovery',
                'Bigger crews + unlimited rituals',
                'Photos, calendar exports, more polish',
              ]}
              footer={
                <p style={{ ...TYPE.body, fontSize: '0.82rem', color: 'var(--ink-faint)', margin: 0 }}>
                  Checkout coming soon. Want early access? Email{' '}
                  <a href="mailto:hello@afterroar.me" style={{ color: 'var(--orange)' }}>hello@afterroar.me</a>.
                </p>
              }
            />

            <TierCard
              name="Pro + Venue"
              price="$15"
              cadence="per month"
              tone="primary"
              perks={[
                'Everything in Pro',
                'Claim and manage a venue you own (home, basement, club)',
                'Customer regulars roster + check-in',
                'Library sync — show what games live at your venue',
              ]}
            />

            <TierCard
              name="Connect"
              price="$49"
              cadence="per month"
              tone="store"
              perks={[
                'For licensed game stores',
                'Read-only customer data (with consent)',
                'Event publishing + RSVP integration',
                'Connect-tier API access',
              ]}
              footer={
                <Link href="/store" style={{ color: 'var(--orange)', ...TYPE.body, fontSize: '0.88rem', fontWeight: 600, textDecoration: 'underline' }}>
                  Learn about Connect →
                </Link>
              }
            />

            <p style={{ ...TYPE.body, fontSize: '0.78rem', color: 'var(--ink-faint)', lineHeight: 1.55, margin: 0, textAlign: 'center' }}>
              Already have a Passport?{' '}
              <Link href="/login" style={{ color: 'var(--orange)' }}>Sign in</Link>
            </p>
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}

function TierCard({
  name,
  price,
  cadence,
  perks,
  tone,
  footer,
}: {
  name: string;
  price: string;
  cadence: string;
  perks: string[];
  tone: 'muted' | 'primary' | 'store';
  footer?: React.ReactNode;
}) {
  const accent = tone === 'primary' ? 'var(--orange)' : tone === 'store' ? 'var(--yellow)' : 'var(--rule)';
  const bg = tone === 'primary' ? 'rgba(255, 130, 0, 0.06)' : tone === 'store' ? 'rgba(251, 219, 101, 0.06)' : 'var(--panel-mute)';
  return (
    <div style={{ padding: '1rem 1.1rem', background: bg, border: `1.5px solid ${accent}`, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ ...TYPE.display, fontSize: '1.15rem', color: 'var(--cream)', fontWeight: 700 }}>{name}</span>
        <span>
          <span style={{ ...TYPE.display, color: accent, fontSize: '1.35rem', fontWeight: 800 }}>{price}</span>
          <span style={{ ...TYPE.body, color: 'var(--ink-faint)', fontSize: '0.82rem', marginLeft: '0.35rem' }}>{cadence}</span>
        </span>
      </div>
      <ul style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--ink-soft)', margin: 0, paddingLeft: '1.1rem', lineHeight: 1.55 }}>
        {perks.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {footer}
    </div>
  );
}
