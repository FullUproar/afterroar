"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChromeNav, PlayerCard, Workbench } from "@/app/components/card-shell";
import { TYPE, TitleBar } from "@/app/components/ui";
import { signIn } from "next-auth/react";

type AgeRadio = '' | 'adult' | 'teen' | 'under13';
type Stage = 'gate' | 'creds';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Two-stage signup. Stage 1 ("gate") = ToS + age radio + Continue.
  // Stage 2 ("creds") = Google or email/password — only shown after the
  // user has self-attested as 18+ on stage 1. Teens are routed to
  // /signup/teen on Continue; under-13 to /signup/blocked.
  const [stage, setStage] = useState<Stage>('gate');

  // Stage 1 state
  const [agreedTos, setAgreedTos] = useState(false);
  const [ageRadio, setAgeRadio] = useState<AgeRadio>('');
  const [gateSubmitting, setGateSubmitting] = useState(false);

  // Stage 2 state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Cohort cookie check on mount: if device already attested or is
  // <13-blocked, route accordingly without re-asking.
  useEffect(() => {
    fetch('/api/auth/age-gate/check')
      .then((r) => r.json())
      .then((d) => {
        if (d.cohort === 'under13') router.replace('/signup/blocked');
        else if (d.cohort === 'teen') router.replace('/signup/teen');
        else if (d.cohort === 'adult') setStage('creds');
      })
      .catch(() => {});
  }, [router]);

  async function handleContinue() {
    setError(null);
    if (!agreedTos) {
      setError('Please agree to the Terms of Service.');
      return;
    }
    if (!ageRadio) {
      setError('Please tell us your age.');
      return;
    }

    setGateSubmitting(true);
    try {
      const res = await fetch('/api/auth/age-gate/cohort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort: ageRadio }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not save your selection.');
        setGateSubmitting(false);
        return;
      }
      if (ageRadio === 'under13') {
        router.replace('/signup/blocked');
        return;
      }
      if (ageRadio === 'teen') {
        router.replace('/signup/teen');
        return;
      }
      // Adult: advance to creds stage
      setStage('creds');
      setGateSubmitting(false);
    } catch {
      setError('Network error. Try again.');
      setGateSubmitting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
          confirmedAdult: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Signup failed");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach the server");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <ChromeNav signedIn={false} />
        <Workbench>
          <PlayerCard maxWidth="26rem">
            <TitleBar left="Check Your Inbox" />
            <div
              style={{
                padding: "2rem var(--pad-x) 1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "3rem", lineHeight: 1, color: "var(--orange)" }}>📬</div>
              <h1
                style={{
                  ...TYPE.display,
                  fontSize: "clamp(1.4rem, 4vw, 1.8rem)",
                  color: "var(--cream)",
                  margin: 0,
                }}
              >
                Verify your email
              </h1>
              <p style={{ ...TYPE.body, fontSize: "0.9rem", color: "var(--ink-soft)", lineHeight: 1.5, margin: 0 }}>
                We sent a verification link to <strong style={{ color: "var(--cream)" }}>{email}</strong>. Click it to finish setting up your Passport.
              </p>
              <p style={{ ...TYPE.body, fontSize: "0.85rem", color: "var(--ink-faint)", margin: 0, lineHeight: 1.5 }}>
                Didn&apos;t get it? Check spam, or sign up again to resend.
              </p>
              <a
                href="/login"
                style={{
                  color: "var(--orange)",
                  ...TYPE.body,
                  fontSize: "0.88rem",
                  marginTop: "0.5rem",
                }}
              >
                Back to sign in
              </a>
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
          <TitleBar left={stage === 'gate' ? 'Create Passport' : 'Almost There'} />
          <div
            style={{
              padding: "2rem var(--pad-x) 1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <h1
                style={{
                  ...TYPE.display,
                  fontSize: "clamp(1.6rem, 5vw, 2rem)",
                  color: "var(--cream)",
                  margin: 0,
                  lineHeight: 1,
                }}
              >
                Create your<br />Passport
              </h1>
              <p style={{ ...TYPE.body, fontSize: "0.9rem", color: "var(--ink-soft)", margin: "0.75rem 0 0", lineHeight: 1.5 }}>
                {stage === 'gate'
                  ? 'A couple quick things, then you\'re in.'
                  : 'Pick how you want to sign in.'}
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: "0.75rem 0.9rem",
                  background: "rgba(196, 77, 77, 0.08)",
                  border: "1px solid rgba(196, 77, 77, 0.3)",
                  color: "var(--red)",
                  ...TYPE.body,
                  fontSize: "0.82rem",
                }}
              >
                {error}
              </div>
            )}

            {stage === 'gate' ? (
              <GateStage
                agreedTos={agreedTos}
                onTosChange={setAgreedTos}
                ageRadio={ageRadio}
                onAgeChange={setAgeRadio}
                onContinue={handleContinue}
                submitting={gateSubmitting}
              />
            ) : (
              <CredsStage
                callbackUrl={callbackUrl}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                displayName={displayName}
                setDisplayName={setDisplayName}
                submit={submit}
                submitting={submitting}
                onBack={() => setStage('gate')}
              />
            )}

            <p
              style={{
                ...TYPE.body,
                fontSize: "0.82rem",
                color: "var(--ink-soft)",
                textAlign: "center",
                margin: 0,
              }}
            >
              Already have a Passport?{" "}
              <a href="/login" style={{ color: "var(--orange)" }}>
                Sign in
              </a>
            </p>
            <p
              style={{
                ...TYPE.body,
                fontSize: "0.85rem",
                color: "var(--ink-faint)",
                textAlign: "center",
                margin: 0,
              }}
            >
              <a href="/passport-101" style={{ color: "var(--ink-soft)" }}>
                What is a Passport? →
              </a>
            </p>
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}

function GateStage({
  agreedTos,
  onTosChange,
  ageRadio,
  onAgeChange,
  onContinue,
  submitting,
}: {
  agreedTos: boolean;
  onTosChange: (v: boolean) => void;
  ageRadio: AgeRadio;
  onAgeChange: (v: AgeRadio) => void;
  onContinue: () => void;
  submitting: boolean;
}) {
  const canContinue = agreedTos && ageRadio !== '' && !submitting;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ToS checkbox */}
      <label style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.85rem 1rem',
        background: agreedTos ? 'rgba(255, 130, 0, 0.06)' : 'var(--panel-mute)',
        border: `1.5px solid ${agreedTos ? 'var(--orange)' : 'var(--rule)'}`,
        cursor: 'pointer',
        ...TYPE.body,
        fontSize: '0.9rem',
        color: 'var(--cream)',
        lineHeight: 1.45,
      }}>
        <input
          type="checkbox"
          checked={agreedTos}
          onChange={(e) => onTosChange(e.target.checked)}
          style={{ marginTop: '0.2rem', accentColor: 'var(--orange)' }}
        />
        <span>
          I have read and agree to the{' '}
          <a href="/terms" style={{ color: 'var(--orange)' }} target="_blank" rel="noopener">
            Terms of Service
          </a>
          {' '}and{' '}
          <a href="/privacy" style={{ color: 'var(--orange)' }} target="_blank" rel="noopener">
            Privacy Policy
          </a>
          .
        </span>
      </label>

      {/* Age radio */}
      <fieldset style={{
        border: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}>
        <legend style={{
          ...TYPE.body,
          fontSize: '0.92rem',
          color: 'var(--cream)',
          fontWeight: 600,
          marginBottom: '0.4rem',
          padding: 0,
        }}>
          How old are you?
        </legend>

        <RadioOption value="adult" label="18 or older" current={ageRadio} onChange={onAgeChange} />
        <RadioOption value="teen" label="13 to 17" current={ageRadio} onChange={onAgeChange} />
        <RadioOption value="under13" label="Under 13" current={ageRadio} onChange={onAgeChange} />
      </fieldset>

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        style={{
          width: '100%',
          padding: '0.9rem 1.25rem',
          background: 'var(--orange)',
          border: 'none',
          color: 'var(--void, #1a1a1a)',
          ...TYPE.display,
          fontSize: '0.95rem',
          fontWeight: 700,
          cursor: !canContinue ? 'not-allowed' : 'pointer',
          opacity: !canContinue ? 0.5 : 1,
        }}
      >
        {submitting ? 'Continuing…' : 'Continue'}
      </button>
    </div>
  );
}

function RadioOption({
  value,
  label,
  current,
  onChange,
}: {
  value: AgeRadio;
  label: string;
  current: AgeRadio;
  onChange: (v: AgeRadio) => void;
}) {
  const selected = current === value;
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.7rem',
      padding: '0.7rem 0.95rem',
      background: selected ? 'rgba(255, 130, 0, 0.08)' : 'var(--panel-mute)',
      border: `1.5px solid ${selected ? 'var(--orange)' : 'var(--rule)'}`,
      cursor: 'pointer',
      ...TYPE.body,
      fontSize: '0.92rem',
      color: 'var(--cream)',
      transition: 'border-color 0.15s ease, background 0.15s ease',
    }}>
      <input
        type="radio"
        name="age-cohort"
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
        style={{ accentColor: 'var(--orange)' }}
      />
      <span>{label}</span>
    </label>
  );
}

function CredsStage({
  callbackUrl,
  email,
  setEmail,
  password,
  setPassword,
  displayName,
  setDisplayName,
  submit,
  submitting,
  onBack,
}: {
  callbackUrl: string;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  submit: (e: React.FormEvent) => void;
  submitting: boolean;
  onBack: () => void;
}) {
  return (
    <>
      <button
        onClick={() => signIn('google', { callbackUrl })}
        disabled={submitting}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          width: '100%',
          padding: '0.9rem 1.25rem',
          background: 'var(--panel-mute)',
          border: '1.5px solid var(--rule)',
          color: 'var(--cream)',
          ...TYPE.display,
          fontSize: '0.95rem',
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.5 : 1,
          transition: 'border-color 0.2s ease',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign up with Google
      </button>

      <Divider />

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Field
          label="Display name"
          hint="What other players see. You can change this later."
          value={displayName}
          onChange={setDisplayName}
          placeholder="optional"
        />
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          type="email"
          required
        />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          type="password"
          required
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
            marginTop: '0.5rem',
          }}
        >
          {submitting ? 'Creating…' : 'Create Passport'}
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--ink-soft)',
          ...TYPE.body,
          fontSize: '0.82rem',
          textDecoration: 'underline',
          cursor: 'pointer',
          padding: 0,
          marginTop: '-0.5rem',
        }}
      >
        ← Back
      </button>
    </>
  );
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--ink-faint)' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
      <span style={{ ...TYPE.body, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>or</span>
      <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        <span style={{ ...TYPE.body, fontSize: '0.82rem', color: 'var(--ink-faint)', lineHeight: 1.4 }}>{hint}</span>
      )}
    </label>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <p style={{ color: "var(--orange)" }}>Loading…</p>
        </main>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
