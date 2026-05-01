import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth-config';
import { ChromeNav, PlayerCard, Workbench } from '@/app/components/card-shell';
import { TYPE, TitleBar } from '@/app/components/ui';
import ParentalConsentClient from './ParentalConsentClient';

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * Parent-side landing page for the magic-link consent flow. Path:
 *   /signup/parental-consent?token=...
 *
 * Server validates the token. If pending and unexpired, hand off to the
 * client component for the actual flow (sign in / verify ID / attest /
 * subscribe Pro / activate kid).
 *
 * Unhappy paths: token missing/invalid → invalid-link page. Expired →
 * expired page. Already completed → "this account is set up, sign in".
 */
export default async function ParentalConsentPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return <ConsentErrorState title="Invalid link" body="This link is missing the consent token. Ask your child to send the email again from /signup/teen." />;
  }

  const request = await prisma.minorConsentRequest.findUnique({
    where: { token },
  });

  if (!request) {
    return <ConsentErrorState title="Link not found" body="This link is invalid or has been retired. Ask your child to send a fresh one from /signup/teen." />;
  }

  if (request.status === 'completed') {
    return (
      <ConsentErrorState
        title="Already set up"
        body={`This account has been confirmed. ${request.childDisplayName || 'Your child'} can sign in at afterroar.me/login.`}
      />
    );
  }

  if (request.status === 'expired' || request.expiresAt < new Date()) {
    if (request.status !== 'expired') {
      await prisma.minorConsentRequest.update({
        where: { id: request.id },
        data: { status: 'expired' },
      });
    }
    return (
      <ConsentErrorState
        title="Link expired"
        body="For safety, consent links expire after 7 days. Ask your child to start over at /signup/teen."
      />
    );
  }

  if (request.status === 'declined') {
    return (
      <ConsentErrorState
        title="This request was declined"
        body="If this was a mistake, your child can start a fresh request at /signup/teen."
      />
    );
  }

  // Token is valid + pending. Show the consent flow.
  const session = await auth();
  const sessionUser = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id as string },
        select: {
          id: true,
          email: true,
          identityVerified: true,
          membershipTier: true,
        },
      })
    : null;

  return (
    <>
      <ChromeNav signedIn={!!sessionUser} email={sessionUser?.email} />
      <Workbench>
        <PlayerCard maxWidth="32rem">
          <TitleBar left="Parent Consent" />
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
                Set up{' '}
                <span style={{ color: 'var(--orange)' }}>
                  {request.childDisplayName || request.childEmail}
                </span>
                ’s Passport
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
                A few quick steps. Your account stays connected to theirs as long as you’re an Afterroar member.
              </p>
            </div>

            <ParentalConsentClient
              token={token}
              childEmail={request.childEmail}
              childDisplayName={request.childDisplayName}
              parentEmail={request.parentEmail}
              initialConsentFeePaid={!!request.consentFeePaidAt}
              session={
                sessionUser
                  ? {
                      email: sessionUser.email,
                      identityVerified: sessionUser.identityVerified,
                      membershipTier: sessionUser.membershipTier,
                    }
                  : null
              }
            />
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}

function ConsentErrorState({ title, body }: { title: string; body: string }) {
  return (
    <>
      <ChromeNav signedIn={false} />
      <Workbench>
        <PlayerCard maxWidth="26rem">
          <TitleBar left="Hmm" />
          <div
            style={{
              padding: '2rem var(--pad-x) 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                ...TYPE.display,
                fontSize: '1.5rem',
                color: 'var(--cream)',
                margin: 0,
              }}
            >
              {title}
            </h1>
            <p style={{ ...TYPE.body, fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.55, margin: 0 }}>
              {body}
            </p>
            <a href="/" style={{ color: 'var(--orange)', ...TYPE.body, fontSize: '0.88rem', marginTop: '0.5rem' }}>
              Back to Afterroar
            </a>
          </div>
        </PlayerCard>
      </Workbench>
    </>
  );
}
