import Link from 'next/link';
import type { ReactNode } from 'react';
import { TYPE } from './ui';
import { CardFootClient } from './card-foot-client';

/**
 * ChromeNav — the dark top bar that sits above the Player Card.
 * Shared across signed-in passport surfaces.
 */
export function ChromeNav({ email, signedIn = true }: { email?: string | null; signedIn?: boolean }) {
  return (
    <nav style={{
      background: '#111827',
      borderBottom: '1px solid #1f2937',
      padding: '0.7rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...TYPE.mono,
      fontSize: '0.72rem',
      color: '#9ca3af',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <Link href="/" style={{
        color: 'var(--orange)',
        fontWeight: 800,
        fontSize: '0.95rem',
        fontFamily: 'var(--font-display), sans-serif',
        letterSpacing: '-0.01em',
        textDecoration: 'none',
      }}>
        afterroar
      </Link>
      {signedIn ? (
        <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {email ? (
            <span style={{
              color: 'var(--yellow)',
              padding: '2px 7px',
              border: '1px solid rgba(251, 219, 101, 0.3)',
              borderRadius: '999px',
              fontSize: '0.62rem',
              maxWidth: '20ch',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{email}</span>
          ) : null}
          <Link href="/api/auth/signout" style={{ color: '#6b7280', textDecoration: 'underline', textUnderlineOffset: '3px', fontSize: '0.7rem' }}>
            Sign out
          </Link>
        </span>
      ) : (
        <span style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <Link href="/credo" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.7rem' }}>The Credo</Link>
          <Link href="/login" style={{ color: 'var(--orange)', textDecoration: 'none', fontSize: '0.7rem', fontWeight: 700 }}>Sign in</Link>
        </span>
      )}
    </nav>
  );
}

/**
 * Workbench — the dark canvas the card sits inside.
 */
export function Workbench({ children }: { children: ReactNode }) {
  return (
    <main style={{
      minHeight: 'calc(100vh - 3rem)',
      padding: '1.25rem 0.75rem 3rem',
      background: 'radial-gradient(ellipse at 50% -10%, rgba(255, 130, 0, 0.07), transparent 50%), var(--void)',
      display: 'flex',
      justifyContent: 'center',
    }}>
      {children}
    </main>
  );
}

/**
 * PlayerCard — the orange-framed rectangle that wraps every signed-in surface.
 */
export function PlayerCard({ children, maxWidth = '66rem' }: { children: ReactNode; maxWidth?: string }) {
  return (
    <article className="ar-card-in" style={{
      width: '100%',
      maxWidth,
      background: 'var(--panel)',
      border: 'var(--frame-w) solid var(--orange)',
      position: 'relative',
      boxShadow: '0 24px 60px -24px rgba(0, 0, 0, 0.95)',
    }}>
      <span className="ar-corner tl" />
      <span className="ar-corner tr" />
      <span className="ar-corner bl" />
      <span className="ar-corner br" />
      <span className="ar-trim" />
      <div style={{ position: 'relative', zIndex: 2 }}>
        {children}
      </div>
    </article>
  );
}

/**
 * CardFoot — bottom strip with auto-detecting back link + legal nav.
 */
export function CardFoot() {
  return <CardFootClient />;
}

/**
 * MarketingPage — centered content container for legal/marketing pages (no Player Card).
 */
export function MarketingPage({ children, maxWidth = '44rem' }: { children: ReactNode; maxWidth?: string }) {
  return (
    <main style={{
      maxWidth,
      margin: '0 auto',
      padding: '2.5rem 1.5rem 4rem',
      color: 'var(--ink)',
      lineHeight: 1.7,
      fontFamily: 'var(--font-body), system-ui, sans-serif',
    }}>
      {children}
    </main>
  );
}
