import Link from 'next/link';
import { ChromeNav, PlayerCard, Workbench } from '@/app/components/card-shell';
import { TitleBar, TYPE } from '@/app/components/ui';

type Cadence = 'monthly' | 'yearly';

interface PageProps {
  searchParams: Promise<{ cadence?: string }>;
}

/**
 * /upgrade — tier overview for Afterroar's consumer subscriptions.
 *
 * Renders the family of tiers, with a monthly/yearly cadence toggle, and
 * routes the actual checkout through HQ (`hq.fulluproar.com/game-nights/subscribe`)
 * which owns the Stripe customer + webhook. Cross-domain by design — FU
 * is the billing system of record; Passport is identity.
 *
 * Connect ($49/mo) is shown for context but still routes to a manual
 * "Apply for Connect" flow per the locked verification policy. Store Ops
 * tiers live on the merchant onboarding flow at afterroar.store, not here.
 */
export default async function UpgradePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const cadence: Cadence = params.cadence === 'yearly' ? 'yearly' : 'monthly';

  const HQ_SUBSCRIBE = 'https://hq.fulluproar.com/game-nights/subscribe';

  // Yearly Pro+Venue is two separate yearly subscriptions stacked.
  // We show the combined sticker so the user sees what they're committing
  // to, but each is purchased separately on the subscribe flow.
  const proPriceMonthly = '$5';
  const proPriceYearly = '$49';
  const proPlusVenueMonthly = '$15'; // $5 Pro + $10 Venue
  const proPlusVenueYearly = '$148'; // $49 Pro + $99 Venue
  const connectMonthly = '$49';
  const connectYearly = '$499';

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
                Every Passport starts free. Afterroar Pro unlocks public game-night discovery,
                bigger crews, and venue-owner features.
              </p>
            </div>

            <CadenceToggle current={cadence} />

            <TierCard
              name="Free"
              price="$0"
              cadenceLabel="forever"
              tone="muted"
              perks={[
                'Player identity + Passport code',
                'Track your library, wishlist, loans',
                'Earn Points at participating stores',
                'Private game nights with your crew',
              ]}
            />

            <TierCard
              name="Afterroar Pro"
              price={cadence === 'yearly' ? proPriceYearly : proPriceMonthly}
              cadenceLabel={cadence === 'yearly' ? 'per year' : 'per month'}
              savingsNote={cadence === 'yearly' ? 'Save $11 — that\'s 2 months free' : null}
              tone="primary"
              perks={[
                'Verified Pro badge',
                'Publish public game nights to discovery',
                'Bigger crews + unlimited rituals',
                'Photos, calendar exports, more polish',
                'Identity verification (Persona) included',
              ]}
              cta={{
                label: cadence === 'yearly' ? 'Start Pro · $49/yr' : 'Start Pro · $5/mo',
                href: `${HQ_SUBSCRIBE}?tier=${cadence === 'yearly' ? 'pro_yearly' : 'pro_monthly'}`,
              }}
            />

            <TierCard
              name="Afterroar Pro + Venue"
              price={cadence === 'yearly' ? proPlusVenueYearly : proPlusVenueMonthly}
              cadenceLabel={cadence === 'yearly' ? 'per year combined' : 'per month combined'}
              savingsNote={cadence === 'yearly' ? 'Save $32 vs. monthly' : null}
              tone="primary"
              perks={[
                'Everything in Pro',
                'Claim and manage a venue you own (home, basement, club, store)',
                'Customer regulars roster + check-in',
                'Library sync — show what games live at your venue',
              ]}
              cta={{
                label: 'Add Pro + Venue',
                href: `${HQ_SUBSCRIBE}?tier=${cadence === 'yearly' ? 'venue_addon_yearly' : 'venue_addon'}`,
              }}
              footer={
                <p style={{ ...TYPE.body, fontSize: '0.72rem', color: 'var(--ink-faint)', margin: 0, lineHeight: 1.5 }}>
                  Pro+Venue is the Pro tier plus the $10/mo (or $99/yr) Venue add-on. You'll subscribe to
                  Pro first, then add Venue from your subscription page.
                </p>
              }
            />

            <TierCard
              name="Afterroar Connect"
              price={cadence === 'yearly' ? connectYearly : connectMonthly}
              cadenceLabel={cadence === 'yearly' ? 'per year' : 'per month'}
              savingsNote={cadence === 'yearly' ? 'Save $89 — that\'s 2 months free' : null}
              tone="store"
              perks={[
                'For licensed game stores',
                'Read-only customer data (with consent)',
                'Event publishing + RSVP integration',
                'Passport API + product feed access',
                'Federation-tier identity + recognition',
              ]}
              footer={
                <Link href="/store" style={{ color: 'var(--orange)', ...TYPE.body, fontSize: '0.88rem', fontWeight: 600, textDecoration: 'underline' }}>
                  Apply for Connect →
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

function CadenceToggle({ current }: { current: Cadence }) {
  const isMonthly = current === 'monthly';
  return (
    <div
      role="tablist"
      aria-label="Billing cadence"
      style={{
        display: 'inline-flex',
        alignSelf: 'center',
        padding: '4px',
        background: 'var(--panel-mute)',
        border: '1px solid var(--rule)',
        borderRadius: '999px',
      }}
    >
      <Link
        href="/upgrade?cadence=monthly"
        role="tab"
        aria-selected={isMonthly}
        style={{
          padding: '0.45rem 1.1rem',
          ...TYPE.mono,
          fontSize: '0.7rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 700,
          borderRadius: '999px',
          background: isMonthly ? 'var(--orange)' : 'transparent',
          color: isMonthly ? 'var(--void, #1a1a1a)' : 'var(--ink-soft)',
          textDecoration: 'none',
          transition: 'background 150ms ease',
        }}
      >
        Monthly
      </Link>
      <Link
        href="/upgrade?cadence=yearly"
        role="tab"
        aria-selected={!isMonthly}
        style={{
          padding: '0.45rem 1.1rem',
          ...TYPE.mono,
          fontSize: '0.7rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 700,
          borderRadius: '999px',
          background: !isMonthly ? 'var(--orange)' : 'transparent',
          color: !isMonthly ? 'var(--void, #1a1a1a)' : 'var(--ink-soft)',
          textDecoration: 'none',
          transition: 'background 150ms ease',
        }}
      >
        Yearly · 2 months free
      </Link>
    </div>
  );
}

function TierCard({
  name,
  price,
  cadenceLabel,
  savingsNote,
  perks,
  tone,
  cta,
  footer,
}: {
  name: string;
  price: string;
  cadenceLabel: string;
  savingsNote?: string | null;
  perks: string[];
  tone: 'muted' | 'primary' | 'store';
  cta?: { label: string; href: string };
  footer?: React.ReactNode;
}) {
  const accent = tone === 'primary' ? 'var(--orange)' : tone === 'store' ? 'var(--yellow)' : 'var(--rule)';
  const bg =
    tone === 'primary'
      ? 'rgba(255, 130, 0, 0.06)'
      : tone === 'store'
      ? 'rgba(251, 219, 101, 0.06)'
      : 'var(--panel-mute)';

  return (
    <div
      style={{
        padding: '1rem 1.1rem',
        background: bg,
        border: `1.5px solid ${accent}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ ...TYPE.display, fontSize: '1.15rem', color: 'var(--cream)', fontWeight: 700 }}>{name}</span>
        <span>
          <span style={{ ...TYPE.display, color: accent, fontSize: '1.35rem', fontWeight: 800 }}>{price}</span>
          <span style={{ ...TYPE.body, color: 'var(--ink-faint)', fontSize: '0.82rem', marginLeft: '0.35rem' }}>
            {cadenceLabel}
          </span>
        </span>
      </div>
      {savingsNote ? (
        <div
          style={{
            ...TYPE.mono,
            fontSize: '0.62rem',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--orange)',
            fontWeight: 700,
          }}
        >
          {savingsNote}
        </div>
      ) : null}
      <ul style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--ink-soft)', margin: 0, paddingLeft: '1.1rem', lineHeight: 1.55 }}>
        {perks.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {cta ? (
        <a
          href={cta.href}
          style={{
            display: 'inline-block',
            marginTop: '0.3rem',
            padding: '0.65rem 1.1rem',
            background: accent,
            color: 'var(--void, #1a1a1a)',
            ...TYPE.display,
            fontSize: '0.88rem',
            fontWeight: 700,
            textDecoration: 'none',
            textAlign: 'center',
          }}
        >
          {cta.label}
        </a>
      ) : null}
      {footer}
    </div>
  );
}
