import { NextRequest, NextResponse } from 'next/server';
import { getClient, validateClientSecret } from '@/lib/oauth/clients';
import { verifyAuthCode, mintAccessToken } from '@/lib/oauth/tokens';

/**
 * POST /api/token — OAuth token exchange endpoint.
 *
 * Accepts an authorization code and returns a signed JWT access token.
 *
 * Security (per feedback_security_first.md):
 * - Auth codes are self-contained signed JWTs with 5-min expiry
 * - Client credentials are validated against the registry
 * - redirect_uri must match the one used in the authorize request
 * - Access tokens contain no PII — only userId + scopes + expiry
 * - Rate limiting should be added here (TODO: integrate Upstash)
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let body: Record<string, string>;
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries()) as Record<string, string>;
    }

    const { grant_type, code, redirect_uri, client_id, client_secret } = body;

    // Validate grant type
    if (grant_type !== 'authorization_code') {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported' },
        { status: 400 }
      );
    }

    // Validate required params
    if (!code || !redirect_uri || !client_id || !client_secret) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Validate client
    const client = getClient(client_id);
    if (!client) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Unknown client' },
        { status: 401 }
      );
    }

    if (!validateClientSecret(client, client_secret)) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Invalid client credentials' },
        { status: 401 }
      );
    }

    // Verify the auth code
    const codePayload = await verifyAuthCode(code);
    if (!codePayload) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Auth code is invalid or expired' },
        { status: 400 }
      );
    }

    // Verify code was issued for this client + redirect_uri
    if (codePayload.clientId !== client_id || codePayload.redirectUri !== redirect_uri) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Code was issued for a different client or redirect URI' },
        { status: 400 }
      );
    }

    // Mint access token
    const accessToken = await mintAccessToken({
      userId: codePayload.userId,
      scope: codePayload.scope,
      clientId: client_id,
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900, // 15 minutes
      scope: codePayload.scope,
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Token endpoint error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
