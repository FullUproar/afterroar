import { redirect } from 'next/navigation';
import { readAgeGateCookie, parentalConsentRequired } from '@/lib/age-gate';
import { ChromeNav, PlayerCard, Workbench } from '@/app/components/card-shell';
import { TYPE, TitleBar } from '@/app/components/ui';
import TeenSignupForm from './TeenSignupForm';

/**
 * 13-17 cohort landing. Two modes depending on the
 * PARENTAL_CONSENT_REQUIRED feature flag:
 *
 *   true  → Parental-consent flow. Teen enters their email + display name +
 *           parent's email. We email the parent a magic link. The teen sees
 *           a "tell your parent to check their inbox" confirmation.
 *
 *   false → Direct teen signup with privacy-by-default. No parent linkage.
 *           (Activated after lawyer review per Shawn's plan.)
 *
 * Either way, the teen account inherits the privacy-by-default cohort:
 *   - defaultVisibility = "circle"
 *   - Cannot ID-verify (Persona is 18+)
 *   - Cannot host public events
 *   - Sees only "all-ages" + "13+" venue events
 *   - No adult-to-minor DMs
 */
export default async function TeenSignupPage() {
  const cookie = await readAgeGateCookie();
  if (!cookie || cookie.cohort !== 'teen') {
    redirect('/signup/age');
  }

  const requireConsent = parentalConsentRequired();

  return (
    <>
      <ChromeNav signedIn={false} />
      <Workbench>
        <PlayerCard maxWidth="28rem">
          <TitleBar left={requireConsent ? 'One More Step' : 'Almost There'} />
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
                  fontSize: 'clamp(1.4rem, 5vw, 1.7rem)',
                  color: 'var(--cream)',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {requireConsent
                  ? 'We need a parent’s OK first'
                  : 'Set up your Passport'}
              </h1>
              <p
                style={{
                  ...TYPE.body,
                  fontSize: '0.9rem',
                  color: 'var(--ink-soft)',
                  margin: '0.75rem 0 0',
                  lineHeight: 1.55,
                }}
              >
                {requireConsent
                  ? 'Because you’re under 18, we ask a parent or guardian to set things up with you. They’ll get an email; once they confirm, your Passport is good to go.'
                  : 'Your Passport will be set to its most private settings by default. You can adjust them later from your settings.'}
              </p>
            </div>

            <TeenSignupForm requireConsent={requireConsent} />

            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'rgba(255, 130, 0, 0.06)',
                border: '1px solid rgba(255, 130, 0, 0.2)',
                ...TYPE.body,
                fontSize: '0.78rem',
                color: 'var(--ink-soft)',
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: 'var(--orange)' }}>What you’ll get:</strong>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                <li>Find game nights at your favorite local stores</li>
                <li>Track the games you’ve played</li>
                <li>Earn badges and points for showing up</li>
              </ul>
              <strong style={{ color: 'var(--orange)', display: 'block', marginTop: '0.6rem' }}>
                What’s held back until you’re older:
              </strong>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                <li>Public game nights at private homes</li>
                <li>Direct messages from adults you don’t know</li>
                <li>21+ events</li>
              </ul>
            </div>

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
              By signing up, you agree to our{' '}
              <a href="/terms" style={{ color: 'var(--orange)' }}>Terms</a> and{' '}
              <a href="/privacy" style={{ color: 'var(--orange)' }}>Privacy Policy</a>.
            </p>
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}
