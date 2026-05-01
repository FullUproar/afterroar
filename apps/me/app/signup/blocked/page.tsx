import { ChromeNav, PlayerCard, Workbench } from '@/app/components/card-shell';
import { TYPE, TitleBar } from '@/app/components/ui';

/**
 * <13 hard-stop page. No retry, no email capture (COPPA: any data
 * collected from a child triggers compliance overhead). Polite shutdown
 * with a back-to-home link.
 *
 * Text intentionally avoids any phrasing that suggests "if you re-enter
 * a different age it will work" — that would defeat the purpose of the
 * block cookie. We don't tell them why; we just tell them they can't.
 */
export default function BlockedPage() {
  return (
    <>
      <ChromeNav signedIn={false} />
      <Workbench>
        <PlayerCard maxWidth="26rem">
          <TitleBar left="Hold On" />
          <div
            style={{
              padding: '2rem var(--pad-x) 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.25rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2.5rem', lineHeight: 1, color: 'var(--orange)' }}>🛑</div>
            <h1
              style={{
                ...TYPE.display,
                fontSize: 'clamp(1.4rem, 4vw, 1.7rem)',
                color: 'var(--cream)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              We can&apos;t set up a Passport for you yet.
            </h1>
            <p
              style={{
                ...TYPE.body,
                fontSize: '0.9rem',
                color: 'var(--ink-soft)',
                lineHeight: 1.55,
                margin: 0,
                maxWidth: '24rem',
              }}
            >
              Afterroar is built for older players right now. We&apos;re
              working on the right way to welcome younger gamers, but
              we&apos;re not there yet.
            </p>
            <p
              style={{
                ...TYPE.body,
                fontSize: '0.85rem',
                color: 'var(--ink-faint)',
                lineHeight: 1.55,
                margin: 0,
                maxWidth: '24rem',
              }}
            >
              In the meantime, ask a parent or older sibling about the games
              you love — there&apos;s a whole world of tabletop fun waiting
              at your local game store.
            </p>
            <a
              href="https://www.fulluproar.com"
              style={{
                color: 'var(--orange)',
                ...TYPE.body,
                fontSize: '0.88rem',
                marginTop: '0.5rem',
              }}
            >
              Back to fulluproar.com
            </a>
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}
