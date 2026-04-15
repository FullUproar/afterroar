import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ConnectLanding } from './connect-landing';

/**
 * /store — Afterroar Connect dashboard entry point.
 *
 * - Signed out → public pitch + "Apply" CTA
 * - Signed in, no entity → application form
 * - Signed in, pending entity → "under review" state
 * - Signed in, approved entity → dashboard
 */
export default async function StorePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return <ConnectLanding signedIn={false} />;
  }

  const memberships = await prisma.entityMember.findMany({
    where: { userId: session.user.id },
    include: { entity: true },
  });

  const approved = memberships.find((m) => m.entity.status === 'approved');
  if (approved) {
    // Redirect to the dashboard for the first approved entity
    return (
      <main style={{ maxWidth: '48rem', margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h1 style={{ color: '#FF8200', fontSize: '1.75rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
          Welcome back, {approved.entity.name}
        </h1>
        <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
          Your Connect dashboard is being built. For now, you can manage the basics below.
        </p>
        <Link href={`/store/${approved.entity.slug}`} style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          background: '#FF8200',
          color: '#0a0a0a',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 700,
        }}>
          Open dashboard →
        </Link>
      </main>
    );
  }

  const pending = memberships.find((m) => m.entity.status === 'pending');
  if (pending) {
    return (
      <main style={{ maxWidth: '36rem', margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', lineHeight: 1, marginBottom: '1rem' }}>⏳</div>
        <h1 style={{ color: '#FF8200', fontSize: '1.75rem', fontWeight: 900, margin: '0 0 0.75rem' }}>
          Application under review
        </h1>
        <p style={{ color: '#e2e8f0', marginBottom: '1rem' }}>
          <strong style={{ color: '#FBDB65' }}>{pending.entity.name}</strong> is in the queue.
          We&apos;re manually approving early Connect partners so we can make sure every store gets a solid onboarding.
        </p>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Expect to hear back within 1-2 business days. Questions?{' '}
          <a href="mailto:afterroar@fulluproar.com" style={{ color: '#FF8200' }}>afterroar@fulluproar.com</a>
        </p>
        <Link href="/" style={{ color: '#6b7280', fontSize: '0.85rem' }}>← Back to Passport</Link>
      </main>
    );
  }

  // Signed in but no entity yet
  return <ConnectLanding signedIn={true} />;
}
