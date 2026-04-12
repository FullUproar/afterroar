import { NextRequest, NextResponse } from 'next/server';
import { getClient, validateClientSecret } from '@/lib/oauth/clients';
import { verifyAuthCode, mintAccessToken } from '@/lib/oauth/tokens';

/**
 * POST /api/token — OAuth token exchange endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let body: Record<string, string> = {};

    // Support both JSON and form-encoded (NextAuth sends form-encoded)
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      try {
        const formData = await request.formData();
        body = Object.fromEntries(formData.entries()) as Record<string, string>;
      } catch {
        const text = await request.text();
        const params = new URLSearchParams(text);
        body = Object.fromEntries(params.entries());
      }
    }

    let { grant_type, code, redirect_uri, client_id, client_secret } = body;

    // Also check Authorization header for Basic auth (some OAuth clients send credentials this way)
    if (!client_id || !client_secret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Basic ')) {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const [id, secret] = decoded.split(':');
        client_id = client_id || id;
        client_secret = client_secret || secret;
      }
    }

    console.log('[token] Request received:', {
      grant_type,
      has_code: !!code,
      redirect_uri,
      client_id,
      has_client_secret: !!client_secret,
      content_type: contentType,
    });

    if (grant_type !== 'authorization_code') {
      console.error('[token] FAIL: unsupported_grant_type:', grant_type);
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: `Only authorization_code is supported, got: ${grant_type}` },
        { status: 400 }
      );
    }

    if (!code || !redirect_uri || !client_id || !client_secret) {
      console.error('[token] FAIL: missing params:', { code: !!code, redirect_uri: !!redirect_uri, client_id: !!client_id, client_secret: !!client_secret });
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const client = getClient(client_id);
    if (!client) {
      console.error('[token] FAIL: unknown client_id:', client_id);
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Unknown client' },
        { status: 401 }
      );
    }

    if (!validateClientSecret(client, client_secret)) {
      console.error('[token] FAIL: invalid client_secret for:', client_id);
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Invalid client credentials' },
        { status: 401 }
      );
    }

    const codePayload = await verifyAuthCode(code);
    if (!codePayload) {
      console.error('[token] FAIL: invalid or expired auth code');
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Auth code is invalid or expired' },
        { status: 400 }
      );
    }

    if (codePayload.clientId !== client_id || codePayload.redirectUri !== redirect_uri) {
      console.error('[token] FAIL: code mismatch:', {
        code_client: codePayload.clientId, req_client: client_id,
        code_redirect: codePayload.redirectUri, req_redirect: redirect_uri,
      });
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Code was issued for a different client or redirect URI' },
        { status: 400 }
      );
    }

    const accessToken = await mintAccessToken({
      userId: codePayload.userId,
      scope: codePayload.scope,
      clientId: client_id,
    });

    console.log('[token] SUCCESS: token minted for user:', codePayload.userId);

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
      scope: codePayload.scope,
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[token] FATAL:', message);
    return NextResponse.json(
      { error: 'server_error', error_description: message },
      { status: 500 }
    );
  }
}
