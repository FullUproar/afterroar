/**
 * /auth/register-link — Bridge between the register tablet and a Passport-rooted
 * Store Ops session.
 *
 * Flow (companion to the pairing-code flow at /dashboard/devices):
 *   1. Register tablet opens the system browser to:
 *        afterroar.store/auth/register-link?device_id=<uuid>&return=me.afterroar.register://auth/callback
 *   2. Middleware redirects to /login if not signed in (NextAuth + AfterroarProvider, which is Passport)
 *   3. After sign-in, this page renders, mints a RegisterDevice token from the active session,
 *      and redirects the browser to:
 *        me.afterroar.register://auth/callback?token=...&store_id=...&device_id=...
 *   4. Android catches the deep link, Capacitor App fires appUrlOpen, register stores the token.
 *
 * This is server-rendered; no JS bundle. The redirect happens in <meta http-equiv="refresh">
 * because Capacitor's WebView doesn't always honor 302s to custom schemes.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "node:crypto";

interface PageProps {
  searchParams: Promise<{ device_id?: string; return?: string; display_name?: string }>;
}

const ALLOWED_RETURN_SCHEMES = ["me.afterroar.register"];

function mintToken(): { plaintext: string; hash: string } {
  const plaintext = `ardv_${randomBytes(32).toString("hex")}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

export default async function RegisterLinkPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const deviceId = params.device_id?.trim();
  const returnUrl = params.return?.trim();
  const displayName = params.display_name?.trim();

  if (!deviceId || !returnUrl) {
    return (
      <ErrorPage title="Missing parameters">
        The link is missing either device_id or return URL. Try again from the register app.
      </ErrorPage>
    );
  }

  // Defense-in-depth on the return URL — only allow our app's custom scheme.
  let parsedReturn: URL;
  try {
    parsedReturn = new URL(returnUrl);
  } catch {
    return <ErrorPage title="Invalid return URL">The return URL doesn't parse.</ErrorPage>;
  }
  if (!ALLOWED_RETURN_SCHEMES.includes(parsedReturn.protocol.replace(":", ""))) {
    return (
      <ErrorPage title="Disallowed return URL">
        Return URL scheme not on the allowlist.
      </ErrorPage>
    );
  }

  // Require a Store Ops session (which is Passport-rooted via AfterroarProvider).
  // Middleware should have redirected to /login already if not, but defensive check.
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(
        `/auth/register-link?device_id=${encodeURIComponent(deviceId)}&return=${encodeURIComponent(returnUrl)}${
          displayName ? `&display_name=${encodeURIComponent(displayName)}` : ""
        }`,
      )}`,
    );
  }

  // Resolve the staff record (and store) for this user.
  const staff = await prisma.posStaff.findFirst({
    where: { user_id: session.user.id, active: true },
    select: { id: true, name: true, store_id: true },
  });
  if (!staff) {
    return (
      <ErrorPage title="No active staff record">
        Your Passport account is signed in, but you don't have an active staff record on any
        Store Ops store. Ask the owner to invite you, then try again.
      </ErrorPage>
    );
  }

  // Mint the device token + persist.
  const { plaintext, hash } = mintToken();
  const finalDisplayName = displayName || `${staff.name}'s register`;

  await prisma.registerDevice.create({
    data: {
      store_id: staff.store_id,
      paired_by: session.user.id,
      display_name: finalDisplayName,
      token_hash: hash,
      device_id: deviceId,
    },
  });

  // Build the deep-link redirect with token in the query string. The plaintext
  // travels back over the deep link; that's the only path it appears outside
  // the device. (sha256 hash is what the server stores.)
  parsedReturn.searchParams.set("token", plaintext);
  parsedReturn.searchParams.set("store_id", staff.store_id);
  parsedReturn.searchParams.set("device_id", deviceId);

  // Render a tiny page that does both <meta refresh> and a JS redirect — the
  // WebView fallback for custom schemes that don't follow 302s. The page is
  // visible for ~half a second; if the deep link doesn't fire (broken install,
  // user opened in a non-Android browser), the manual link below is a recovery.
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="refresh" content={`0;url=${parsedReturn.toString()}`} />
        <title>Returning to register…</title>
        <style>{`
          body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e2e8f0;
                 display: flex; align-items: center; justify-content: center;
                 min-height: 100vh; margin: 0; padding: 1rem; text-align: center; }
          .card { max-width: 28rem; }
          h1 { color: #FBDB65; font-size: 1.5rem; margin: 0 0 0.5rem; }
          p { color: #94a3b8; line-height: 1.5; }
          a { color: #FF8200; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <h1>Signed in!</h1>
          <p>Returning you to the register app…</p>
          <p style={{ fontSize: "0.85rem", marginTop: "1.5rem" }}>
            Not redirecting? <a href={parsedReturn.toString()}>Tap here to continue.</a>
          </p>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){window.location.href = ${JSON.stringify(parsedReturn.toString())}}, 100);`,
          }}
        />
      </body>
    </html>
  );
}

function ErrorPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        <style>{`
          body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e2e8f0;
                 display: flex; align-items: center; justify-content: center;
                 min-height: 100vh; margin: 0; padding: 1rem; text-align: center; }
          .card { max-width: 28rem; }
          h1 { color: #ef4444; font-size: 1.5rem; margin: 0 0 0.75rem; }
          p { color: #94a3b8; line-height: 1.5; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <h1>{title}</h1>
          <p>{children}</p>
        </div>
      </body>
    </html>
  );
}
