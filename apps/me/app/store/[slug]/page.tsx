import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CustomerLookup } from './customer-lookup';
import { ConsentQR } from './consent-qr';
import { ShopifyPanel } from './shopify-panel';

/**
 * /store/[slug] — Connect dashboard for an approved entity.
 *
 * Gated: must be an EntityMember of this entity, and entity must be approved.
 */
export default async function StoreDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/store');

  const entity = await prisma.afterroarEntity.findUnique({
    where: { slug },
    include: {
      members: true,
      consents: { where: { revokedAt: null } },
    },
  });

  if (!entity) {
    return (
      <main style={{ maxWidth: '32rem', margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 900 }}>Store not found</h1>
        <Link href="/store" style={{ color: '#FF8200' }}>← Back</Link>
      </main>
    );
  }

  const callerId = session.user!.id as string;
  const member = entity.members.find((m) => m.userId === callerId);
  if (!member) {
    return (
      <main style={{ maxWidth: '32rem', margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 900 }}>Access denied</h1>
        <p style={{ color: '#9ca3af' }}>You&apos;re not a member of this store.</p>
        <Link href="/store" style={{ color: '#FF8200' }}>← Back</Link>
      </main>
    );
  }

  if (entity.status !== 'approved') {
    redirect('/store');
  }

  const consentedUserCount = entity.consents.length;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const connectedThisWeek = entity.consents.filter((c) => c.grantedAt > oneWeekAgo).length;
  const pointsAwarded30dAgg = await prisma.pointsLedger.aggregate({
    where: { storeId: entity.id, action: 'earn', createdAt: { gte: thirtyDaysAgo } },
    _sum: { amount: true },
  });
  const pointsAwarded30d = pointsAwarded30dAgg._sum.amount ?? 0;

  const shopify = await prisma.shopifyConnection.findUnique({
    where: { entityId: entity.id },
    select: {
      shopDomain: true,
      shopName: true,
      active: true,
      pointsPerDollar: true,
      minOrderCents: true,
      installedAt: true,
      lastWebhookAt: true,
    },
  });
  const shopifyEvents = shopify
    ? await prisma.shopifyWebhookEvent.findMany({
        where: { shopDomain: shopify.shopDomain },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { topic: true, result: true, createdAt: true, pointsDelta: true },
      })
    : [];

  const shopifyView = shopify ? {
    shopDomain: shopify.shopDomain,
    shopName: shopify.shopName,
    active: shopify.active,
    pointsPerDollar: shopify.pointsPerDollar,
    minOrderCents: shopify.minOrderCents,
    installedAt: shopify.installedAt.toISOString(),
    lastWebhookAt: shopify.lastWebhookAt?.toISOString() ?? null,
    recentEvents: shopifyEvents.map((e) => ({
      topic: e.topic,
      result: e.result,
      createdAt: e.createdAt.toISOString(),
      pointsDelta: e.pointsDelta,
    })),
  } : null;

  return (
    <main style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem',
      }}>
        <div>
          <p style={{ color: '#FF8200', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 0.35rem' }}>
            Afterroar Connect
          </p>
          <h1 style={{ color: '#FBDB65', fontSize: '1.75rem', fontWeight: 900, margin: 0 }}>
            {entity.name}
          </h1>
          {entity.city && entity.state && (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
              {entity.city}, {entity.state}
            </p>
          )}
        </div>
        <div style={{
          padding: '0.5rem 0.85rem',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '20px',
          color: '#10b981',
          fontSize: '0.75rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: '0.35rem',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
          Approved · Beta
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        <StatCard label="Connected customers" value={consentedUserCount.toString()} href={`/store/${slug}/customers`} />
        <StatCard label="Connected this week" value={connectedThisWeek.toString()} />
        <StatCard label="Points awarded (30d)" value={pointsAwarded30d.toLocaleString()} />
        <StatCard label="Wishlist matches" value="—" sub="Coming soon" />
      </div>

      {/* Customer lookup */}
      <div style={{
        background: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}>
        <h2 style={{ color: '#e2e8f0', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
          Look up a customer
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 1rem' }}>
          Scan their Passport QR or enter their 8-character code.
          You&apos;ll see what they&apos;ve consented to share.
        </p>
        <CustomerLookup entityId={entity.id} entityName={entity.name} />
      </div>

      {/* Consent request QR */}
      <div style={{
        background: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}>
        <h2 style={{ color: '#e2e8f0', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
          Connect a new customer
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 1rem' }}>
          Generate a QR code your customer scans to grant {entity.name} access to their Passport.
        </p>
        <ConsentQR entityId={entity.id} />
      </div>

      {/* Shopify integration */}
      <div style={{
        background: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}>
        <ShopifyPanel entityId={entity.id} entitySlug={slug} connection={shopifyView} />
      </div>

      {/* Coming soon hints */}
      <div style={{
        background: 'rgba(125, 85, 199, 0.06)',
        border: '1px solid rgba(125, 85, 199, 0.2)',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
      }}>
        <p style={{ color: '#7D55C7', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 0.75rem' }}>
          Coming in the next release
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.8 }}>
          <li>Federated loyalty points — rewards that work across participating stores</li>
          <li>Real-time wishlist stock matching — &ldquo;Sarah wants this, you have 2 in stock&rdquo;</li>
          <li>Verified customer badges — identity-verified shoppers appear flagged</li>
          <li>Collection-based recommendations — know what to suggest, what to skip</li>
        </ul>
      </div>

      {/* Footer / nav */}
      <div style={{ borderTop: '1px solid #1f2937', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
        <Link href="/store" style={{ color: '#6b7280', textDecoration: 'none' }}>← All stores</Link>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          <Link href="/credo" style={{ color: '#6b7280', textDecoration: 'none' }}>The Credo</Link>
          <a href="mailto:afterroar@fulluproar.com" style={{ color: '#6b7280', textDecoration: 'none' }}>Support</a>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const inner = (
    <>
      <p style={{ color: '#9ca3af', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.35rem', fontWeight: 600 }}>{label}</p>
      <p style={{ color: '#FBDB65', fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>{value}</p>
      {sub && <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0.25rem 0 0', fontStyle: 'italic' }}>{sub}</p>}
    </>
  );
  const cardStyle: React.CSSProperties = {
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '10px',
    padding: '1rem 1.15rem',
    display: 'block',
    textDecoration: 'none',
  };
  if (href) {
    return <Link href={href} style={cardStyle}>{inner}</Link>;
  }
  return <div style={cardStyle}>{inner}</div>;
}
