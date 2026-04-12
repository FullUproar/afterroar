/**
 * OAuth client registry — hardcoded allowlist for Phase 1.
 *
 * Each client represents an app that can use "Log in with Afterroar."
 * client_id + redirect_uri must both match for an authorize request
 * to proceed. No open redirectors.
 *
 * Eventually this becomes a DB table for dynamic client registration.
 */

import { timingSafeEqual } from 'crypto';

export interface OAuthClient {
  id: string;
  name: string;
  redirectUris: string[];
  secret: string;
}

const IS_PROD = process.env.NODE_ENV === 'production';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val && IS_PROD) {
    throw new Error(`[FATAL] Missing required env var: ${name}. Refusing to start with no OAuth client secret.`);
  }
  return val || `dev-only-${name}`;
}

const PROD_ONLY_LOCALHOST: string[] = [];
const DEV_LOCALHOST_3000 = IS_PROD ? PROD_ONLY_LOCALHOST : ['http://localhost:3000/api/auth/callback/afterroar'];
const DEV_LOCALHOST_3002 = IS_PROD ? PROD_ONLY_LOCALHOST : ['http://localhost:3002/api/auth/callback/afterroar'];

const CLIENTS: Record<string, OAuthClient> = {
  'fulluproar-site': {
    id: 'fulluproar-site',
    name: "Full Uproar",
    redirectUris: [
      'https://fulluproar.com/api/auth/callback/afterroar',
      'https://www.fulluproar.com/api/auth/callback/afterroar',
      ...DEV_LOCALHOST_3000,
    ],
    secret: requireEnv('OAUTH_CLIENT_SECRET_FULLUPROAR'),
  },
  'fulluproar-hq': {
    id: 'fulluproar-hq',
    name: "Fugly's HQ",
    redirectUris: [
      'https://hq.fulluproar.com/api/auth/callback/afterroar',
      ...DEV_LOCALHOST_3002,
    ],
    secret: requireEnv('OAUTH_CLIENT_SECRET_HQ'),
  },
  'afterroar-ops': {
    id: 'afterroar-ops',
    name: 'Store Ops',
    redirectUris: [
      'https://ops.afterroar.store/api/auth/callback/afterroar',
      'https://www.afterroar.store/api/auth/callback/afterroar',
      ...DEV_LOCALHOST_3000,
    ],
    secret: requireEnv('OAUTH_CLIENT_SECRET_OPS'),
  },
};

export function getClient(clientId: string): OAuthClient | null {
  return CLIENTS[clientId] || null;
}

export function validateRedirectUri(client: OAuthClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
}

export function validateClientSecret(client: OAuthClient, secret: string): boolean {
  if (!client.secret || !secret) return false;
  const expected = client.secret.trim();
  let received = secret.trim();

  if (received.includes('%')) {
    try { received = decodeURIComponent(received); } catch {}
  }

  if (expected.length !== received.length) {
    console.error('[oauth] client secret mismatch for:', client.id);
    return false;
  }

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  return timingSafeEqual(a, b);
}
