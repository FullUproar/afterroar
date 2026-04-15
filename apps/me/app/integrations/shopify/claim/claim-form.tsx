'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';

interface EntityOption {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
}

export function ShopifyClaim({
  shop,
  token,
  scope,
  entities,
}: {
  shop: string;
  token: string;
  scope: string;
  entities: EntityOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(entities[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const claim = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/integrations/shopify/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, token, scope, entityId: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to claim');
        setSubmitting(false);
      } else {
        const slug = entities.find((e) => e.id === selected)?.slug;
        router.push(slug ? `/store/${slug}?shopify=connected` : '/store');
      }
    } catch {
      setError('Network error');
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
        {entities.map((e) => {
          const on = selected === e.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelected(e.id)}
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                padding: '0.85rem 1rem',
                background: on ? 'rgba(16, 185, 129, 0.08)' : '#0a0a0a',
                border: `1px solid ${on ? '#10b981' : '#374151'}`,
                borderRadius: '8px',
                color: '#e2e8f0',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: on ? '#10b981' : 'transparent',
                border: `2px solid ${on ? '#10b981' : '#6b7280'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {on && <Check size={11} strokeWidth={3} style={{ color: '#0a0a0a' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{e.name}</p>
                {e.city && e.state && (
                  <p style={{ margin: '0.15rem 0 0', color: '#9ca3af', fontSize: '0.78rem' }}>
                    {e.city}, {e.state}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={claim}
        disabled={!selected || submitting}
        style={{
          width: '100%',
          padding: '0.85rem 1rem',
          background: selected ? '#10b981' : '#374151',
          border: 'none',
          borderRadius: '10px',
          color: selected ? '#0a0a0a' : '#6b7280',
          fontWeight: 800,
          fontSize: '0.95rem',
          cursor: selected && !submitting ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        }}
      >
        {submitting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
        {submitting ? 'Connecting…' : 'Confirm connection'}
      </button>

      {error && (
        <p style={{ color: '#fca5a5', fontSize: '0.85rem', marginTop: '0.75rem', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}
