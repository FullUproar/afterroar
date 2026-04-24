import { MarketingPage, ChromeNav } from '@/app/components/card-shell';
import { TYPE } from '@/app/components/ui';

export const metadata = {
  title: 'The Afterroar Credo',
  description: 'The five-tier stakeholder hierarchy that governs every Afterroar platform decision. Players first, always.',
};

const TIERS = [
  {
    rank: '1',
    who: 'Players',
    principle: 'Your data belongs to you. Your identity is yours. Every feature, every policy, every line of code answers to you first.',
    color: 'var(--orange)',
  },
  {
    rank: '2',
    who: 'Store owners',
    principle: 'The stores that build community deserve tools that respect them — fair pricing, no vendor lock-in, no hidden fees, no surveillance of their customers.',
    color: 'var(--cream)',
  },
  {
    rank: '3',
    who: 'The federation',
    principle: 'Afterroar belongs to its participants, not its publisher. Governance decisions prioritize the health of the network over any single member.',
    color: 'var(--cream)',
  },
  {
    rank: '4',
    who: 'The broader gaming ecosystem',
    principle: 'A rising tide lifts all ships. Afterroar should make tabletop gaming better for everyone, not just its members.',
    color: 'var(--ink)',
  },
  {
    rank: '5',
    who: 'The business',
    principle: 'Full Uproar Games, Inc. operates under this Credo like every other participant. The company comes last. If the business can\'t survive while honoring this order, the model is wrong — not the Credo.',
    color: 'var(--ink-soft)',
  },
];

export default function CredoPage() {
  return (
    <>
      <ChromeNav signedIn={false} />
      <MarketingPage>
        <p style={{ ...TYPE.mono, color: 'var(--orange)', fontSize: '0.7rem', letterSpacing: '0.32em', textTransform: 'uppercase', margin: '0 0 0.5rem', fontWeight: 700 }}>
          Afterroar · Credo
        </p>
        <h1 style={{ ...TYPE.display, fontSize: 'clamp(2rem, 6vw, 3rem)', color: 'var(--cream)', margin: '0 0 0.5rem', lineHeight: 0.95 }}>
          The Afterroar Credo
        </h1>
        <p style={{ ...TYPE.body, color: 'var(--ink-soft)', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
          Every decision on this platform — product, policy, code, business — follows this stakeholder hierarchy.
          When priorities conflict, the higher tier wins. No exceptions.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)', marginBottom: '2.5rem' }}>
          {TIERS.map((tier) => (
            <div key={tier.rank} style={{
              display: 'flex',
              gap: '1.1rem',
              alignItems: 'flex-start',
              padding: '1.1rem',
              background: 'var(--panel-mute)',
              borderLeft: `3px solid ${tier.color}`,
            }}>
              <span style={{
                ...TYPE.display,
                fontSize: '2rem',
                color: tier.color,
                lineHeight: 1,
                minWidth: '1.8rem',
                textAlign: 'center',
              }}>{tier.rank}</span>
              <div>
                <p style={{ ...TYPE.displayMd, color: tier.color, margin: '0 0 0.3rem', fontSize: '1.05rem' }}>{tier.who}</p>
                <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: 0, fontSize: '0.9rem', lineHeight: 1.65 }}>{tier.principle}</p>
              </div>
            </div>
          ))}
        </div>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ ...TYPE.displayMd, fontSize: '1.15rem', color: 'var(--cream)', marginBottom: '0.5rem' }}>What this means for you</h2>
          <ul style={{ ...TYPE.body, color: 'var(--ink-soft)', paddingLeft: '1.2rem', fontSize: '0.92rem', lineHeight: 1.7 }}>
            <li>Your data is never sold, shared with advertisers, or used for behavioral targeting.</li>
            <li>You can see everything we know about you, export it, and delete it — anytime, no questions.</li>
            <li>No store — including Full Uproar Games — gets back-door access to your data.</li>
            <li>When these principles conflict with our Terms of Service, the Credo governs.</li>
          </ul>
        </section>

        <div style={{
          borderTop: '1px solid var(--rule)',
          paddingTop: '1.5rem',
          marginTop: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <p style={{ ...TYPE.body, color: 'var(--ink-faint)', fontSize: '0.82rem', textAlign: 'center', margin: 0 }}>
            Questions about the Credo? Think something should change?{' '}
            <a href="mailto:afterroar@fulluproar.com" style={{ color: 'var(--orange)' }}>afterroar@fulluproar.com</a>
          </p>
          <div style={{ display: 'flex', gap: '1.2rem', ...TYPE.mono, fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            <a href="/" style={{ color: 'var(--orange)', textDecoration: 'none', fontWeight: 700 }}>← Home</a>
            <a href="/privacy" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>Privacy</a>
            <a href="/terms" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>Terms</a>
            <a href="/login" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>Sign in</a>
          </div>
        </div>
      </MarketingPage>
    </>
  );
}
