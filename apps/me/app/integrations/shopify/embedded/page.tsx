import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

/**
 * /integrations/shopify/embedded
 *
 * The "App URL" we configure in the Shopify Partner dashboard. Shopify
 * loads this inside the admin iframe (or as a popup) with `shop` and
 * `host` query params after install.
 *
 * For V1 we don't render a fully-embedded App Bridge experience. We:
 *  - resolve the shop → entity slug via ShopifyConnection
 *  - if signed in and a member, route to /store/[slug] (top-level nav)
 *  - if not signed in, show a "open in new tab" landing
 *
 * App Bridge / iframe rendering is documented as a Phase 2 enhancement
 * in docs/shopify-app-listing.md. Most stores will use the marketing
 * site → install link → claim flow path; the embedded entry only
 * matters for App Store-driven discovery.
 */
export default async function ShopifyEmbeddedEntry({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; host?: string }>;
}) {
  const { shop } = await searchParams;

  if (!shop) {
    return <Shell title="Open this app from your Shopify admin." />;
  }

  const conn = await prisma.shopifyConnection.findUnique({
    where: { shopDomain: shop },
  });

  if (!conn) {
    // Not yet claimed — bounce them through install
    redirect(`/api/integrations/shopify/install?shop=${shop}`);
  }

  const entity = await prisma.afterroarEntity.findUnique({
    where: { id: conn.entityId },
    select: { slug: true, name: true },
  });
  if (!entity) {
    return <Shell title="Connection exists but the entity is missing. Contact support." />;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main style={{ maxWidth: '32rem', margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 0.35rem' }}>
          Shopify
        </p>
        <h1 style={{ color: '#FBDB65', fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
          {entity.name}
        </h1>
        <p style={{ color: '#9ca3af', margin: '0 0 1.5rem' }}>
          Sign in to your Afterroar Passport to manage this connection.
        </p>
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/store/${entity.slug}`)}`}
          target="_top"
          style={{ color: '#FF8200', fontWeight: 700 }}
        >
          Sign in →
        </Link>
      </main>
    );
  }

  // Signed-in member — bounce to the dashboard at top level (out of the iframe)
  redirect(`/store/${entity.slug}`);
}

function Shell({ title }: { title: string }) {
  return (
    <main style={{ maxWidth: '28rem', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
      <h1 style={{ color: '#9ca3af', fontSize: '1.1rem', fontWeight: 700 }}>{title}</h1>
    </main>
  );
}
