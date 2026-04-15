import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShopifyClaim } from './claim-form';

/**
 * /integrations/shopify/claim?shop=...&token=...&scope=...
 *
 * Reached when a merchant installs the Shopify app from the App Store
 * (no entityId at install time). They sign into Afterroar, then pick
 * which of their entities should own this Shopify connection.
 *
 * IMPORTANT: the access token is passed via query string here, then
 * persisted server-side on claim. It's only valid until the merchant
 * completes the claim — we don't store it elsewhere. Re-installation
 * is cheap if this page is closed.
 */
export default async function ShopifyClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; token?: string; scope?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user?.id) {
    const sp = new URLSearchParams(params as Record<string, string>).toString();
    redirect(`/login?callbackUrl=${encodeURIComponent(`/integrations/shopify/claim?${sp}`)}`);
  }

  const { shop, token, scope } = params;
  if (!shop || !token) {
    return (
      <Shell title="Shopify install incomplete" message="Re-install the app from your Shopify admin to try again." />
    );
  }

  // List the entities this user owns/manages
  const memberships = await prisma.entityMember.findMany({
    where: { userId: session.user.id, role: { in: ['owner', 'manager'] } },
    include: {
      entity: { select: { id: true, name: true, slug: true, status: true, city: true, state: true } },
    },
  });

  const eligible = memberships.filter((m) => m.entity.status === 'approved');

  return (
    <main style={{ maxWidth: '32rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <p style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 0.35rem' }}>
        Shopify install
      </p>
      <h1 style={{ color: '#FBDB65', fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
        Connect <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{shop}</span>
      </h1>
      <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
        Pick which of your Connect entities should own this Shopify connection.
        The shop will award points to customers who&apos;ve granted that entity the points scope.
      </p>

      {eligible.length === 0 ? (
        <div style={{
          padding: '1.25rem',
          background: 'rgba(255, 130, 0, 0.06)',
          border: '1px solid rgba(255, 130, 0, 0.3)',
          borderRadius: '10px',
          color: '#FBDB65',
        }}>
          <p style={{ margin: 0, fontWeight: 700 }}>You don&apos;t have any approved entities yet.</p>
          <p style={{ margin: '0.5rem 0 1rem', color: '#9ca3af', fontSize: '0.85rem' }}>
            Apply to become an Afterroar Connect entity first, then re-install Shopify.
          </p>
          <Link href="/store" style={{ color: '#FF8200', fontWeight: 700 }}>Apply →</Link>
        </div>
      ) : (
        <ShopifyClaim shop={shop} token={token} scope={scope || ''} entities={eligible.map((m) => m.entity)} />
      )}
    </main>
  );
}

function Shell({ title, message }: { title: string; message: string }) {
  return (
    <main style={{ maxWidth: '28rem', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
      <h1 style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.75rem' }}>{title}</h1>
      <p style={{ color: '#9ca3af', margin: '0 0 1.5rem' }}>{message}</p>
      <Link href="/store" style={{ color: '#FF8200', fontWeight: 700 }}>← Back to Connect</Link>
    </main>
  );
}
