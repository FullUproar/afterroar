'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Hub-and-spoke back link. Renders nothing on /dashboard itself (where
 * the natural "back" is /, which is one tap away anyway via brand link).
 * Everywhere else inside the (passport) layout, points to /dashboard.
 */
export function BackLink() {
  const pathname = usePathname();
  if (pathname === '/dashboard') return null;
  return (
    <Link href="/dashboard" style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      color: '#9ca3af',
      fontSize: '0.85rem',
      textDecoration: 'none',
      fontWeight: 500,
      padding: '0.4rem 0',
    }}>
      <ArrowLeft size={16} strokeWidth={2} />
      Dashboard
    </Link>
  );
}
