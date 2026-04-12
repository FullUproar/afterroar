import { auth } from '@/lib/auth-config';
import Link from 'next/link';

export default async function PassportLanding() {
  const session = await auth();
  const user = session?.user;

  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{
        maxWidth: '32rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 900,
          color: '#FF8200',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          Afterroar
        </h1>

        <p style={{
          fontSize: '1.25rem',
          color: '#e2e8f0',
          lineHeight: 1.6,
          margin: 0,
        }}>
          Your gaming identity, your rules.
        </p>

        {user ? (
          <div style={{
            padding: '1.5rem',
            background: 'rgba(16, 185, 129, 0.08)',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}>
              {user.image && (
                <img
                  src={user.image}
                  alt=""
                  width={40}
                  height={40}
                  style={{ borderRadius: '50%' }}
                />
              )}
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: '#10b981', fontWeight: 700, margin: 0, fontSize: '1rem' }}>
                  Signed in as {user.name || user.email}
                </p>
                <p style={{ color: '#6b7280', margin: 0, fontSize: '0.8rem' }}>
                  {user.email}
                </p>
              </div>
            </div>
            <p style={{
              color: '#9ca3af',
              fontSize: '0.875rem',
              margin: 0,
              lineHeight: 1.5,
            }}>
              Your Passport is active. Settings, library, points, and
              data management pages are coming soon.
            </p>
            <Link
              href="/api/auth/signout"
              style={{
                color: '#6b7280',
                fontSize: '0.8rem',
                textDecoration: 'underline',
              }}
            >
              Sign out
            </Link>
          </div>
        ) : (
          <>
            <p style={{
              fontSize: '1rem',
              color: '#9ca3af',
              lineHeight: 1.6,
              margin: 0,
            }}>
              One login across every store and app in the Afterroar ecosystem.
              See your data. Control your consent. Delete anytime.
            </p>

            <Link
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.875rem 2rem',
                background: '#FF8200',
                color: '#0a0a0a',
                fontWeight: 900,
                fontSize: '1rem',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              Create your Passport
            </Link>
          </>
        )}

        <div style={{
          marginTop: '2rem',
          fontSize: '0.75rem',
          color: '#6b7280',
        }}>
          Powered by Afterroar • Founded February 2025
        </div>
      </div>
    </main>
  );
}
