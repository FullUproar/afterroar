import { redirect } from 'next/navigation';
import { isUnder13Blocked, readAgeGateCookie } from '@/lib/age-gate';
import { ChromeNav, PlayerCard, Workbench } from '@/app/components/card-shell';
import { TYPE, TitleBar } from '@/app/components/ui';
import AgeGateForm from './AgeGateForm';

/**
 * Neutral age screen. COPPA-compliant: no defaults, no "you must be 13+"
 * copy. We ask for date of birth and route based on the answer.
 *
 * If the visitor is already gated through, we forward them to the right
 * next step. If they tried <13 previously and got blocked, we honor the
 * block cookie and refuse to show the form.
 */
export default async function AgeGatePage() {
  if (await isUnder13Blocked()) {
    redirect('/signup/blocked');
  }

  const existing = await readAgeGateCookie();
  if (existing) {
    if (existing.cohort === 'adult') redirect('/signup');
    if (existing.cohort === 'teen') redirect('/signup/teen');
    if (existing.cohort === 'under13') redirect('/signup/blocked');
  }

  return (
    <>
      <ChromeNav signedIn={false} />
      <Workbench>
        <PlayerCard maxWidth="26rem">
          <TitleBar left="Quick Question" />
          <div
            style={{
              padding: '1.75rem var(--pad-x) 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <h1
                style={{
                  ...TYPE.display,
                  fontSize: 'clamp(1.4rem, 5vw, 1.8rem)',
                  color: 'var(--cream)',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                When were you born?
              </h1>
              <p
                style={{
                  ...TYPE.body,
                  fontSize: '0.9rem',
                  color: 'var(--ink-soft)',
                  margin: '0.75rem 0 0',
                  lineHeight: 1.5,
                }}
              >
                We ask everyone — it shapes what your Passport unlocks.
              </p>
            </div>

            <AgeGateForm />

            <p
              style={{
                ...TYPE.body,
                fontSize: '0.78rem',
                color: 'var(--ink-faint)',
                lineHeight: 1.55,
                margin: 0,
                textAlign: 'center',
              }}
            >
              We use your date of birth to keep Afterroar safe and to route
              you to the right experience. You can read more in our{' '}
              <a href="/privacy" style={{ color: 'var(--orange)' }}>
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}
