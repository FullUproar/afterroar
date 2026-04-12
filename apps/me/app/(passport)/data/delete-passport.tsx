'use client';

import { useState } from 'react';

/**
 * Delete Passport — two-step friction pattern.
 *
 * Step 1: Click "Delete my Passport" to reveal the confirmation form.
 * Step 2: Type your email address to confirm. Submit deletes everything.
 *
 * Not too little friction (single click = accident waiting to happen).
 * Not too much friction (CAPTCHA + countdown + "are you sure?" chain = hostile).
 * Type-to-confirm is the sweet spot: proves intent, feels fair.
 */
export function DeletePassport({ userEmail }: { userEmail: string }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const emailMatches = confirmEmail.toLowerCase().trim() === userEmail.toLowerCase().trim();

  async function handleDelete() {
    if (!emailMatches) return;
    setDeleting(true);
    setError('');

    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: confirmEmail.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong.');
        setDeleting(false);
        return;
      }

      window.location.href = '/login?deleted=true';
    } catch {
      setError('Network error. Please try again.');
      setDeleting(false);
    }
  }

  if (!expanded) {
    return (
      <div style={{
        padding: '1rem 1.25rem',
        background: 'rgba(239, 68, 68, 0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
      }}>
        <p style={{ fontWeight: 700, margin: '0 0 0.25rem 0', fontSize: '0.95rem', color: '#ef4444' }}>
          Delete my Passport
        </p>
        <p style={{ color: '#6b7280', margin: '0 0 1rem 0', fontSize: '0.8rem' }}>
          Permanently deletes your Afterroar identity, all consent grants, points,
          and activity history. Stores running our POS have their records deleted
          automatically. This cannot be undone.
        </p>
        <button
          onClick={() => setExpanded(true)}
          style={{
            padding: '0.5rem 1rem',
            background: 'transparent',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '6px',
            color: '#ef4444',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          I want to delete my Passport
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.25rem',
      background: 'rgba(239, 68, 68, 0.08)',
      borderRadius: '8px',
      border: '1px solid rgba(239, 68, 68, 0.3)',
    }}>
      <p style={{ fontWeight: 700, margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#ef4444' }}>
        This is permanent
      </p>
      <p style={{ color: '#9ca3af', margin: '0 0 0.25rem 0', fontSize: '0.8rem' }}>
        Your identity, consent grants, game library, activity history, and all
        loyalty points will be deleted. Points ledger entries are anonymized for
        store accounting but can never be traced back to you.
      </p>
      <p style={{ color: '#9ca3af', margin: '0 0 1rem 0', fontSize: '0.8rem' }}>
        Type <strong style={{ color: '#e2e8f0' }}>{userEmail}</strong> to confirm.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: error ? '0.75rem' : 0 }}>
        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => { setConfirmEmail(e.target.value); setError(''); }}
          placeholder="your@email.com"
          autoComplete="off"
          style={{
            flex: 1,
            padding: '0.6rem 0.75rem',
            background: '#0a0a0a',
            border: '1px solid #374151',
            borderRadius: '6px',
            color: '#e2e8f0',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        />
        <button
          onClick={handleDelete}
          disabled={!emailMatches || deleting}
          style={{
            padding: '0.6rem 1.25rem',
            background: emailMatches && !deleting ? '#ef4444' : '#374151',
            border: 'none',
            borderRadius: '6px',
            color: emailMatches && !deleting ? '#fff' : '#6b7280',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: emailMatches && !deleting ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
          }}
        >
          {deleting ? 'Deleting...' : 'Delete forever'}
        </button>
      </div>

      {error && (
        <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0 }}>{error}</p>
      )}

      <button
        onClick={() => { setExpanded(false); setConfirmEmail(''); setError(''); }}
        style={{
          marginTop: '0.75rem',
          padding: '0.4rem 0.75rem',
          background: 'transparent',
          border: 'none',
          color: '#6b7280',
          fontSize: '0.8rem',
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  );
}
