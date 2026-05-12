import { NextResponse } from 'next/server';

/**
 * Convenience redirect so typing /logout (or following an old link)
 * goes to the actual NextAuth signout endpoint instead of 404'ing.
 *
 * 2026-05-11 audit caught this — /logout was rendering the branded
 * 404 page, which looked like a typo but is in fact a real auth path
 * users would reasonably expect to work.
 */
export function GET(request: Request) {
  const callback = new URL('/login', request.url).toString();
  const target = new URL('/api/auth/signout', request.url);
  target.searchParams.set('callbackUrl', callback);
  return NextResponse.redirect(target);
}
