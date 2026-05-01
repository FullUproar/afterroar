'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { TYPE } from '@/app/components/ui';
import {
  verifyUser,
  unverifyUser,
  banUser,
  unbanUser,
  deleteUser,
  resendVerificationEmail,
} from './actions';

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  passportCode: string | null;
  emailVerified: Date | null;
  identityVerified: boolean;
  isFrozen: boolean;
  accountStatus: string;
  membershipTier: string;
  isMinor: boolean;
  createdAt: Date;
  accounts: { provider: string }[];
}

export default function UsersTable({ users }: { users: UserRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  function withTransition(id: string, fn: () => Promise<void> | void) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setPendingId(null);
      }
    });
  }

  async function handleVerify(u: UserRow) {
    if (u.emailVerified) {
      withTransition(u.id, () => unverifyUser(u.id));
    } else {
      withTransition(u.id, () => verifyUser(u.id));
    }
  }
  async function handleBan(u: UserRow) {
    if (u.isFrozen) {
      withTransition(u.id, () => unbanUser(u.id));
    } else {
      if (!confirm(`Ban ${u.email}? They'll be unable to sign in or act on the platform.`)) return;
      withTransition(u.id, () => banUser(u.id));
    }
  }
  async function handleDelete(u: UserRow) {
    if (!confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return;
    withTransition(u.id, () => deleteUser(u.id));
  }
  async function handleResend(u: UserRow) {
    setPendingId(u.id);
    const result = await resendVerificationEmail(u.id);
    setPendingId(null);
    setFlash({
      id: u.id,
      text: result.ok ? 'Verification email sent ✓' : `Send failed: ${result.error}`,
      ok: !!result.ok,
    });
    setTimeout(() => setFlash(null), 4000);
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', ...TYPE.body, fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid var(--rule)', textAlign: 'left' }}>
            <Th>Email</Th>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th>Auth</Th>
            <Th>Tier</Th>
            <Th>Created</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isPending = pendingId === u.id;
            const flashForRow = flash && flash.id === u.id ? flash : null;
            return (
              <tr
                key={u.id}
                style={{
                  borderBottom: '1px solid var(--rule)',
                  background: u.isFrozen ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                  opacity: isPending ? 0.55 : 1,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Td>
                  <Link
                    href={`/admin/users/${u.id}`}
                    style={{ color: 'var(--cream)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    {u.email}
                  </Link>
                  {u.passportCode && (
                    <div style={{ color: 'var(--ink-faint)', fontSize: '0.7rem', marginTop: '0.1rem' }}>
                      {u.passportCode}
                    </div>
                  )}
                </Td>
                <Td>{u.displayName || <span style={{ color: 'var(--ink-faint)' }}>—</span>}</Td>
                <Td>
                  <Pills u={u} />
                </Td>
                <Td>
                  {u.accounts.length > 0 ? (
                    u.accounts.map((a) => a.provider).join(', ')
                  ) : (
                    <span style={{ color: 'var(--ink-faint)' }}>password</span>
                  )}
                </Td>
                <Td>{u.membershipTier}</Td>
                <Td style={{ color: 'var(--ink-soft)', fontSize: '0.78rem' }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </Td>
                <Td>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    <ActionBtn
                      onClick={() => handleVerify(u)}
                      disabled={isPending}
                      label={u.emailVerified ? 'Unverify' : 'Verify'}
                      tone={u.emailVerified ? 'muted' : 'green'}
                    />
                    {!u.emailVerified && (
                      <ActionBtn
                        onClick={() => handleResend(u)}
                        disabled={isPending}
                        label="Resend"
                        tone="default"
                      />
                    )}
                    <ActionBtn
                      onClick={() => handleBan(u)}
                      disabled={isPending}
                      label={u.isFrozen ? 'Unban' : 'Ban'}
                      tone={u.isFrozen ? 'muted' : 'amber'}
                    />
                    <ActionBtn
                      onClick={() => handleDelete(u)}
                      disabled={isPending}
                      label="Delete"
                      tone="red"
                    />
                  </div>
                  {flashForRow && (
                    <div
                      style={{
                        marginTop: '0.35rem',
                        fontSize: '0.72rem',
                        color: flashForRow.ok ? '#10b981' : 'var(--red)',
                      }}
                    >
                      {flashForRow.text}
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: '0.5rem 0.6rem',
        ...TYPE.body,
        fontSize: '0.72rem',
        color: 'var(--ink-soft)',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '0.6rem', verticalAlign: 'top', ...style }}>{children}</td>;
}

function Pills({ u }: { u: UserRow }) {
  return (
    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
      <Pill label={u.emailVerified ? 'verified' : 'unverified'} tone={u.emailVerified ? 'green' : 'amber'} />
      {u.identityVerified && <Pill label="ID" tone="blue" />}
      {u.isMinor && <Pill label="minor" tone="purple" />}
      {u.isFrozen && <Pill label="banned" tone="red" />}
      {u.accountStatus !== 'active' && u.accountStatus !== 'suspended' && (
        <Pill label={u.accountStatus} tone="amber" />
      )}
    </div>
  );
}

function Pill({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'muted' }) {
  const palette: Record<string, { bg: string; fg: string; border: string }> = {
    green: { bg: 'rgba(16, 185, 129, 0.1)', fg: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
    amber: { bg: 'rgba(251, 191, 36, 0.1)', fg: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' },
    red: { bg: 'rgba(239, 68, 68, 0.1)', fg: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
    blue: { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
    purple: { bg: 'rgba(168, 85, 247, 0.1)', fg: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
    muted: { bg: 'rgba(148, 163, 184, 0.1)', fg: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' },
  };
  const c = palette[tone];
  return (
    <span
      style={{
        padding: '0.1rem 0.4rem',
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: '0.25rem',
        ...TYPE.body,
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

function ActionBtn({
  onClick,
  disabled,
  label,
  tone,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  tone: 'green' | 'red' | 'amber' | 'muted' | 'default';
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
        padding: '0.25rem 0.5rem',
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: '0.3rem',
        ...TYPE.body,
        fontSize: '0.72rem',
        fontWeight: 600,
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
