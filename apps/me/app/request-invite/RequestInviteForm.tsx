'use client';

import { useState } from 'react';
import { TYPE, inputStyle, Button } from '@/app/components/ui';

interface ConsentKey {
  key: 'credoRead' | 'dataNeverSold' | 'deleteAnytime' | 'storeRecognitionConsent';
  label: string;
  body: string;
}

const CONSENTS: ConsentKey[] = [
  {
    key: 'credoRead',
    label: 'I read the Credo.',
    body: 'I understand the order of priorities Afterroar operates under: players first, then store owners, then the federation, then the broader ecosystem, then the business.',
  },
  {
    key: 'dataNeverSold',
    label: 'My data is mine.',
    body: 'Afterroar will not sell my data, share it with advertisers, or use it for behavioral targeting. Stores I check in at see only that I checked in — never my profile, library, or activity elsewhere.',
  },
  {
    key: 'deleteAnytime',
    label: 'I can leave anytime.',
    body: 'I can delete my Passport from Settings. A 30-day grace window protects against accidents; after that, my account and personal data are permanently gone.',
  },
  {
    key: 'storeRecognitionConsent',
    label: 'Recognition is opt-in, per store.',
    body: 'A store I haven\'t consented to will not see me beyond a check-in event. To unlock store recognition (loyalty, history, preferences) I have to grant it explicitly, store by store.',
  },
];

export function RequestInviteForm() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [whyInterested, setWhyInterested] = useState('');
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allConsented = CONSENTS.every((c) => consents[c.key] === true);
  const emailLooksOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = allConsented && emailLooksOk && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/invite-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim() || undefined,
          whyInterested: whyInterested.trim() || undefined,
          consents,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Try again.');
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
          background: 'rgba(16, 185, 129, 0.06)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2.4rem', marginBottom: '0.4rem' }}>📬</div>
        <p
          style={{
            ...TYPE.displayMd,
            fontSize: '1.05rem',
            color: 'var(--cream)',
            margin: '0 0 0.5rem',
            fontWeight: 700,
          }}
        >
          We&apos;ll be in touch.
        </p>
        <p
          style={{
            ...TYPE.body,
            color: 'var(--ink-soft)',
            fontSize: '0.88rem',
            lineHeight: 1.55,
            margin: 0,
            maxWidth: '24rem',
            marginInline: 'auto',
          }}
        >
          When we approve your request you&apos;ll get a code at <strong style={{ color: 'var(--cream)' }}>{email}</strong>.
          Drop us a note at{' '}
          <a href="mailto:afterroar@fulluproar.com" style={{ color: 'var(--orange)' }}>
            afterroar@fulluproar.com
          </a>{' '}
          if you don&apos;t hear back in a few days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--cream)', fontWeight: 600 }}>
          Email
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={inputStyle()}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--cream)', fontWeight: 600 }}>
          What should we call you? <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>(optional)</span>
        </span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name"
          maxLength={80}
          style={inputStyle()}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span style={{ ...TYPE.body, fontSize: '0.85rem', color: 'var(--cream)', fontWeight: 600 }}>
          Tell us about yourself{' '}
          <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>(optional, helps us prioritize)</span>
        </span>
        <textarea
          value={whyInterested}
          onChange={(e) => setWhyInterested(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Where do you play? What store do you wish would join? What about Afterroar caught your eye?"
          style={{
            ...inputStyle(),
            resize: 'vertical',
            minHeight: '5rem',
            fontFamily: 'inherit',
          }}
        />
      </label>

      <div>
        <p
          style={{
            ...TYPE.mono,
            color: 'var(--orange)',
            fontSize: '0.66rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 700,
            margin: '0.5rem 0 0.75rem',
          }}
        >
          Confirm you understand
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {CONSENTS.map((c) => {
            const checked = consents[c.key] === true;
            return (
              <label
                key={c.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  padding: '0.85rem 0.95rem',
                  background: checked ? 'rgba(255, 130, 0, 0.06)' : 'var(--panel-mute)',
                  border: `1px solid ${checked ? 'var(--orange)' : 'var(--rule)'}`,
                  cursor: 'pointer',
                  transition: 'background 120ms ease, border-color 120ms ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setConsents((prev) => ({ ...prev, [c.key]: e.target.checked }))
                  }
                  style={{ marginTop: '0.2rem', accentColor: 'var(--orange)' }}
                />
                <span>
                  <span
                    style={{
                      ...TYPE.displayMd,
                      display: 'block',
                      color: 'var(--cream)',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      marginBottom: '0.2rem',
                    }}
                  >
                    {c.label}
                  </span>
                  <span
                    style={{
                      ...TYPE.body,
                      color: 'var(--ink-soft)',
                      fontSize: '0.83rem',
                      lineHeight: 1.55,
                    }}
                  >
                    {c.body}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {error ? (
        <p
          style={{
            ...TYPE.body,
            color: 'var(--red)',
            fontSize: '0.85rem',
            margin: 0,
            padding: '0.6rem 0.85rem',
            background: 'rgba(196, 77, 77, 0.08)',
            border: '1px solid rgba(196, 77, 77, 0.35)',
          }}
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={!canSubmit} variant="primary">
        {submitting ? 'Submitting…' : 'Request my Passport'}
      </Button>
    </form>
  );
}
