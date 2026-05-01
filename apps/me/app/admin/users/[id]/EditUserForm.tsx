'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TYPE } from '@/app/components/ui';
import {
  updateUser,
  verifyUser,
  unverifyUser,
  banUser,
  unbanUser,
  deleteUser,
  resendVerificationEmail,
} from '../actions';

interface UserShape {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  membershipTier: string;
  identityVerified: boolean;
  isFrozen: boolean;
  accountStatus: string;
  defaultVisibility: string;
  emailVerified: boolean;
}

export default function EditUserForm({ user }: { user: UserShape }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [username, setUsername] = useState(user.username || '');
  const [membershipTier, setMembershipTier] = useState(user.membershipTier);
  const [identityVerified, setIdentityVerified] = useState(user.identityVerified);
  const [accountStatus, setAccountStatus] = useState(user.accountStatus);
  const [defaultVisibility, setDefaultVisibility] = useState(user.defaultVisibility);

  function flashMsg(text: string, ok: boolean) {
    setFlash({ ok, text });
    setTimeout(() => setFlash(null), 3000);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateUser(user.id, {
        email,
        displayName,
        username: username || null,
        membershipTier,
        identityVerified,
        accountStatus,
        defaultVisibility,
      });
      if (!res.ok) {
        setError(res.error || 'Update failed');
        return;
      }
      flashMsg('Saved ✓', true);
      router.refresh();
    });
  }

  function quickAction(label: string, fn: () => Promise<unknown>) {
    startTransition(async () => {
      const res = (await fn()) as { ok?: boolean; error?: string } | undefined;
      if (res && res.ok === false) {
        flashMsg(res.error || `${label} failed`, false);
      } else {
        flashMsg(`${label} ✓`, true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && <Alert tone="red">{error}</Alert>}
      {flash && <Alert tone={flash.ok ? 'green' : 'red'}>{flash.text}</Alert>}

      <Section title="Identity">
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
        </Field>
        <Field label="Display name">
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Username">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
        </Field>
      </Section>

      <Section title="Tier & state">
        <Field label="Membership tier">
          <select value={membershipTier} onChange={(e) => setMembershipTier(e.target.value)} style={inputStyle}>
            <option value="FREE">FREE</option>
            <option value="PRO">PRO</option>
            <option value="CONNECT">CONNECT</option>
          </select>
        </Field>
        <Field label="Account status">
          <select value={accountStatus} onChange={(e) => setAccountStatus(e.target.value)} style={inputStyle}>
            <option value="active">active</option>
            <option value="pending_parent">pending_parent</option>
            <option value="paused">paused</option>
            <option value="suspended">suspended</option>
          </select>
        </Field>
        <Field label="Default visibility">
          <select value={defaultVisibility} onChange={(e) => setDefaultVisibility(e.target.value)} style={inputStyle}>
            <option value="public">public</option>
            <option value="trusted-gaming-circle">trusted-gaming-circle</option>
            <option value="gaming-circle">gaming-circle</option>
            <option value="circle">circle (most restrictive)</option>
          </select>
        </Field>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={identityVerified}
            onChange={(e) => setIdentityVerified(e.target.checked)}
            style={{ accentColor: 'var(--orange)' }}
          />
          <span>Identity verified (Persona equivalent)</span>
        </label>
      </Section>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => router.push('/admin/users')}
          disabled={pending}
          style={cancelBtnStyle}
        >
          Back
        </button>
        <button type="submit" disabled={pending} style={submitBtnStyle}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <Section title="Quick actions">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <QuickBtn
            label={user.emailVerified ? 'Unverify email' : 'Verify email'}
            tone={user.emailVerified ? 'muted' : 'green'}
            disabled={pending}
            onClick={() =>
              quickAction(
                user.emailVerified ? 'Unverified' : 'Verified',
                () => (user.emailVerified ? unverifyUser(user.id) : verifyUser(user.id)),
              )
            }
          />
          {!user.emailVerified && (
            <QuickBtn
              label="Resend verification email"
              tone="default"
              disabled={pending}
              onClick={() => quickAction('Resend', () => resendVerificationEmail(user.id))}
            />
          )}
          <QuickBtn
            label={user.isFrozen ? 'Unban' : 'Ban'}
            tone={user.isFrozen ? 'muted' : 'amber'}
            disabled={pending}
            onClick={() => {
              if (!user.isFrozen && !confirm(`Ban ${user.email}? They won't be able to sign in.`)) return;
              quickAction(user.isFrozen ? 'Unbanned' : 'Banned', () =>
                user.isFrozen ? unbanUser(user.id) : banUser(user.id),
              );
            }}
          />
          <QuickBtn
            label="Delete user"
            tone="red"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return;
              startTransition(async () => {
                await deleteUser(user.id);
                router.push('/admin/users');
              });
            }}
          />
        </div>
      </Section>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2 style={{ ...TYPE.display, fontSize: '0.85rem', color: 'var(--ink-soft)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span style={{ ...TYPE.body, fontSize: '0.78rem', color: 'var(--ink-faint)', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function Alert({ tone, children }: { tone: 'red' | 'green'; children: React.ReactNode }) {
  const palette =
    tone === 'red'
      ? { bg: 'rgba(196, 77, 77, 0.08)', border: 'rgba(196, 77, 77, 0.3)', fg: 'var(--red)' }
      : { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', fg: '#10b981' };
  return (
    <div
      style={{
        padding: '0.7rem 0.9rem',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        ...TYPE.body,
        fontSize: '0.85rem',
      }}
    >
      {children}
    </div>
  );
}

function QuickBtn({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  tone: 'green' | 'red' | 'amber' | 'muted' | 'default';
  disabled?: boolean;
  onClick: () => void;
}) {
  const palette: Record<string, { bg: string; fg: string; border: string }> = {
    green: { bg: 'rgba(16, 185, 129, 0.08)', fg: '#10b981', border: 'rgba(16, 185, 129, 0.4)' },
    red: { bg: 'rgba(239, 68, 68, 0.08)', fg: '#ef4444', border: 'rgba(239, 68, 68, 0.4)' },
    amber: { bg: 'rgba(251, 191, 36, 0.08)', fg: '#fbbf24', border: 'rgba(251, 191, 36, 0.4)' },
    muted: { bg: 'rgba(148, 163, 184, 0.08)', fg: '#94a3b8', border: 'rgba(148, 163, 184, 0.4)' },
    default: { bg: 'rgba(255, 130, 0, 0.08)', fg: 'var(--orange)', border: 'rgba(255, 130, 0, 0.4)' },
  };
  const c = palette[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.5rem 0.85rem',
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: '0.4rem',
        ...TYPE.body,
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.55rem 0.8rem',
  background: 'var(--panel-mute)',
  border: '1.5px solid var(--rule)',
  color: 'var(--cream)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  outline: 'none',
  borderRadius: '0.4rem',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  ...TYPE.body,
  fontSize: '0.88rem',
  color: 'var(--cream)',
  cursor: 'pointer',
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
