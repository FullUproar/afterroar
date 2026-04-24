'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function CardFootClient() {
  const pathname = usePathname() || '';
  const onDashboard = pathname === '/dashboard' || pathname === '/dashboard/';

  return (
    <footer style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.9rem var(--pad-x)',
      marginTop: '1rem',
      borderTop: '1px solid var(--rule)',
      fontFamily: 'var(--font-mono), ui-monospace, Menlo, monospace',
      fontSize: '0.62rem',
      color: 'var(--ink-faint)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      flexWrap: 'wrap',
    }}>
      {!onDashboard ? (
        <Link href="/dashboard" style={{
          color: 'var(--orange)',
          textDecoration: 'none',
          fontWeight: 700,
        }}>← Player Card</Link>
      ) : (
        <span>© Afterroar {new Date().getFullYear()}</span>
      )}
      <nav style={{ display: 'flex', gap: '0.9rem' }}>
        <Link href="/credo" style={{ color: 'var(--orange)', textDecoration: 'none' }}>The Credo</Link>
        <Link href="/privacy" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>Privacy</Link>
        <Link href="/terms" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>Terms</Link>
      </nav>
    </footer>
  );
}
