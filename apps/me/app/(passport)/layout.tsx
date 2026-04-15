import { auth } from '@/lib/auth-config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BackLink } from './back-link';

export default async function PassportLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      {/* Brand bar — minimal: home link, who's signed in, sign out */}
      <nav style={{
        background: '#111827',
        borderBottom: '1px solid #1f2937',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
        }}>
          <Link href="/" style={{
            color: '#FF8200',
            fontWeight: 900,
            fontSize: '1.1rem',
            textDecoration: 'none',
          }}>
            Afterroar
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" width={28} height={28} style={{ borderRadius: '50%' }} />
            )}
            <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>
              {user.name || user.email}
            </span>
            <Link href="/api/auth/signout" style={{
              color: '#6b7280',
              fontSize: '0.75rem',
              textDecoration: 'underline',
              marginLeft: '0.25rem',
            }}>
              Sign out
            </Link>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '1rem 1.5rem 2rem' }}>
        <BackLink />
        <div style={{ marginTop: '0.5rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
