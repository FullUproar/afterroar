import { auth } from '@/lib/auth-config';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function PassportLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      {/* Top nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        background: '#111827',
        borderBottom: '1px solid #1f2937',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link href="/" style={{
            color: '#FF8200',
            fontWeight: 900,
            fontSize: '1.1rem',
            textDecoration: 'none',
          }}>
            Afterroar
          </Link>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {[
              { href: '/library', label: 'Library' },
              { href: '/points', label: 'Points' },
              { href: '/history', label: 'History' },
              { href: '/stores', label: 'Stores' },
              { href: '/settings', label: 'Settings' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                color: '#9ca3af',
                fontSize: '0.875rem',
                textDecoration: 'none',
                fontWeight: 500,
              }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user.image && (
            <img src={user.image} alt="" width={28} height={28} style={{ borderRadius: '50%' }} />
          )}
          <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>
            {user.name || user.email}
          </span>
          <Link href="/api/auth/signout" style={{
            color: '#6b7280',
            fontSize: '0.75rem',
            textDecoration: 'underline',
          }}>
            Sign out
          </Link>
        </div>
      </nav>

      {/* Page content */}
      <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {children}
      </div>
    </div>
  );
}
