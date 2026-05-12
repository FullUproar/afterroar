import { NextResponse } from 'next/server';

/**
 * GET /api/auth/invite-gate-status
 *
 * Public read of whether Passport signup is currently invite-gated.
 * Client-side signup uses this to decide whether to redirect to
 * /request-invite when no code is on the URL.
 *
 * Toggle via INVITE_GATE_ENABLED env (default off so local dev + early
 * staging work without setting an env var).
 */
export async function GET() {
  const enabled = process.env.INVITE_GATE_ENABLED === 'true';
  return NextResponse.json(
    { enabled },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
