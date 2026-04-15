'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Loader2 } from 'lucide-react';

export function ConsentApprove({ token, entityName }: { token: string; entityName: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/consent/request/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to grant access');
      } else {
        setDone(true);
        setTimeout(() => router.push('/settings'), 1500);
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{
        padding: '1.25rem',
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: '10px',
        textAlign: 'center',
      }}>
        <Check size={32} style={{ color: '#10b981', margin: '0 auto 0.5rem' }} />
        <p style={{ margin: 0, color: '#10b981', fontWeight: 700 }}>
          Connected with {entityName}
        </p>
        <p style={{ margin: '0.35rem 0 0', color: '#9ca3af', fontSize: '0.8rem' }}>
          Taking you to your settings…
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleApprove}
          disabled={submitting}
          style={{
            flex: 1,
            padding: '0.85rem 1rem',
            background: '#FF8200',
            border: 'none',
            borderRadius: '10px',
            color: '#0a0a0a',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}
        >
          {submitting ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={18} />}
          {submitting ? 'Connecting…' : 'Allow access'}
        </button>
        <button
          onClick={() => history.back()}
          disabled={submitting}
          style={{
            padding: '0.85rem 1rem',
            background: 'transparent',
            border: '1px solid #374151',
            borderRadius: '10px',
            color: '#9ca3af',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <X size={16} /> Decline
        </button>
      </div>
      {error && (
        <p style={{ marginTop: '0.75rem', color: '#fca5a5', fontSize: '0.85rem', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}
