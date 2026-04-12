import { SignJWT, jwtVerify } from 'jose';

/**
 * OAuth token utilities — signs and verifies JWTs for the Afterroar IdP.
 *
 * Auth codes are self-contained signed JWTs (5-min expiry, single-use via jti tracking).
 * Access tokens are signed JWTs (15-min expiry) containing userId + scopes.
 *
 * Uses JWT_SIGNING_SECRET (preferred) or falls back to AUTH_SECRET.
 * These SHOULD be different keys — AUTH_SECRET signs NextAuth sessions,
 * JWT_SIGNING_SECRET signs OAuth tokens. Separate keys limit blast radius
 * if either one leaks.
 *
 * Security:
 * - No PII in token payload — only userId, scopes, expiry, issuer
 * - PKCE support (S256 code_challenge stored in auth code JWT)
 * - Auth codes are single-use (jti tracked in memory)
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

// --- Replay protection: track used auth code JTIs ---
// Map<jti, expiresAt> — entries auto-cleaned on each check.
// Provides replay protection within a single Vercel function instance.
// Combined with 5-min JWT expiry, covers the practical attack window.
const usedCodes = new Map<string, number>();

function cleanExpiredCodes() {
  const now = Date.now();
  for (const [jti, exp] of usedCodes) {
    if (exp < now) usedCodes.delete(jti);
  }
}

function markCodeUsed(jti: string, expiresAt: number): boolean {
  cleanExpiredCodes();
  if (usedCodes.has(jti)) return false;
  usedCodes.set(jti, expiresAt);
  return true;
}

// --- PKCE utilities ---
async function computeS256Challenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface AuthCodePayload {
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface AccessTokenPayload {
  userId: string;
  scope: string;
  clientId: string;
}

/**
 * Mint a short-lived auth code (5-min expiry).
 * Self-contained JWT — includes PKCE code_challenge if provided.
 */
export async function mintAuthCode(payload: AuthCodePayload): Promise<string> {
  const claims: Record<string, unknown> = {
    sub: payload.userId,
    client_id: payload.clientId,
    redirect_uri: payload.redirectUri,
    scope: payload.scope,
    type: 'auth_code',
  };

  if (payload.codeChallenge) {
    claims.code_challenge = payload.codeChallenge;
    claims.code_challenge_method = payload.codeChallengeMethod || 'S256';
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime('5m')
    .setJti(crypto.randomUUID())
    .sign(getSigningKey());
}

/**
 * Verify, decode, and consume an auth code.
 * Returns null if expired, invalid signature, wrong type, or already used.
 */
export async function verifyAuthCode(code: string): Promise<(AuthCodePayload & { jti: string }) | null> {
  try {
    const { payload } = await jwtVerify(code, getSigningKey(), {
      issuer: ISSUER,
    });

    if (payload.type !== 'auth_code') return null;

    const jti = payload.jti;
    if (!jti) return null;

    const exp = (payload.exp || 0) * 1000;
    if (!markCodeUsed(jti, exp)) {
      console.error('[oauth] auth code replay blocked, jti:', jti);
      return null;
    }

    return {
      userId: payload.sub!,
      clientId: payload.client_id as string,
      redirectUri: payload.redirect_uri as string,
      scope: payload.scope as string,
      codeChallenge: payload.code_challenge as string | undefined,
      codeChallengeMethod: payload.code_challenge_method as string | undefined,
      jti,
    };
  } catch {
    return null;
  }
}

/**
 * Validate PKCE code_verifier against the code_challenge stored in the auth code.
 * Returns true if PKCE was not required (no challenge in code) or if verification passes.
 */
export async function verifyPkce(
  codeChallenge: string | undefined,
  codeChallengeMethod: string | undefined,
  codeVerifier: string | undefined,
): Promise<boolean> {
  if (!codeChallenge) return true;

  if (!codeVerifier) return false;

  if (codeChallengeMethod === 'S256' || !codeChallengeMethod) {
    const computed = await computeS256Challenge(codeVerifier);
    return computed === codeChallenge;
  }

  if (codeChallengeMethod === 'plain') {
    return codeVerifier === codeChallenge;
  }

  return false;
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
