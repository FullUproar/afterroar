'use client';

import { useState } from 'react';
import { Plus, Minus, Loader2, Check } from 'lucide-react';

const QUICK_AMOUNTS = [5, 10, 25, 50];

export function PointsAward({
  entityId,
  passportCode,
  currentBalance,
  onUpdate,
}: {
  entityId: string;
  passportCode: string;
  currentBalance: number;
  onUpdate: (newBalance: number) => void;
}) {
  const [mode, setMode] = useState<'earn' | 'redeem'>('earn');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const submit = async (rawAmount: number, defaultReason?: string) => {
    const signed = mode === 'earn' ? Math.abs(rawAmount) : -Math.abs(rawAmount);
    const description = (reason.trim() || defaultReason || (mode === 'earn' ? 'Points awarded' : 'Points redeemed')).slice(0, 200);
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/store/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          passportCode,
          amount: signed,
          description,
          action: mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to record points');
      } else {
        setSuccess(`${signed > 0 ? '+' : ''}${signed} pts · new balance ${data.balance}`);
        setAmount('');
        setReason('');
        onUpdate(data.balance);
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #1f2937' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setMode('earn')}
          style={tabStyle(mode === 'earn')}
        >
          <Plus size={14} /> Award
        </button>
        <button
          type="button"
          onClick={() => setMode('redeem')}
          style={tabStyle(mode === 'redeem')}
        >
          <Minus size={14} /> Redeem
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {QUICK_AMOUNTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => submit(q)}
            disabled={submitting || (mode === 'redeem' && q > currentBalance)}
            style={quickBtn(submitting || (mode === 'redeem' && q > currentBalance))}
          >
            {mode === 'earn' ? '+' : '−'}{q}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Custom"
          min={1}
          style={inputStyle}
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          maxLength={200}
          style={{ ...inputStyle, flex: 2 }}
        />
        <button
          type="button"
          onClick={() => {
            const n = parseInt(amount, 10);
            if (Number.isFinite(n) && n > 0) submit(n);
          }}
          disabled={submitting || !amount}
          style={{
            padding: '0.5rem 0.85rem',
            background: amount ? '#FF8200' : '#374151',
            border: 'none',
            borderRadius: '6px',
            color: amount ? '#0a0a0a' : '#6b7280',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: submitting || !amount ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Go'}
        </button>
      </div>

      {success && (
        <p style={{ margin: '0.5rem 0 0', color: '#10b981', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Check size={14} /> {success}
        </p>
      )}
      {error && (
        <p style={{ margin: '0.5rem 0 0', color: '#fca5a5', fontSize: '0.8rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '0.45rem 0.75rem',
  background: active ? 'rgba(255, 130, 0, 0.12)' : 'transparent',
  border: `1px solid ${active ? '#FF8200' : '#374151'}`,
  borderRadius: '6px',
  color: active ? '#FF8200' : '#9ca3af',
  fontWeight: 700,
  fontSize: '0.8rem',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
});

const quickBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '0.4rem 0.75rem',
  background: disabled ? '#1f2937' : '#0a0a0a',
  border: '1px solid #374151',
  borderRadius: '6px',
  color: disabled ? '#4b5563' : '#FBDB65',
  fontWeight: 700,
  fontSize: '0.8rem',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'ui-monospace, monospace',
});

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem 0.65rem',
  background: '#0a0a0a',
  border: '1px solid #374151',
  borderRadius: '6px',
  color: '#e2e8f0',
  fontSize: '0.85rem',
  outline: 'none',
};
