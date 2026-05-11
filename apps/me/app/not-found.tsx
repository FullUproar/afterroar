import Link from 'next/link';
import { ChromeNav, PlayerCard, Workbench } from '@/app/components/card-shell';
import { TitleBar, TYPE, Button } from '@/app/components/ui';

/**
 * Branded 404 — replaces Next.js's bare default so a typo in a URL
 * still gives the user a way back into the product. Manus flagged the
 * default as a "rough recovery experience" during the May 11 audit.
 */
export default function NotFound() {
  return (
    <>
      <ChromeNav signedIn={false} />
      <Workbench>
        <PlayerCard maxWidth="28rem">
          <TitleBar left="Lost" />
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
            <div style={{ fontSize: '3rem', lineHeight: 1, color: 'var(--orange)' }}>404</div>
            <h1
              style={{
                ...TYPE.display,
                fontSize: 'clamp(1.4rem, 5vw, 1.8rem)',
                color: 'var(--cream)',
                margin: 0,
              }}
            >
              That page isn&apos;t here.
            </h1>
            <p
              style={{
                ...TYPE.body,
                fontSize: '0.9rem',
                color: 'var(--ink-soft)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              The link may be wrong, or the page moved. Your Passport hasn&apos;t gone anywhere.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%' }}>
              <Button href="/">Back to home</Button>
              <Link
                href="/login"
                style={{
                  ...TYPE.body,
                  fontSize: '0.85rem',
                  color: 'var(--orange)',
                  textDecoration: 'underline',
                }}
              >
                Sign in
              </Link>
            </div>
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}
