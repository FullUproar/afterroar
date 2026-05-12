import { NextResponse } from 'next/server';

/**
 * GET /api/push/vapid-public-key
 *
 * Returns the base64-url-encoded VAPID public key the client needs to
 * subscribe to Web Push. Public by design — the private key stays
 * server-side and signs outgoing pushes.
 *
 * Required env var: VAPID_PUBLIC_KEY (set both VAPID_PUBLIC_KEY and
 * VAPID_PRIVATE_KEY on the Vercel project; generate with `npx web-push
 * generate-vapid-keys`).
 */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'Push not configured (VAPID_PUBLIC_KEY missing)' },
      { status: 503 },
    );
  }
  return NextResponse.json({ key }, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
