'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TYPE } from '@/app/components/ui';

type Provider = {
  key: 'google';
  label: string;
  linked: boolean;
};

export function ConnectedAccounts({
  providers,
  canUnlink,
}: {
  providers: Provider[];
  /**
   * Whether the user can safely unlink an OAuth provider. False when
   * removing the link would lock them out (no password set + only one
   * provider linked).
   */
  canUnlink: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function link(provider: 'google') {
    setError(null);
    setBusy(`link:${provider}`);
    await signIn(provider, { callbackUrl: '/settings?linked=' + provider });
  }

  async function unlink(provider: 'google') {
    if (!confirm(`Unlink ${provider} from your Passport? You'll need your password to sign in next time.`)) return;
    setError(null);
    setBusy(`unlink:${provider}`);
    const res = await fetch('/api/settings/unlink-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Could not unlink. Try again.');
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--rule)', border: '1px solid var(--rule)' }}>
      {providers.map((p) => {
        const isBusy = busy === `link:${p.key}` || busy === `unlink:${p.key}`;
        return (
          <div key={p.key} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.9rem 1rem',
            background: 'var(--panel-mute)',
            gap: '1rem',
            borderLeft: p.linked ? '2px solid var(--green)' : '2px solid var(--rule)',
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: '12rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              {p.key === 'google' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              ) : null}
              <div>
                <p style={{ ...TYPE.displayMd, color: 'var(--cream)', margin: '0 0 0.15rem', fontSize: '0.95rem' }}>{p.label}</p>
                <p style={{ ...TYPE.body, color: 'var(--ink-soft)', fontSize: '0.76rem', margin: 0, lineHeight: 1.4 }}>
                  {p.linked
                    ? 'Connected — you can sign in with this.'
                    : 'Not connected. Link it to skip the password next time.'}
                </p>
              </div>
            </div>
            {p.linked ? (
              <button
                type="button"
                onClick={() => unlink(p.key)}
                disabled={isBusy || !canUnlink}
                title={!canUnlink ? 'Set a password first — otherwise you\'ll be locked out.' : undefined}
                style={{
                  padding: '0.35rem 0.9rem',
                  border: '1.5px solid var(--rule)',
                  background: 'transparent',
                  color: !canUnlink ? 'var(--ink-faint)' : 'var(--ink-soft)',
                  ...TYPE.mono,
                  fontSize: '0.68rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  cursor: isBusy || !canUnlink ? 'not-allowed' : 'pointer',
                  opacity: isBusy ? 0.5 : 1,
                  minWidth: '5rem',
                }}
              >
                {isBusy ? '…' : 'Unlink'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => link(p.key)}
                disabled={isBusy}
                style={{
                  padding: '0.35rem 0.9rem',
                  border: '1.5px solid var(--orange)',
                  background: 'var(--orange-weak)',
                  color: 'var(--orange)',
                  ...TYPE.mono,
                  fontSize: '0.68rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                  opacity: isBusy ? 0.5 : 1,
                  minWidth: '5rem',
                }}
              >
                {isBusy ? '…' : 'Link'}
              </button>
            )}
          </div>
        );
      })}
      {error ? (
        <p style={{
          ...TYPE.body,
          fontSize: '0.78rem',
          color: 'var(--red)',
          margin: '0.5rem 0 0',
          padding: '0.5rem 0.75rem',
          background: 'rgba(196, 77, 77, 0.08)',
          border: '1px solid rgba(196, 77, 77, 0.3)',
        }}>{error}</p>
      ) : null}
    </div>
  );
}
