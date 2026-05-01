'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChromeNav, PlayerCard, Workbench } from '@/app/components/card-shell';
import { TYPE, TitleBar } from '@/app/components/ui';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token || !email) {
    return (
      <ErrorState
        title="Invalid link"
        body="This reset link is missing pieces. Request a fresh one from /forgot-password."
      />
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not reset your password.');
        setSubmitting(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login?verified=1'), 1500);
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <ChromeNav signedIn={false} />
        <Workbench>
          <PlayerCard maxWidth="26rem">
            <TitleBar left="Password Reset" />
            <div style={{
              padding: '2rem var(--pad-x) 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '3rem', lineHeight: 1, color: 'var(--green, #7db87d)' }}>✓</div>
              <h1 style={{ ...TYPE.display, fontSize: '1.5rem', color: 'var(--cream)', margin: 0 }}>
                Password updated
              </h1>
              <p style={{ ...TYPE.body, fontSize: '0.9rem', color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
                Redirecting you to sign in…
              </p>
            </div>
          </PlayerCard>
        </Workbench>
      </>
    );
  }

  return (
    <>
      <ChromeNav signedIn={false} />
      <Workbench>
        <PlayerCard maxWidth="26rem">
          <TitleBar left="Set New Password" />
          <div style={{
            padding: '2rem var(--pad-x) 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{
                ...TYPE.display,
                fontSize: 'clamp(1.5rem, 4vw, 1.85rem)',
                color: 'var(--cream)',
                margin: 0,
                lineHeight: 1.1,
              }}>
                Choose a new<br />password
              </h1>
              <p style={{ ...TYPE.body, fontSize: '0.88rem', color: 'var(--ink-soft)', margin: '0.75rem 0 0', lineHeight: 1.5 }}>
                Updating the password for <strong style={{ color: 'var(--cream)' }}>{email}</strong>
              </p>
            </div>

            {error && (
              <div style={{
                padding: '0.75rem 0.9rem',
                background: 'rgba(196, 77, 77, 0.08)',
                border: '1px solid rgba(196, 77, 77, 0.3)',
                color: 'var(--red)',
                ...TYPE.body,
                fontSize: '0.82rem',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                autoComplete="new-password"
                required
                autoFocus
                style={fieldStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
                style={fieldStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
              />
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '0.9rem 1.25rem',
                  background: 'var(--orange)',
                  border: 'none',
                  color: 'var(--void, #1a1a1a)',
                  ...TYPE.display,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}

function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <>
      <ChromeNav signedIn={false} />
      <Workbench>
        <PlayerCard maxWidth="26rem">
          <TitleBar left="Hmm" />
          <div style={{
            padding: '2rem var(--pad-x) 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            textAlign: 'center',
          }}>
            <h1 style={{ ...TYPE.display, fontSize: '1.5rem', color: 'var(--cream)', margin: 0 }}>
              {title}
            </h1>
            <p style={{ ...TYPE.body, fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.5, margin: 0 }}>
              {body}
            </p>
            <a href="/forgot-password" style={{ color: 'var(--orange)', ...TYPE.body, fontSize: '0.88rem', marginTop: '0.5rem' }}>
              Request a new reset link
            </a>
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 0.9rem',
  background: 'var(--panel-mute)',
  border: '1.5px solid var(--rule)',
  color: 'var(--cream)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.95rem',
  outline: 'none',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--orange)' }}>Loading…</p>
      </main>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
