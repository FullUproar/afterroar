-- Shopify integration: per-entity OAuth connection + webhook event log for
-- idempotency. One AfterroarEntity can have at most one Shopify connection.

CREATE TABLE IF NOT EXISTS "ShopifyConnection" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"        TEXT NOT NULL UNIQUE REFERENCES "AfterroarEntity"(id) ON DELETE CASCADE,
  "shopDomain"      TEXT NOT NULL UNIQUE,                -- e.g. reddhill-games.myshopify.com
  "accessToken"     TEXT NOT NULL,                       -- Shopify Admin API access token
  "scopes"          TEXT NOT NULL,                       -- comma-separated granted scopes
  "shopName"        TEXT,
  "shopEmail"       TEXT,
  "currency"        TEXT,
  "pointsPerDollar" INTEGER NOT NULL DEFAULT 1,          -- 1 = 1pt per $1, 100 = 100pt per $1
  "minOrderCents"   INTEGER NOT NULL DEFAULT 0,          -- skip orders below this subtotal
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "installedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "uninstalledAt"   TIMESTAMP WITH TIME ZONE,
  "lastWebhookAt"   TIMESTAMP WITH TIME ZONE,
  "metadata"        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS "ShopifyConnection_entityId_idx" ON "ShopifyConnection"("entityId");
CREATE INDEX IF NOT EXISTS "ShopifyConnection_shopDomain_idx" ON "ShopifyConnection"("shopDomain");
CREATE INDEX IF NOT EXISTS "ShopifyConnection_active_idx" ON "ShopifyConnection"("active");

-- Idempotency log for incoming webhook events. Shopify retries on failure;
-- we use (shopDomain, topic, eventId) as the dedupe key.
CREATE TABLE IF NOT EXISTS "ShopifyWebhookEvent" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shopDomain"  TEXT NOT NULL,
  "topic"       TEXT NOT NULL,                           -- e.g. orders/paid
  "eventId"     TEXT NOT NULL,                           -- X-Shopify-Webhook-Id header
  "orderId"     TEXT,                                    -- when applicable
  "payload"     JSONB NOT NULL,
  "processedAt" TIMESTAMP WITH TIME ZONE,
  "result"      TEXT,                                    -- 'awarded' | 'reversed' | 'skipped:reason' | 'error:msg'
  "pointsDelta" INTEGER,
  "userId"      TEXT,
  "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT "ShopifyWebhookEvent_unique" UNIQUE ("shopDomain", "topic", "eventId")
);

CREATE INDEX IF NOT EXISTS "ShopifyWebhookEvent_shopDomain_idx" ON "ShopifyWebhookEvent"("shopDomain");
CREATE INDEX IF NOT EXISTS "ShopifyWebhookEvent_topic_idx" ON "ShopifyWebhookEvent"("topic");
CREATE INDEX IF NOT EXISTS "ShopifyWebhookEvent_orderId_idx" ON "ShopifyWebhookEvent"("orderId");
CREATE INDEX IF NOT EXISTS "ShopifyWebhookEvent_createdAt_idx" ON "ShopifyWebhookEvent"("createdAt");

-- Short-lived nonce store for OAuth state parameter (CSRF protection).
CREATE TABLE IF NOT EXISTS "ShopifyOauthState" (
  "state"      TEXT PRIMARY KEY,
  "shopDomain" TEXT NOT NULL,
  "entityId"   TEXT REFERENCES "AfterroarEntity"(id) ON DELETE CASCADE,
  "createdAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "expiresAt"  TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS "ShopifyOauthState_expiresAt_idx" ON "ShopifyOauthState"("expiresAt");
