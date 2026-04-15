/**
 * Shopify integration helpers — OAuth, HMAC verification, REST helpers.
 *
 * We don't use the official @shopify/shopify-api SDK; their abstractions
 * assume Express/Koa, and we only need a small surface (~100 LOC). Using
 * fetch + crypto keeps the dependency tree clean and the failure modes
 * obvious.
 *
 * Required env vars:
 *   SHOPIFY_API_KEY        — public app key from Shopify Partners
 *   SHOPIFY_API_SECRET     — private app secret (used for OAuth + HMAC)
 *   SHOPIFY_SCOPES         — comma-separated scopes (e.g. "read_orders,read_customers")
 *   SHOPIFY_APP_URL        — public base URL of THIS app (e.g. https://afterroar.me)
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const SHOPIFY_API_VERSION = '2025-01';

export const REQUIRED_SCOPES = ['read_orders', 'read_customers'];

export const WEBHOOK_TOPICS = [
  'orders/paid',
  'refunds/create',
  'app/uninstalled',
  // GDPR mandatory — required for App Store approval
  'customers/data_request',
  'customers/redact',
  'shop/redact',
] as const;

export type ShopifyTopic = (typeof WEBHOOK_TOPICS)[number];

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function shopifyConfig() {
  return {
    apiKey: env('SHOPIFY_API_KEY'),
    apiSecret: env('SHOPIFY_API_SECRET'),
    scopes: (process.env.SHOPIFY_SCOPES || REQUIRED_SCOPES.join(',')).split(',').map((s) => s.trim()),
    appUrl: env('SHOPIFY_APP_URL').replace(/\/$/, ''),
  };
}

/** Validate that a shop domain looks like a Shopify-hosted myshopify.com URL. */
const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
export function isValidShopDomain(domain: string | null | undefined): domain is string {
  return !!domain && SHOP_DOMAIN_RE.test(domain);
}

/** Build the OAuth authorize URL the merchant gets redirected to. */
export function buildAuthorizeUrl(shopDomain: string, state: string): string {
  const cfg = shopifyConfig();
  const params = new URLSearchParams({
    client_id: cfg.apiKey,
    scope: cfg.scopes.join(','),
    redirect_uri: `${cfg.appUrl}/api/integrations/shopify/callback`,
    state,
    'grant_options[]': 'per-user',
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Verify the HMAC on an OAuth callback query string.
 * Shopify signs all query params except `hmac` and `signature` with apiSecret.
 */
export function verifyOauthCallback(searchParams: URLSearchParams): boolean {
  const cfg = shopifyConfig();
  const hmac = searchParams.get('hmac');
  if (!hmac) return false;
  const message = Array.from(searchParams.entries())
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const expected = createHmac('sha256', cfg.apiSecret).update(message).digest('hex');
  return safeEqualHex(hmac, expected);
}

/**
 * Verify the X-Shopify-Hmac-Sha256 header on an incoming webhook.
 * The header is base64(HMAC-SHA256(rawBody, apiSecret)).
 */
export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  const cfg = shopifyConfig();
  const expected = createHmac('sha256', cfg.apiSecret).update(rawBody, 'utf8').digest('base64');
  return safeEqualBase64(hmacHeader, expected);
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function safeEqualBase64(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'base64');
    const bb = Buffer.from(b, 'base64');
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Exchange an authorization code for a permanent admin API access token. */
export async function exchangeCodeForToken(shopDomain: string, code: string): Promise<{
  accessToken: string;
  scope: string;
}> {
  const cfg = shopifyConfig();
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: cfg.apiKey,
      client_secret: cfg.apiSecret,
      code,
    }),
  });
  if (!res.ok) {
    throw new Error(`Shopify token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; scope: string };
  return { accessToken: data.access_token, scope: data.scope };
}

/** Generic Shopify Admin REST helper. */
export async function shopifyFetch<T>(
  shopDomain: string,
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Shopify API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Register a webhook subscription with Shopify. */
export async function registerWebhook(
  shopDomain: string,
  accessToken: string,
  topic: ShopifyTopic
): Promise<void> {
  const cfg = shopifyConfig();
  const callbackUrl = `${cfg.appUrl}/api/integrations/shopify/webhook`;
  await shopifyFetch(shopDomain, accessToken, '/webhooks.json', {
    method: 'POST',
    body: JSON.stringify({
      webhook: { topic, address: callbackUrl, format: 'json' },
    }),
  }).catch((err) => {
    // 422 means already registered — fine
    if (!String(err.message).includes('422')) throw err;
  });
}

export function newOauthState(): string {
  return randomBytes(16).toString('base64url');
}
