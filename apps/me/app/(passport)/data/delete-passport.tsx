'use client';

import { useState } from 'react';
import { Button, TYPE, inputStyle } from '@/app/components/ui';

/**
 * Two-step friction: click to reveal, type email to confirm, submit deletes.
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
        padding: '1rem 1.1rem',
        background: 'rgba(196, 77, 77, 0.06)',
        border: '1px solid rgba(196, 77, 77, 0.25)',
      }}>
        <p style={{ ...TYPE.displayMd, margin: '0 0 0.2rem', fontSize: '0.95rem', color: 'var(--red)' }}>Delete my Passport</p>
        <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0 0 0.9rem', fontSize: '0.8rem', lineHeight: 1.5 }}>
          Permanently deletes your Afterroar identity, all consent grants, points, and activity history.
          Stores running our POS have their records deleted automatically. This cannot be undone.
        </p>
        <Button variant="danger" size="sm" onClick={() => setExpanded(true)}>
          I want to delete my Passport
        </Button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.1rem',
      background: 'rgba(196, 77, 77, 0.08)',
      border: '1px solid rgba(196, 77, 77, 0.35)',
    }}>
      <p style={{ ...TYPE.displayMd, margin: '0 0 0.4rem', fontSize: '0.95rem', color: 'var(--red)' }}>This is permanent</p>
      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0 0 0.35rem', fontSize: '0.8rem', lineHeight: 1.5 }}>
        Your identity, consent grants, game library, activity history, and all loyalty points will be deleted.
        Points ledger entries are anonymized for store accounting but can never be traced back to you.
      </p>
      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0 0 0.85rem', fontSize: '0.8rem' }}>
        Type <strong style={{ color: 'var(--cream)' }}>{userEmail}</strong> to confirm.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: error ? '0.65rem' : 0 }}>
        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => { setConfirmEmail(e.target.value); setError(''); }}
          placeholder="your@email.com"
          autoComplete="off"
          style={inputStyle()}
        />
        <Button variant="danger" onClick={handleDelete} disabled={!emailMatches || deleting}>
          {deleting ? 'Deleting…' : 'Delete forever'}
        </Button>
      </div>

      {error ? <p style={{ ...TYPE.body, color: 'var(--red)', fontSize: '0.8rem', margin: 0 }}>{error}</p> : null}

      <button onClick={() => { setExpanded(false); setConfirmEmail(''); setError(''); }} style={{
        marginTop: '0.7rem',
        background: 'transparent',
        border: 'none',
        color: 'var(--ink-soft)',
        ...TYPE.mono,
        fontSize: '0.68rem',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        padding: 0,
      }}>
        Cancel
      </button>
    </div>
  );
}
