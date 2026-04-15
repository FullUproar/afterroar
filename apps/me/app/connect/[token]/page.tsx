import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ConsentApprove } from './consent-approve';
import { SCOPE_META, type ConnectScope } from '@/lib/connect-scopes';

export default async function ConsentRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();

  const req = await prisma.entityConsentRequest.findUnique({ where: { token } });

  if (!req) {
    return <Shell title="Request not found" message="This consent request doesn't exist or has been removed." />;
  }

  const entity = await prisma.afterroarEntity.findUnique({ where: { id: req.entityId } });
  if (!entity) {
    return <Shell title="Store not found" message="The store that created this request no longer exists." />;
  }

  const expired = req.expiresAt < new Date();
  const claimed = !!req.claimedAt;

  if (expired) {
    return <Shell title="Request expired" message={`Ask ${entity.name} to generate a new QR code.`} />;
  }
  if (claimed) {
    return <Shell title="Already used" message="This request has already been accepted." />;
  }

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/connect/${token}`)}`);
  }

  return (
    <main style={{ maxWidth: '32rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: '#FF8200', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
          Connect with a store
        </p>
        <h1 style={{ color: '#FBDB65', fontSize: '1.75rem', fontWeight: 900, margin: '0.5rem 0 0' }}>
          {entity.name}
        </h1>
        {entity.city && entity.state && (
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            {entity.city}, {entity.state}
          </p>
        )}
      </div>

      <div style={{
        background: '#0a0a0a',
        border: '1px solid #374151',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
      }}>
        <p style={{ color: '#e2e8f0', fontSize: '0.95rem', margin: '0 0 1rem' }}>
          <strong>{entity.name}</strong> is asking to access:
        </p>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {req.requestedScopes.map((s) => {
            const meta = SCOPE_META[s as ConnectScope];
            if (!meta) return null;
            return (
              <div key={s} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{meta.icon}</span>
                <div>
                  <p style={{ margin: 0, color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>{meta.label}</p>
                  <p style={{ margin: '0.15rem 0 0', color: '#9ca3af', fontSize: '0.8rem' }}>{meta.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        {req.note && (
          <p style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255, 130, 0, 0.06)', border: '1px solid rgba(255, 130, 0, 0.2)', borderRadius: '8px', color: '#FBDB65', fontSize: '0.8rem', fontStyle: 'italic' }}>
            &ldquo;{req.note}&rdquo;
          </p>
        )}
      </div>

      <ConsentApprove token={token} entityName={entity.name} />

      <p style={{ marginTop: '1.5rem', color: '#6b7280', fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.6 }}>
        You can revoke this access any time from your{' '}
        <Link href="/settings" style={{ color: '#FF8200' }}>Passport settings</Link>.
        Your data stays yours — see <Link href="/credo" style={{ color: '#FF8200' }}>The Credo</Link>.
      </p>
    </main>
  );
}

function Shell({ title, message }: { title: string; message: string }) {
  return (
    <main style={{ maxWidth: '28rem', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
      <h1 style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.75rem' }}>{title}</h1>
      <p style={{ color: '#9ca3af', fontSize: '0.95rem', margin: '0 0 1.5rem' }}>{message}</p>
      <Link href="/" style={{ color: '#FF8200', fontWeight: 700, fontSize: '0.9rem' }}>← Back to Passport</Link>
    </main>
  );
}
