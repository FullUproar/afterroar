import { SignJWT, jwtVerify } from 'jose';

/**
 * OAuth token utilities — signs and verifies JWTs for the Afterroar IdP.
 *
 * Auth codes are self-contained signed JWTs (5-min expiry, single-use intent).
 * Access tokens are signed JWTs (15-min expiry) containing userId + scopes.
 *
 * Uses JWT_SIGNING_SECRET (preferred) or falls back to AUTH_SECRET.
 * These SHOULD be different keys — AUTH_SECRET signs NextAuth sessions,
 * JWT_SIGNING_SECRET signs OAuth tokens. Separate keys limit blast radius
 * if either one leaks.
 *
 * Security notes (per feedback_security_first.md):
 * - No PII in token payload — only userId, scopes, expiry, issuer
 * - Short expiry on access tokens (15 min)
 * - Auth codes expire in 5 minutes
 * - jose library handles timing-safe signature verification
 */

function getSigningKey(): Uint8Array {
  const secret = process.env.JWT_SIGNING_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('JWT_SIGNING_SECRET or AUTH_SECRET is required for OAuth token signing');
  return new TextEncoder().encode(secret);
}

const ISSUER = 'afterroar.me';

export interface AuthCodePayload {
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

export interface AccessTokenPayload {
  userId: string;
  scope: string;
  clientId: string;
}

/**
 * Mint a short-lived auth code (5-min expiry).
 * Self-contained JWT — no DB storage needed.
 */
export async function mintAuthCode(payload: AuthCodePayload): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    client_id: payload.clientId,
    redirect_uri: payload.redirectUri,
    scope: payload.scope,
    type: 'auth_code',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime('5m')
    .setJti(crypto.randomUUID())
    .sign(getSigningKey());
}

/**
 * Verify and decode an auth code.
 * Returns null if expired, invalid signature, or wrong type.
 */
export async function verifyAuthCode(code: string): Promise<AuthCodePayload | null> {
  try {
    const { payload } = await jwtVerify(code, getSigningKey(), {
      issuer: ISSUER,
    });

    if (payload.type !== 'auth_code') return null;

    return {
      userId: payload.sub!,
      clientId: payload.client_id as string,
      redirectUri: payload.redirect_uri as string,
      scope: payload.scope as string,
    };
  } catch {
    return null;
  }
}

/**
 * Mint an access token (15-min expiry).
 * Contains userId + granted scopes. No PII.
 */
export async function mintAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    scope: payload.scope,
    client_id: payload.clientId,
    type: 'access_token',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime('15m')
    .setJti(crypto.randomUUID())
    .sign(getSigningKey());
}

/**
 * Verify and decode an access token.
 * Returns null if expired, invalid signature, or wrong type.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      issuer: ISSUER,
    });

    if (payload.type !== 'access_token') return null;

    return {
      userId: payload.sub!,
      scope: payload.scope as string,
      clientId: payload.client_id as string,
    };
  } catch {
    return null;
  }
}
