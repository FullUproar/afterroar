import { redirect } from 'next/navigation';

/**
 * Product is named "Connect" but the marketing landing lives at /store.
 * The natural guess URL is /connect — Manus correctly flagged that a
 * cold visitor who types /connect hits the dynamic [token] route and
 * gets a 404. Redirect to keep the obvious URL working without renaming
 * the existing /store landing (which has external links + SEO weight).
 */
export default function ConnectIndexPage(): never {
  redirect('/store');
}
