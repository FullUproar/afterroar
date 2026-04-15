# Afterroar Connect V1 — Architecture

> A Connect entity (store, venue, publisher, creator) is a first-class
> participant in the Afterroar protocol. Customers grant scoped access to
> slices of their Passport, and entities can read/write only what they were
> given. Every line of this code assumes the customer is in charge.

## What V1 ships

| Capability | Surface | API |
|---|---|---|
| Apply to become an entity | `/store` | `POST /api/entities/apply` |
| Admin approve / suspend | `/admin/entities` | server actions on the page |
| Generate consent QR (15 min, single use) | `/store/[slug]` | `POST /api/store/consent-request` |
| Customer approves on their phone | `/connect/[token]` | `GET/POST /api/consent/request/[token]` |
| Look up a connected customer | `/store/[slug]` | `GET /api/store/customer-lookup` |
| Award / redeem store-scoped points | `/store/[slug]` | `POST /api/store/points` |
| List connected customers | `/store/[slug]/customers` | (server component query) |
| Customer view + revoke connections | `/settings` | server action on the page |

## Data model

All Connect tables live in the shared Postgres alongside the rest of the
Passport. Defined in [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma)
and migrated via raw SQL in
[packages/database/sql-migrations/](../packages/database/sql-migrations/).

```
AfterroarEntity ──┬─ EntityMember (role = owner|manager|staff)
                  ├─ EntityConsent (per-user scope grant)
                  └─ EntityConsentRequest (one-time tokens)

PointsLedger.storeId  references  AfterroarEntity.id (string match, not FK)
UserBadge.userId      references  User.id
WishlistItem.userId   references  User.id
```

`EntityConsent` is the source of truth for what a store can read about a
customer. `revokedAt != null` means immediate cutoff — every read goes
through this gate, no caching, no grace period.

`EntityConsentRequest` is short-lived (15 minutes) and single-use
(`claimedAt`). Token is 12 random bytes encoded as base64url (~16 chars).

`PointsLedger` is append-only with a denormalized running balance per
`(userId, storeId)` pair. Entries are scoped to one store; there is no
cross-store balance in V1 (federated points is V2).

## Scopes — the unit of consent

Defined in [lib/connect-scopes.ts](../apps/me/lib/connect-scopes.ts). One
canonical list, used by:

- the consent-request route (validation)
- the customer-lookup route (gating which slices are returned)
- the consent QR generator UI (default checkboxes)
- the consent approval page (icon + description for each scope)

Adding a scope:
1. Add to `CONNECT_SCOPES` and `SCOPE_META` in `lib/connect-scopes.ts`
2. Add the data fetch + response field in `app/api/store/customer-lookup/route.ts`
3. Done. Every other surface picks it up automatically.

V1 scopes: `identity`, `wishlist`, `library`, `badges`, `points`.

## Security model

- **Auth**: `auth()` from NextAuth on every Connect endpoint. Public preview
  (`GET /api/consent/request/[token]`) is the only unauthenticated route.
- **Membership**: every store-side endpoint resolves the caller via
  `prisma.entityMember.findFirst({ where: { entityId, userId } })` and
  rejects with 403 if missing.
- **Status**: only `entity.status === 'approved'` entities can issue requests
  or read customer data. Pending/suspended/rejected → 403.
- **Consent gate**: customer-lookup checks `EntityConsent.revokedAt`,
  `expiresAt`, and the requested scope's presence in `consent.scopes` — all
  in a single read at request time, never cached.
- **Replay protection**: `EntityConsentRequest.claimedAt` is set on the same
  transaction as the consent upsert. Re-using the token returns 409.
- **Token entropy**: 12 random bytes from `crypto.randomBytes` → 96 bits.
  Base64url encoded, ~16 characters.
- **Admin gate**: `lib/admin.ts` allowlist (`info@fulluproar.com`,
  `shawnoah.pollock@gmail.com`). Server actions re-check the session inside
  the action, never trusting the form.
- **Points overdraft**: redeem that would push balance < 0 throws inside
  the ledger transaction and returns 400.
- **Amount bounds**: ±100,000 max per points transaction; 0 is rejected.

## What we deliberately did NOT do (and why)

- **No JWTs for consent tokens.** Tokens are opaque database rows so we
  can revoke / mark-claimed atomically. JWTs would have to be paired with
  a denylist anyway.
- **No third-party QR rendering.** `qrcode` runs client-side; the token
  never touches another origin. (Earlier draft used api.qrserver.com —
  rejected on the same reasoning as not pasting tokens into Slack.)
- **No mock-database tests.** Per Shawn's standing rule from a prior
  incident: integration tests hit real Postgres against a test DB. The only
  thing mocked in `tests/api/setup.ts` is the `auth()` session.
- **No federated points table.** Each store's points are isolated to that
  `storeId`. Federation needs governance (who's good for the credit?) that
  isn't in V1's scope.
- **No store-issued badges.** Badge issuance from a non-Afterroar issuer is
  designed for in `PassportBadge.issuerType` but not yet exposed via
  Connect API. Add when a real customer asks.

## Testing

| Layer | Tool | Location |
|---|---|---|
| Route handlers (auth, scope, expiry, overdraft) | vitest | `tests/api/*.test.ts` |
| Public-surface e2e (renders, error states, anonymous API rejections) | Playwright | `tests/e2e/connect-flow.spec.ts` |
| Visual regression (existing) | Playwright | `tests/visual/passport-pages.spec.ts` |
| Manual end-to-end | checklist | [connect-v1-test-checklist.md](./connect-v1-test-checklist.md) |

Run:
```
npm run test:api           # vitest, route handler integration tests
npm run test:e2e           # Playwright against http://localhost:3001
npm run test:visual        # Playwright visual sweep against production
```

`test:api` requires `DATABASE_URL` pointing to a non-production Postgres.
The setup file mocks `auth()` and provides factory helpers; tests are
responsible for cleaning up via `cleanup({ userIds, entityIds })`.

## Open questions before V2

- Federated points settlement (who reconciles cross-store credit?)
- Wishlist → inventory matching: where does the inventory side live? Store
  Ops has it; HQ doesn't. Connect will need to call into Store Ops or
  receive pushed snapshots.
- Store-issued badge approval pipeline (avoid spam, set tasteful defaults)
- Consent request rate-limit per entity (currently unlimited — a chatty
  store could spam tokens; haven't seen a need yet)
