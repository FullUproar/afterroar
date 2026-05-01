'use client';

import { useState } from 'react';
import { TYPE } from '@/app/components/ui';

/**
 * 13-17 teen signup form. When requireConsent=true, this collects the
 * teen's identity + parent's email and submits a consent request. When
 * requireConsent=false, this collects email + password and creates the
 * minor account directly with privacy defaults.
 */
export default function TeenSignupForm({ requireConsent }: { requireConsent: boolean }) {
  const [childEmail, setChildEmail] = useState('');
  const [childDisplayName, setChildDisplayName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!childEmail.includes('@')) return setError('Enter a valid email.');
    if (requireConsent) {
      if (!parentEmail.includes('@')) return setError("Enter your parent's email.");
      if (parentEmail.toLowerCase() === childEmail.toLowerCase()) {
        return setError("Parent's email needs to be different from yours.");
      }
    } else {
      if (password.length < 8) return setError('Password must be at least 8 characters.');
    }

    setSubmitting(true);
    try {
      if (requireConsent) {
        const res = await fetch('/api/auth/parental-consent/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childEmail: childEmail.trim(),
            childDisplayName: childDisplayName.trim() || undefined,
            parentEmail: parentEmail.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || 'Could not send the request.');
          setSubmitting(false);
          return;
        }
        setDone(true);
      } else {
        const res = await fetch('/api/auth/signup/teen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: childEmail.trim(),
            displayName: childDisplayName.trim() || undefined,
            password,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || 'Signup failed.');
          setSubmitting(false);
          return;
        }
        setDone(true);
      }
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
    }
  }

  if (done) {
    if (requireConsent) {
      return (
        <div
          style={{
            padding: '1.25rem',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            ...TYPE.body,
            fontSize: '0.9rem',
            color: 'var(--cream)',
            lineHeight: 1.55,
          }}
        >
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📨</div>
          <strong style={{ color: 'var(--orange)' }}>Email sent to {parentEmail}.</strong>
          <p style={{ margin: '0.5rem 0 0' }}>
            Tell your parent to check their inbox and click the link. Once
            they confirm, you&apos;ll get an email to set your password and
            sign in.
          </p>
        </div>
      );
    }
    return (
      <div
        style={{
          padding: '1.25rem',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          ...TYPE.body,
          fontSize: '0.9rem',
          color: 'var(--cream)',
          lineHeight: 1.55,
        }}
      >
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📬</div>
        <strong style={{ color: 'var(--orange)' }}>Verify your email.</strong>
        <p style={{ margin: '0.5rem 0 0' }}>
          We sent a verification link to <strong>{childEmail}</strong>. Click
          it to finish setting up your Passport.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

      <Field label="Your display name" placeholder="optional" value={childDisplayName} onChange={setChildDisplayName} />
      <Field
        label="Your email"
        placeholder="you@example.com"
        type="email"
        value={childEmail}
        onChange={setChildEmail}
        required
      />

      {requireConsent ? (
        <Field
          label="A parent or guardian's email"
          hint="We'll email them everything they need. They'll set up their own Afterroar account, verify their identity, and approve yours."
          placeholder="parent@example.com"
          type="email"
          value={parentEmail}
          onChange={setParentEmail}
          required
        />
      ) : (
        <Field
          label="Password"
          placeholder="At least 8 characters"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
      )}

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
          marginTop: '0.5rem',
        }}
      >
        {submitting
          ? requireConsent
            ? 'Sending email…'
            : 'Creating Passport…'
          : requireConsent
            ? "Email my parent"
            : 'Create Passport'}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  placeholder,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span
        style={{
          ...TYPE.body,
          fontSize: '0.85rem',
          color: 'var(--ink-soft)',
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--orange)', marginLeft: 4 }}>*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={type === 'password' ? 'new-password' : type === 'email' ? 'email' : 'off'}
        style={{
          width: '100%',
          padding: '0.7rem 0.85rem',
          background: 'var(--panel-mute)',
          border: '1.5px solid var(--rule)',
          color: 'var(--cream)',
          ...TYPE.body,
          fontSize: '0.95rem',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
      />
      {hint && (
        <span style={{ ...TYPE.body, fontSize: '0.78rem', color: 'var(--ink-faint)', lineHeight: 1.45 }}>{hint}</span>
      )}
    </label>
  );
}
