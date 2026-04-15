'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, ExternalLink, Loader2, Check, X, Save } from 'lucide-react';

interface ShopifyConnectionView {
  shopDomain: string;
  shopName: string | null;
  active: boolean;
  pointsPerDollar: number;
  minOrderCents: number;
  installedAt: string;
  lastWebhookAt: string | null;
  recentEvents: Array<{ topic: string; result: string | null; createdAt: string; pointsDelta: number | null }>;
}

export function ShopifyPanel({
  entityId,
  entitySlug,
  connection,
}: {
  entityId: string;
  entitySlug: string;
  connection: ShopifyConnectionView | null;
}) {
  if (!connection || !connection.active) {
    return <Install entityId={entityId} entitySlug={entitySlug} reinstall={!!connection} />;
  }
  return <Connected entityId={entityId} entitySlug={entitySlug} connection={connection} />;
}

function Install({ entityId, entitySlug, reinstall }: { entityId: string; entitySlug: string; reinstall: boolean }) {
  const [shop, setShop] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = () => {
    const normalized = normalizeShopDomain(shop);
    if (!normalized) {
      setError('Enter a valid shop domain (e.g. your-store.myshopify.com)');
      return;
    }
    setSubmitting(true);
    window.location.href = `/api/integrations/shopify/install?shop=${normalized}&entityId=${entityId}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <ShoppingBag size={18} style={{ color: '#10b981' }} />
        <h2 style={{ color: '#e2e8f0', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
          {reinstall ? 'Reconnect Shopify' : 'Connect your Shopify store'}
        </h2>
      </div>
      <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 1rem' }}>
        Auto-award points to connected customers when they buy from your Shopify store.
        We listen for paid orders, match by Passport code or email, and credit points instantly.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <input
          type="text"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          placeholder="your-store.myshopify.com"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            padding: '0.65rem 0.85rem',
            background: '#0a0a0a',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '0.9rem',
            outline: 'none',
            fontFamily: 'ui-monospace, monospace',
          }}
        />
        <button
          onClick={handleConnect}
          disabled={submitting || !shop.trim()}
          style={{
            padding: '0.65rem 1.1rem',
            background: shop.trim() ? '#10b981' : '#374151',
            border: 'none',
            borderRadius: '8px',
            color: shop.trim() ? '#0a0a0a' : '#6b7280',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: submitting || !shop.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
        >
          {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ExternalLink size={14} />}
          {submitting ? 'Redirecting…' : 'Connect'}
        </button>
      </div>

      {error && (
        <p style={{ color: '#fca5a5', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{error}</p>
      )}

      <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0.75rem 0 0', fontStyle: 'italic' }}>
        You&apos;ll be redirected to Shopify to grant <code style={{ color: '#9ca3af' }}>read_orders</code> and{' '}
        <code style={{ color: '#9ca3af' }}>read_customers</code>. We never see your products, customers&apos;
        cards, or anything else.
      </p>
    </div>
  );
}

function Connected({
  entityId: _entityId,
  entitySlug,
  connection,
}: {
  entityId: string;
  entitySlug: string;
  connection: ShopifyConnectionView;
}) {
  const router = useRouter();
  const [pointsPerDollar, setPointsPerDollar] = useState(connection.pointsPerDollar);
  const [minOrderDollars, setMinOrderDollars] = useState((connection.minOrderCents / 100).toString());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');

  const dirty =
    pointsPerDollar !== connection.pointsPerDollar ||
    Math.round(parseFloat(minOrderDollars || '0') * 100) !== connection.minOrderCents;

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/integrations/shopify/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entitySlug,
          pointsPerDollar,
          minOrderCents: Math.max(0, Math.round(parseFloat(minOrderDollars || '0') * 100)),
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to save');
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Shopify? Past points stay. New orders won\'t award points until you reconnect.')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/shopify/settings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entitySlug }),
      });
      if (res.ok) router.refresh();
      else setError('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <ShoppingBag size={18} style={{ color: '#10b981' }} />
        <h2 style={{ color: '#e2e8f0', fontSize: '1.05rem', fontWeight: 700, margin: 0, flex: 1 }}>
          Shopify connected
        </h2>
        <span style={{
          padding: '0.25rem 0.6rem',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#10b981',
          borderRadius: '999px',
          fontSize: '0.7rem',
          fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
          Live
        </span>
      </div>

      <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 1rem' }}>
        <strong style={{ color: '#FBDB65' }}>{connection.shopName || connection.shopDomain}</strong>
        {' · '}
        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{connection.shopDomain}</span>
        {' · since '}
        {new Date(connection.installedAt).toLocaleDateString()}
      </p>

      {/* Settings */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #374151',
        borderRadius: '10px',
        padding: '1rem 1.15rem',
        marginBottom: '1rem',
      }}>
        <p style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.75rem' }}>
          Settings
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', color: '#9ca3af', fontSize: '0.78rem', marginBottom: '0.3rem' }}>Points per $1 spent</span>
            <input
              type="number"
              min={0}
              value={pointsPerDollar}
              onChange={(e) => setPointsPerDollar(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', color: '#9ca3af', fontSize: '0.78rem', marginBottom: '0.3rem' }}>Minimum order ($)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={minOrderDollars}
              onChange={(e) => setMinOrderDollars(e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={save}
            disabled={!dirty || saving}
            style={{
              padding: '0.5rem 0.95rem',
              background: dirty ? '#FF8200' : '#374151',
              border: 'none',
              borderRadius: '6px',
              color: dirty ? '#0a0a0a' : '#6b7280',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: dirty && !saving ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}
          >
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
            Save
          </button>
          {saved && <span style={{ color: '#10b981', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Check size={14} /> Saved</span>}
          <button
            onClick={disconnect}
            disabled={disconnecting}
            style={{
              marginLeft: 'auto',
              padding: '0.5rem 0.85rem',
              background: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              color: '#fca5a5',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: disconnecting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}
          >
            <X size={13} /> Disconnect
          </button>
        </div>
        {error && <p style={{ color: '#fca5a5', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{error}</p>}
      </div>

      {/* Recent activity */}
      <div>
        <p style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.5rem' }}>
          Recent webhook activity
        </p>
        {connection.recentEvents.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
            No events yet. Test it: place an order on your Shopify store with a customer that has connected their Passport.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.3rem' }}>
            {connection.recentEvents.map((e, i) => (
              <li key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.45rem 0.7rem',
                background: '#1f2937',
                borderRadius: '6px',
                fontSize: '0.78rem',
              }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{e.topic}</span>
                <span style={{ color: resultColor(e.result) }}>
                  {e.result || 'pending'}
                  {e.pointsDelta != null && ` · ${e.pointsDelta > 0 ? '+' : ''}${e.pointsDelta} pts`}
                </span>
                <span style={{ color: '#6b7280' }}>{new Date(e.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '1rem', fontStyle: 'italic' }}>
        Customers can include their Passport code at checkout (we look in note attributes and the order note),
        or we&apos;ll match by email if they used the same email on both sides.
      </p>
    </div>
  );
}

function normalizeShopDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/\.myshopify\.com$/.test(s)) {
    if (/^[a-z0-9][a-z0-9-]*$/.test(s)) s = `${s}.myshopify.com`;
    else return null;
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) return null;
  return s;
}

function resultColor(result: string | null): string {
  if (!result) return '#9ca3af';
  if (result.startsWith('awarded')) return '#10b981';
  if (result.startsWith('reversed')) return '#FF8200';
  if (result.startsWith('skipped')) return '#9ca3af';
  if (result.startsWith('error')) return '#fca5a5';
  return '#9ca3af';
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.65rem',
  background: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '6px',
  color: '#e2e8f0',
  fontSize: '0.85rem',
  outline: 'none',
};
