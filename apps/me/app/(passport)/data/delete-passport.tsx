'use client';

import { useState } from 'react';
import { Button, TYPE, inputStyle } from '@/app/components/ui';

/**
 * Soft-delete flow with 30-day grace window. Initial click expands the
 * danger zone; typing the email enables a "Schedule deletion" CTA that
 * sets a 30-day timer. If the user is already in-grace, this component
 * surfaces the scheduled date + an "Undo" button that cancels.
 */
export function DeletePassport({
  userEmail,
  scheduledDeletionAt,
}: {
  userEmail: string;
  scheduledDeletionAt: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [pendingAt, setPendingAt] = useState<string | null>(scheduledDeletionAt);

  const emailMatches = confirmEmail.toLowerCase().trim() === userEmail.toLowerCase().trim();

  async function handleSchedule() {
    if (!emailMatches) return;
    setWorking(true);
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
        setWorking(false);
        return;
      }
      const data = await res.json();
      setPendingAt(data.scheduledDeletionAt);
      setExpanded(false);
      setConfirmEmail('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setWorking(false);
    }
  }

  async function handleUndo() {
    setWorking(true);
    setError('');
    try {
      const res = await fetch('/api/delete-account/undo', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Could not restore your account.');
        return;
      }
      setPendingAt(null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setWorking(false);
    }
  }

  // ── Pending-deletion state ─────────────────────────────────────────
  if (pendingAt) {
    const date = new Date(pendingAt);
    const daysLeft = Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    return (
      <div style={{
        padding: '1.1rem',
        background: 'rgba(234, 179, 8, 0.08)',
        border: '1px solid rgba(234, 179, 8, 0.4)',
      }}>
        <p style={{ ...TYPE.displayMd, margin: '0 0 0.4rem', fontSize: '0.95rem', color: 'var(--orange)' }}>
          Account scheduled for deletion
        </p>
        <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0 0 0.85rem', fontSize: '0.82rem', lineHeight: 1.55 }}>
          Your Passport will be permanently deleted on <strong style={{ color: 'var(--cream)' }}>{date.toLocaleDateString()}</strong>
          {' '}({daysLeft} {daysLeft === 1 ? 'day' : 'days'} from now). You can undo this any time before then.
        </p>
        <Button onClick={handleUndo} disabled={working}>
          {working ? 'Restoring…' : 'Undo deletion'}
        </Button>
        {error ? <p style={{ ...TYPE.body, color: 'var(--red)', fontSize: '0.78rem', margin: '0.6rem 0 0' }}>{error}</p> : null}
      </div>
    );
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
          Schedules permanent deletion of your Afterroar identity, consent grants, library, wishlist, and activity
          history after a 30-day grace period. You can undo any time before then by signing back in.
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
      <p style={{ ...TYPE.displayMd, margin: '0 0 0.4rem', fontSize: '0.95rem', color: 'var(--red)' }}>30-day grace, then permanent</p>
      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0 0 0.35rem', fontSize: '0.8rem', lineHeight: 1.5 }}>
        Schedules permanent deletion of your identity, consent grants, game library, wishlist, and activity
        history 30 days from now. Points ledger entries are anonymized for store accounting but never traceable
        back to you. Subscriptions are cancelled at the end of their billing period so you aren't charged again.
      </p>
      <p style={{ ...TYPE.body, color: 'var(--ink-soft)', margin: '0 0 0.85rem', fontSize: '0.8rem' }}>
        Type <strong style={{ color: 'var(--cream)' }}>{userEmail}</strong> to confirm.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: error ? '0.65rem' : 0, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => { setConfirmEmail(e.target.value); setError(''); }}
          placeholder="your@email.com"
          autoComplete="off"
          style={inputStyle()}
        />
        <Button variant="danger" onClick={handleSchedule} disabled={!emailMatches || working}>
          {working ? 'Scheduling…' : 'Schedule deletion'}
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
