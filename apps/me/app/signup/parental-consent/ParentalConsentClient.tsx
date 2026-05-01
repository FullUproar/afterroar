'use client';

import { useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import { TYPE } from '@/app/components/ui';

/**
 * The four-step parent consent UX:
 *   1. Sign in (Google or email/password). Required because the parent's
 *      Passport account is the link to the kid.
 *   2. Verify identity via Persona.
 *   3. Attest "I am the parent or legal guardian" + agree to the
 *      $5/mo Pro subscription.
 *   4. Confirm — kid account activates.
 *
 * Flow is gated server-side: each step's API endpoint validates that the
 * parent has completed the prior step before letting them advance.
 *
 * Stripe / Persona handoffs are wired in v1 as redirects to existing
 * /verify-identity and Stripe checkout flows. The status doc for AM
 * review notes which pieces are full vs. stubbed.
 */
export default function ParentalConsentClient({
  token,
  childEmail,
  childDisplayName,
  parentEmail,
  session,
}: {
  token: string;
  childEmail: string;
  childDisplayName: string | null;
  parentEmail: string;
  session: {
    email: string | null | undefined;
    identityVerified: boolean;
    membershipTier: string;
  } | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [attestationChecked, setAttestationChecked] = useState(false);

  const callbackUrl = useMemo(
    () => `/signup/parental-consent?token=${encodeURIComponent(token)}`,
    [token],
  );

  const isSignedIn = !!session;
  const isWrongAccount =
    isSignedIn && session.email && session.email.toLowerCase() !== parentEmail.toLowerCase();
  const isVerified = !!session?.identityVerified;
  const isProActive = session?.membershipTier === 'PRO' || session?.membershipTier === 'CONNECT';

  async function handleApprove() {
    if (submitting) return;
    if (!attestationChecked) {
      setError('Please confirm you are the parent or legal guardian.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/parental-consent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, attestation: 'I am the parent or legal guardian.' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not complete consent.');
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        style={{
          padding: '1.5rem',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          textAlign: 'center',
          ...TYPE.body,
          fontSize: '0.95rem',
          color: 'var(--cream)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
        <strong style={{ color: 'var(--orange)' }}>Done.</strong>
        <p style={{ margin: '0.5rem 0 0' }}>
          {childDisplayName || childEmail}&apos;s Passport is set up. They&apos;ll get an email at{' '}
          <strong>{childEmail}</strong> with a link to set their password and sign in.
        </p>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
          Your $5/mo subscription keeps their account active. You can manage everything from your settings.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div
          style={{
            padding: '0.7rem 0.9rem',
            background: 'rgba(196, 77, 77, 0.08)',
            border: '1px solid rgba(196, 77, 77, 0.3)',
            color: 'var(--red)',
            ...TYPE.body,
            fontSize: '0.82rem',
          }}
        >
          {error}
        </div>
      )}

      <Step
        index={1}
        title="Sign in to your Afterroar account"
        complete={isSignedIn && !isWrongAccount}
        active={!isSignedIn || !!isWrongAccount}
      >
        {!isSignedIn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <p style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
              Sign in with the email <strong style={{ color: 'var(--cream)' }}>{parentEmail}</strong>, or create a new
              account if you don&apos;t have one yet.
            </p>
            <button
              onClick={() => signIn('google', { callbackUrl })}
              style={{
                padding: '0.7rem 1rem',
                background: 'var(--panel-mute)',
                border: '1.5px solid var(--rule)',
                color: 'var(--cream)',
                ...TYPE.display,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Sign in with Google
            </button>
            <a
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              style={{
                padding: '0.7rem 1rem',
                background: 'transparent',
                border: '1.5px solid var(--rule)',
                color: 'var(--ink-soft)',
                ...TYPE.body,
                fontSize: '0.85rem',
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              Use email and password
            </a>
          </div>
        )}
        {isSignedIn && isWrongAccount && (
          <p style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--red)', margin: 0, lineHeight: 1.5 }}>
            You&apos;re signed in as <strong>{session.email}</strong>, but the consent email was sent to{' '}
            <strong>{parentEmail}</strong>.{' '}
            <a href={`/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`} style={{ color: 'var(--orange)' }}>
              Sign out and try again
            </a>
            .
          </p>
        )}
      </Step>

      <Step
        index={2}
        title="Verify your identity"
        complete={isVerified}
        active={isSignedIn && !isWrongAccount && !isVerified}
        disabled={!isSignedIn || !!isWrongAccount}
      >
        <p style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
          Quick photo of your ID. Takes about 60 seconds. We use Persona; no biometric data is retained on Afterroar&apos;s side.
        </p>
        {isSignedIn && !isVerified && (
          <a
            href={`/verify-identity?return=${encodeURIComponent(callbackUrl)}`}
            style={{
              display: 'inline-block',
              padding: '0.7rem 1rem',
              background: 'var(--orange)',
              color: 'var(--void, #1a1a1a)',
              ...TYPE.display,
              fontSize: '0.9rem',
              fontWeight: 700,
              textDecoration: 'none',
              marginTop: '0.5rem',
            }}
          >
            Verify identity
          </a>
        )}
      </Step>

      <Step
        index={3}
        title="Subscribe to Pro ($5/mo)"
        complete={isProActive}
        active={isVerified && !isProActive}
        disabled={!isVerified}
      >
        <p style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
          Your Pro subscription keeps {childDisplayName || childEmail}&apos;s Passport active. You can cancel any time;
          their account will pause until renewed.
        </p>
        {isVerified && !isProActive && (
          <a
            href={`/billing/subscribe?tier=pro&return=${encodeURIComponent(callbackUrl)}`}
            style={{
              display: 'inline-block',
              padding: '0.7rem 1rem',
              background: 'var(--orange)',
              color: 'var(--void, #1a1a1a)',
              ...TYPE.display,
              fontSize: '0.9rem',
              fontWeight: 700,
              textDecoration: 'none',
              marginTop: '0.5rem',
            }}
          >
            Subscribe to Pro
          </a>
        )}
      </Step>

      <Step
        index={4}
        title="Confirm and activate"
        complete={false}
        active={isProActive && isVerified}
        disabled={!isProActive || !isVerified}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            ...TYPE.body,
            fontSize: '0.88rem',
            color: 'var(--cream)',
            lineHeight: 1.5,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={attestationChecked}
            onChange={(e) => setAttestationChecked(e.target.checked)}
            style={{ marginTop: '0.2rem', accentColor: 'var(--orange)' }}
          />
          <span>
            I am the parent or legal guardian of {childDisplayName || childEmail}, and I authorize Afterroar to set up
            their Passport. I understand that misrepresenting this is a serious offense.
          </span>
        </label>
        <button
          onClick={handleApprove}
          disabled={submitting || !attestationChecked || !isProActive || !isVerified}
          style={{
            width: '100%',
            padding: '0.9rem 1.25rem',
            background: 'var(--orange)',
            border: 'none',
            color: 'var(--void, #1a1a1a)',
            ...TYPE.display,
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: submitting || !attestationChecked || !isProActive || !isVerified ? 'not-allowed' : 'pointer',
            opacity: submitting || !attestationChecked || !isProActive || !isVerified ? 0.5 : 1,
            marginTop: '0.5rem',
          }}
        >
          {submitting ? 'Activating…' : 'Activate their Passport'}
        </button>
      </Step>
    </div>
  );
}

function Step({
  index,
  title,
  complete,
  active,
  disabled,
  children,
}: {
  index: number;
  title: string;
  complete: boolean;
  active: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const opacity = disabled && !complete ? 0.4 : 1;
  return (
    <div
      style={{
        padding: '1rem 1.1rem',
        background: complete ? 'rgba(16, 185, 129, 0.06)' : active ? 'rgba(255, 130, 0, 0.05)' : 'var(--panel-mute)',
        border: `1.5px solid ${complete ? 'rgba(16, 185, 129, 0.4)' : active ? 'var(--orange)' : 'var(--rule)'}`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span
          style={{
            width: '1.7rem',
            height: '1.7rem',
            borderRadius: '50%',
            background: complete ? 'rgba(16, 185, 129, 0.2)' : 'var(--panel)',
            color: complete ? '#10b981' : active ? 'var(--orange)' : 'var(--ink-faint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...TYPE.display,
            fontSize: '0.85rem',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {complete ? '✓' : index}
        </span>
        <h3
          style={{
            ...TYPE.display,
            fontSize: '1rem',
            color: 'var(--cream)',
            margin: 0,
            fontWeight: 700,
          }}
        >
          {title}
        </h3>
      </div>
      <div style={{ paddingLeft: '2.45rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{children}</div>
    </div>
  );
}
