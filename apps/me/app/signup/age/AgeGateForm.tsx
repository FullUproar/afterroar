'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TYPE } from '@/app/components/ui';

/**
 * Neutral age screen form. Three-input DOB picker (month/day/year). No
 * defaults toward "over 13", no copy implying a minimum age. Submission
 * POSTs to /api/auth/age-gate which sets the appropriate cookies and
 * redirects.
 */
export default function AgeGateForm() {
  const router = useRouter();
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);

    if (!m || m < 1 || m > 12) return setError('Enter a valid month (1-12).');
    if (!d || d < 1 || d > 31) return setError('Enter a valid day (1-31).');
    if (!y || y < 1900) return setError('Enter a valid year.');

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/age-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: m, day: d, year: y }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not verify age. Try again.');
        setSubmitting(false);
        return;
      }
      router.push(data.redirect || '/signup');
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
    }
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
            fontSize: '0.82rem',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: '0.6rem' }}>
        <DobInput label="Month" placeholder="MM" value={month} onChange={setMonth} maxLength={2} autoFocus />
        <DobInput label="Day" placeholder="DD" value={day} onChange={setDay} maxLength={2} />
        <DobInput label="Year" placeholder="YYYY" value={year} onChange={setYear} maxLength={4} />
      </div>

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
          marginTop: '0.25rem',
        }}
      >
        {submitting ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
}

function DobInput({
  label,
  placeholder,
  value,
  onChange,
  maxLength,
  autoFocus,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  autoFocus?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span
        style={{
          ...TYPE.body,
          fontSize: '0.78rem',
          color: 'var(--ink-soft)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, '').slice(0, maxLength);
          onChange(v);
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        style={{
          width: '100%',
          padding: '0.7rem 0.85rem',
          background: 'var(--panel-mute)',
          border: '1.5px solid var(--rule)',
          color: 'var(--cream)',
          ...TYPE.body,
          fontSize: '1rem',
          outline: 'none',
          textAlign: 'center',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
      />
    </label>
  );
}
