'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TYPE } from '@/app/components/ui';
import { createUser } from '../actions';

export default function NewUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [membershipTier, setMembershipTier] = useState('FREE');
  const [markVerified, setMarkVerified] = useState(true);
  const [identityVerified, setIdentityVerified] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes('@')) {
      setError('Email is required');
      return;
    }
    if (password && password.length < 8) {
      setError('Password must be at least 8 characters (or leave blank)');
      return;
    }
    startTransition(async () => {
      const res = await createUser({
        email,
        displayName: displayName || null,
        password: password || null,
        membershipTier,
        markVerified,
        identityVerified,
      });
      if (!res.ok) {
        setError(res.error || 'Could not create user');
        return;
      }
      router.push(`/admin/users/${res.userId}`);
    });
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div
          style={{
            padding: '0.7rem 0.9rem',
            background: 'rgba(196, 77, 77, 0.08)',
            border: '1px solid rgba(196, 77, 77, 0.3)',
            color: 'var(--red)',
            ...TYPE.body,
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      <Field label="Email *">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
      </Field>
      <Field label="Display name">
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Password (optional — sets passwordHash)">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          placeholder="leave blank for OAuth-only or send-by-link signup"
        />
      </Field>
      <Field label="Membership tier">
        <select value={membershipTier} onChange={(e) => setMembershipTier(e.target.value)} style={inputStyle}>
          <option value="FREE">FREE</option>
          <option value="PRO">PRO</option>
          <option value="CONNECT">CONNECT</option>
        </select>
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...TYPE.body, fontSize: '0.88rem', color: 'var(--cream)', cursor: 'pointer' }}>
        <input type="checkbox" checked={markVerified} onChange={(e) => setMarkVerified(e.target.checked)} style={{ accentColor: 'var(--orange)' }} />
        <span>Mark email as verified (skip the verification email loop)</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...TYPE.body, fontSize: '0.88rem', color: 'var(--cream)', cursor: 'pointer' }}>
        <input type="checkbox" checked={identityVerified} onChange={(e) => setIdentityVerified(e.target.checked)} style={{ accentColor: 'var(--orange)' }} />
        <span>Mark identity as verified (Persona equivalent — admins only)</span>
      </label>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={() => router.push('/admin/users')}
          disabled={pending}
          style={cancelBtnStyle}
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} style={submitBtnStyle}>
          {pending ? 'Creating…' : 'Create user'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={{ ...TYPE.body, fontSize: '0.78rem', color: 'var(--ink-soft)', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.6rem 0.8rem',
  background: 'var(--panel-mute)',
  border: '1.5px solid var(--rule)',
  color: 'var(--cream)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  outline: 'none',
  borderRadius: '0.4rem',
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.7rem',
  background: 'transparent',
  border: '1.5px solid var(--rule)',
  color: 'var(--ink-soft)',
  ...TYPE.display,
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
  borderRadius: '0.4rem',
};

const submitBtnStyle: React.CSSProperties = {
  flex: 2,
  padding: '0.7rem',
  background: 'var(--orange)',
  border: 'none',
  color: 'var(--void, #1a1a1a)',
  ...TYPE.display,
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
  borderRadius: '0.4rem',
};
