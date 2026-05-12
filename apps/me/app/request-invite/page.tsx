import { ChromeNav, MarketingPage } from '@/app/components/card-shell';
import { TYPE } from '@/app/components/ui';
import { RequestInviteForm } from './RequestInviteForm';

export const metadata = {
  title: 'Request your Afterroar Passport',
  description:
    'Afterroar is invite-only while we ramp. Tell us about yourself and we\'ll get you a code.',
};

const CREDO_PROMISES = [
  {
    title: 'Players come first',
    body: 'Every feature, every policy, every line of code answers to you before it answers to us.',
  },
  {
    title: 'Your data is yours',
    body: "We never sell it, share it with advertisers, or use it for behavioral targeting. Stores you check in at see only that you checked in — nothing else.",
  },
  {
    title: 'Delete anytime',
    body: 'Open Settings, click Delete. 30-day grace window in case you change your mind. After that, your data is gone.',
  },
  {
    title: 'Federation over publisher',
    body: 'Full Uproar Games operates under the same rules as every other participant. We come last. If we can\'t survive while honoring this order, the business model is wrong — not the order.',
  },
];

export default function RequestInvitePage() {
  return (
    <>
      <ChromeNav signedIn={false} />
      <MarketingPage>
        <p
          style={{
            ...TYPE.mono,
            color: 'var(--orange)',
            fontSize: '0.7rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            margin: '0 0 0.5rem',
            fontWeight: 700,
          }}
        >
          Afterroar · Request access
        </p>
        <h1
          style={{
            ...TYPE.display,
            fontSize: 'clamp(1.8rem, 5.5vw, 2.6rem)',
            color: 'var(--cream)',
            margin: '0 0 0.7rem',
            lineHeight: 1.05,
          }}
        >
          Get your Passport
        </h1>
        <p
          style={{
            ...TYPE.body,
            color: 'var(--ink-soft)',
            fontSize: '0.95rem',
            lineHeight: 1.65,
            margin: '0 0 1.75rem',
            maxWidth: '32rem',
          }}
        >
          Afterroar is invite-only while we ramp. Read the four promises below — they shape every
          decision we make. If they sound right to you, drop your email and we&apos;ll send you a
          code.
        </p>

        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            background: 'var(--rule)',
            border: '1px solid var(--rule)',
            marginBottom: '2.25rem',
          }}
        >
          {CREDO_PROMISES.map((p) => (
            <div
              key={p.title}
              style={{
                display: 'flex',
                gap: '0.85rem',
                padding: '1rem 1.1rem',
                background: 'var(--panel-mute)',
                borderLeft: '3px solid var(--orange)',
              }}
            >
              <div>
                <p
                  style={{
                    ...TYPE.displayMd,
                    color: 'var(--cream)',
                    margin: '0 0 0.3rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                  }}
                >
                  {p.title}
                </p>
                <p
                  style={{
                    ...TYPE.body,
                    color: 'var(--ink-soft)',
                    margin: 0,
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                  }}
                >
                  {p.body}
                </p>
              </div>
            </div>
          ))}
        </section>

        <RequestInviteForm />

        <p
          style={{
            ...TYPE.body,
            color: 'var(--ink-faint)',
            fontSize: '0.78rem',
            lineHeight: 1.55,
            margin: '2rem 0 0',
            textAlign: 'center',
          }}
        >
          Already have a code?{' '}
          <a href="/signup" style={{ color: 'var(--orange)', fontWeight: 600 }}>
            Use it to sign up
          </a>
          .{' '}
          Already signed up?{' '}
          <a href="/login" style={{ color: 'var(--orange)', fontWeight: 600 }}>
            Sign in
          </a>
          .
        </p>
      </MarketingPage>
    </>
  );
}
