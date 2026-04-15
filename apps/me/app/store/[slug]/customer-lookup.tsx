'use client';

import { useState } from 'react';
import { Search, User, AlertCircle, Check, X, Loader2 } from 'lucide-react';
import { PointsAward } from './points-award';

interface LookupResult {
  passportCode: string;
  identity?: {
    displayName: string;
    email?: string;
    passportCode: string;
    verified: boolean;
    reputationScore: number;
    memberSince: string;
  };
  wishlist?: Array<{ gameTitle: string; priority: number; notes?: string }>;
  library?: Array<{ title: string; bggId?: number; tags?: string[] }>;
  points?: { balance: number; recentTransactions: Array<{ amount: number; description: string; createdAt: string }> };
  badges?: Array<{ name: string; emoji: string; color: string; issuerName?: string }>;
  consentGranted: boolean;
  consentScopes: string[];
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Must have',
  2: 'Want',
  3: 'Interested',
  4: 'Maybe',
};

export function CustomerLookup({ entityId, entityName }: { entityId: string; entityName: string }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState('');

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/store/customer-lookup?code=${encodeURIComponent(code.trim())}&entityId=${entityId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Customer not found');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Lookup input */}
      <div style={{
        display: 'flex', gap: '0.5rem',
        background: '#0a0a0a',
        border: '1px solid #374151',
        borderRadius: '10px',
        padding: '0.5rem 0.5rem 0.5rem 0.85rem',
        alignItems: 'center',
      }}>
        <Search size={18} style={{ color: '#6b7280', flexShrink: 0 }} />
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          placeholder="Enter 8-char Passport code (e.g., K7H3P2N4)"
          maxLength={8}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#e2e8f0',
            fontSize: '1rem',
            outline: 'none',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            letterSpacing: '0.1em',
          }}
        />
        <button onClick={handleLookup} disabled={!code.trim() || loading} style={{
          padding: '0.5rem 1rem',
          background: code.trim() ? '#FF8200' : '#374151',
          border: 'none',
          borderRadius: '6px',
          color: code.trim() ? '#0a0a0a' : '#6b7280',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: code.trim() && !loading ? 'pointer' : 'not-allowed',
        }}>
          {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Look up'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop: '1.25rem' }}>
          {!result.consentGranted ? (
            <div style={{
              padding: '1.25rem',
              background: 'rgba(255, 130, 0, 0.06)',
              border: '1px solid rgba(255, 130, 0, 0.3)',
              borderRadius: '10px',
            }}>
              <p style={{ color: '#FF8200', fontWeight: 700, margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
                Customer hasn&apos;t connected with {entityName} yet.
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                Passport <strong style={{ color: '#FBDB65', fontFamily: 'monospace' }}>{result.passportCode}</strong> exists,
                but they haven&apos;t granted your store access to any data.
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>
                Generate a consent QR below — they scan it once and you&apos;re connected.
              </p>
            </div>
          ) : (
            <>
              {/* Identity */}
              {result.identity && (
                <div style={resultSection}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <User size={20} style={{ color: '#FF8200' }} />
                    <div>
                      <p style={{ margin: 0, color: '#e2e8f0', fontWeight: 700, fontSize: '1.05rem' }}>
                        {result.identity.displayName}
                      </p>
                      <p style={{ margin: '0.15rem 0 0', color: '#6b7280', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {result.identity.passportCode}
                      </p>
                    </div>
                    {result.identity.verified && (
                      <span style={{ marginLeft: 'auto', padding: '0.25rem 0.6rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>
                        ✓ Verified
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Badges */}
              {result.badges && result.badges.length > 0 && (
                <div style={resultSection}>
                  <p style={sectionTitle}>Badges</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {result.badges.map((b) => (
                      <span key={b.name} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.3rem 0.65rem',
                        background: 'rgba(0,0,0,0.3)',
                        border: `1px solid ${b.color}44`,
                        borderRadius: '999px',
                        color: b.color,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}>
                        <span>{b.emoji}</span> {b.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Wishlist */}
              {result.wishlist && (
                <div style={resultSection}>
                  <p style={sectionTitle}>
                    Wishlist ({result.wishlist.length})
                    <span style={{ color: '#FF8200', fontSize: '0.7rem', fontStyle: 'italic', marginLeft: '0.5rem', fontWeight: 400 }}>
                      Real-time stock matching coming soon
                    </span>
                  </p>
                  {result.wishlist.length === 0 ? (
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>No games on wishlist yet.</p>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' }}>
                      {result.wishlist.slice(0, 10).map((w, i) => (
                        <li key={i} style={wishItem}>
                          <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>{w.gameTitle}</span>
                          <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>{PRIORITY_LABELS[w.priority] || 'Want'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Library */}
              {result.library && (
                <div style={resultSection}>
                  <p style={sectionTitle}>
                    Library ({result.library.length})
                    <span style={{ color: '#FF8200', fontSize: '0.7rem', fontStyle: 'italic', marginLeft: '0.5rem', fontWeight: 400 }}>
                      Collection-based recommendations coming soon
                    </span>
                  </p>
                  {result.library.length === 0 ? (
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>No games in library yet.</p>
                  ) : (
                    <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.85rem' }}>
                      Owns {result.library.length} games. Top: {result.library.slice(0, 5).map(g => g.title).join(', ')}
                      {result.library.length > 5 && ` and ${result.library.length - 5} more`}
                    </p>
                  )}
                </div>
              )}

              {/* Points */}
              {result.points && (
                <div style={resultSection}>
                  <p style={sectionTitle}>
                    Loyalty points at {entityName}
                  </p>
                  <p style={{ margin: 0, color: '#FBDB65', fontSize: '1.5rem', fontWeight: 900 }}>
                    {result.points.balance} points
                  </p>
                  <p style={{ color: '#FF8200', fontSize: '0.7rem', fontStyle: 'italic', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                    Your store only · Federated points across participating stores coming soon
                  </p>
                  <PointsAward
                    entityId={entityId}
                    passportCode={result.passportCode}
                    currentBalance={result.points.balance}
                    onUpdate={(newBalance) => {
                      setResult((prev) => prev?.points
                        ? { ...prev, points: { ...prev.points, balance: newBalance } }
                        : prev);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const resultSection: React.CSSProperties = {
  marginTop: '0.75rem',
  padding: '1rem 1.15rem',
  background: '#0a0a0a',
  border: '1px solid #374151',
  borderRadius: '10px',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  color: '#9ca3af',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};

const wishItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.5rem 0.75rem',
  background: '#1f2937',
  borderRadius: '6px',
};
