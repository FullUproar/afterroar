# Passport: System diagram

How Afterroar Passport (afterroar.me) works across online and in-store
contexts. Companion to `PASSPORT_AS_CANONICAL_IDENTITY.md`.

Last updated 2026-05-19.

---

## 1. Landscape — apps, data, and the federation edge

```mermaid
flowchart LR
  subgraph customer_devices["Customer devices"]
    phone["Phone<br/>(Passport mobile app<br/>or web Passport)"]
    qr["QR code<br/>(passportCode display)"]
  end

  subgraph passport_neon["afterroar-pos-prod Neon (canonical)"]
    p_user[("User<br/>passportCode, KYC,<br/>reputationScore, isFrozen")]
    p_entity[("AfterroarEntity<br/>FLGS / publisher /<br/>organizer")]
    p_consent[("EntityConsent<br/>(User x Entity x scopes)<br/>this is THE connection")]
    p_badge[("PassportBadge,<br/>UserBadge")]
    p_points[("PointsLedger<br/>(immutable, per-store)")]
    p_audit[("AdminAuditLog,<br/>UserActivity,<br/>AuditLog")]
    pos_tables[("pos_* tables<br/>(36+ tables for<br/>register, inventory,<br/>events, etc.)")]
  end

  subgraph fu_neon["neon-full-uproar (FU snapshot)"]
    fu_user_cache[("User snapshot<br/>(id, email, displayName)<br/>read-only from FU's view")]
    fu_data[("Orders, GameNights,<br/>Venue (with verifiedOwnerId),<br/>forum, Roar Points cache")]
  end

  subgraph afterroar_me["afterroar.me (Passport app)"]
    p_signup["/signup<br/>/login<br/>/passport/connections<br/>/passport/settings"]
    p_admin["/admin/*<br/>(email-whitelist gated)"]
    p_oidc["OIDC provider<br/>/authorize, /token,<br/>/api/userinfo"]
    p_apiv1["Federation v1<br/>/api/v1/users/...<br/>/api/v1/venues/...<br/>X-API-Key auth"]
  end

  subgraph store_ops["afterroar.store (Store Ops POS)"]
    so_register["Register UI<br/>(web + mobile)"]
    so_lookup["/api/store/customer-lookup<br/>(uses passportCode)"]
    so_points["/api/store/points<br/>(awards via PointsLedger)"]
  end

  subgraph fu_apps["FU consumer apps"]
    fu_site["www.fulluproar.com<br/>(storefront, checkout)"]
    fu_hq["hq.fulluproar.com<br/>(game nights, venues)"]
  end

  phone -- "QR display" --> qr
  qr -- "scan at register" --> so_register
  so_register -- "passportCode lookup" --> so_lookup
  so_lookup -- "consented slice" --> p_consent
  so_lookup -- "user identity" --> p_user
  so_points -- "append" --> p_points
  store_ops -- "writes" --> pos_tables

  fu_site -- "OAuth (AfterroarProvider)" --> p_oidc
  fu_hq -- "OAuth (AfterroarProvider)" --> p_oidc
  fu_site -- "X-API-Key server lookup" --> p_apiv1
  fu_hq -- "X-API-Key server lookup" --> p_apiv1
  fu_site -. "session cookie<br/>(separate domain)" .- fu_user_cache
  fu_hq -. "same session<br/>(.fulluproar.com)" .- fu_user_cache

  p_apiv1 --> p_user
  p_apiv1 --> p_entity
  p_oidc --> p_user
  p_oidc --> p_consent

  p_signup --> p_user
  p_signup --> p_consent
  p_admin --> p_audit
  p_admin --> p_user

  fu_data -. "denormalized FK<br/>(verifiedOwnerId, hostId, etc.)<br/>points at p_user.id" .- p_user
```

**Key invariants:**

- `passport_neon` is canonical. Every identity primitive lives here.
- `fu_neon`'s User table is a denormalized snapshot. FU code reads it
  freely; mutations to identity (display name, KYC, ban state) must
  originate at Passport and propagate.
- Cross-DB references between Neon projects are app-level lookups, not
  SQL FKs. There is no Prisma relation between `fu_data.verifiedOwnerId`
  and `p_user.id` at the DB layer.
- Connections between a user and a tenant are represented by
  `EntityConsent` rows on Passport. Revoking the row IS disconnecting.

---

## 2. Online flow — claim a venue from FU outreach

A first-time user clicks the magic link in an Afterroar outreach email
and ends up running their FLGS's HQ dashboard. Sequence below.

```mermaid
sequenceDiagram
  autonumber
  participant U as Recipient (e.g. shop owner)
  participant FUw as www.fulluproar.com<br/>(public venue page)
  participant FUapi as FU /api/venues/[slug]/<br/>claim-and-signup
  participant P as Passport /api/auth/signup<br/>(server-to-server)
  participant Pdb as afterroar-pos-prod
  participant FUdb as neon-full-uproar
  participant HQ as hq.fulluproar.com

  U->>FUw: Click claim link<br/>(?claim=TOKEN&preview=claim)
  FUw->>U: Show inline claim modal<br/>("Create Afterroar Passport")
  U->>FUw: Email + password<br/>(complexity-validated)
  FUw->>FUapi: POST {token, email, password}
  FUapi->>FUapi: Validate token vs Venue<br/>(token TTL + email bind)
  FUapi->>P: HMAC-signed signup<br/>{email, password, claim sig}
  P->>Pdb: Create User<br/>(emailVerified=true,<br/>passportCode auto)
  P-->>FUapi: { ok, userId }
  FUapi->>FUdb: Upsert User snapshot<br/>(same id as Passport)
  FUapi->>FUdb: Bind Venue.verifiedOwnerId<br/>+ outreachStatus=claimed
  FUapi->>FUapi: Mint NextAuth JWE<br/>(AUTH_SECRET, .fulluproar.com cookie)
  FUapi-->>U: Set-Cookie<br/>+ redirect to HQ
  U->>HQ: Lands at /my-venue/[slug]<br/>(session cookie attached)
  HQ->>FUdb: auth() finds User snapshot,<br/>session enriched
  HQ-->>U: Venue dashboard

  Note over U,HQ: User now exists in BOTH<br/>Passport (canonical) and FU snapshot,<br/>linked by id. Only Passport has<br/>the password hash.
```

---

## 3. In-store flow — checkin at the register

```mermaid
sequenceDiagram
  autonumber
  participant C as Customer
  participant Reg as Register<br/>(web or mobile)
  participant SO as Store Ops backend
  participant P as Passport<br/>/api/store/customer-lookup
  participant Pdb as afterroar-pos-prod

  C->>Reg: Show Passport QR<br/>(passportCode)
  Reg->>SO: Scan -> passportCode
  SO->>P: GET ?code=XXX&entityId=YYY<br/>(session-authenticated)
  P->>Pdb: Find User by passportCode<br/>+ EntityConsent for entityId
  Pdb-->>P: User row + granted scopes
  alt consent exists
    P-->>SO: Consented projection<br/>(identity, wishlist, badges,<br/>this-store points only)
    SO->>P: POST /api/store/points<br/>{amount, action}<br/>(if loyalty earn)
    P->>Pdb: Append PointsLedger<br/>(this store + balance)
    P->>Pdb: AuditLog entry<br/>(who read what scopes)
    P-->>SO: balance + new entry
  else no consent yet
    P-->>SO: prompt for in-person<br/>consent capture
    SO->>Reg: show consent screen<br/>(scopes the store needs)
    C->>Reg: tap accept
    Reg->>SO: confirm
    SO->>P: POST consent grant
    P->>Pdb: Create EntityConsent
  end
  SO-->>Reg: Render customer pane

  Note over P,Pdb: Every read is logged.<br/>Customer can revoke from<br/>Passport /passport/connections<br/>at any time.
```

---

## 4. Connection lifecycle (the EntityConsent primitive)

```mermaid
stateDiagram-v2
  [*] --> none: First contact
  none --> active: User grants consent<br/>(OAuth screen or<br/>in-store capture)
  active --> active: Scope changes<br/>(grant more, revoke some)
  active --> revoked: User clicks "Disconnect"<br/>at /passport/connections
  active --> expired: TTL elapses<br/>(if expiresAt set)
  revoked --> active: User re-grants<br/>(re-OAuth or<br/>re-checkin)
  expired --> active: Re-grants<br/>(prompted on next use)
  active --> [*]: User account deleted<br/>(cascade from Passport)
  revoked --> [*]: User account deleted
```

**Disconnect semantics (2026-05-19 architectural call):**

- Revoking an `EntityConsent` row IS the disconnect action.
- The connected app's lookups return null/403 for that user afterwards.
- Historical records on the connected app's side (orders, game nights
  hosted, etc.) are anonymized rather than deleted — they keep an
  opaque user id reference for FK integrity but the connection is dead.
- Re-granting consent re-establishes the connection. Same `passportCode`
  comes back online for that tenant.

**Deletion vs disconnection:**

- **Disconnect a single tenant**: revoke that `EntityConsent` row. Lives
  on the Passport user-facing surface at `/passport/connections`.
- **Delete the whole Passport identity**: nukes the canonical `User`
  row. All `EntityConsent` rows cascade to deletion (FK cascade).
  Lives on the Passport admin surface at `/admin/users`. Also available
  to the user as "Delete my account" on `/passport/settings`.

---

## 5. Federation API surface (X-API-Key)

What Passport exposes for server-to-server use by FU/HQ/partner apps.

| Endpoint | Used by | Purpose |
|---|---|---|
| `GET /api/v1/users/{id}` | FU, HQ | Single-user lookup |
| `POST /api/v1/users/lookup` | FU, HQ | Batch lookup (≤100 ids) |
| `GET /api/v1/events/by-afterroar-id/{id}/checkins` | HQ | Event roster sync |
| `GET /api/v1/venues/{id}/inventory` | HQ | Store inventory readout |
| `GET /api/v1/venues/{id}/revenue?period=N` | HQ | Revenue aggregation |
| **Missing today (next sprints):** | | |
| `GET /api/v1/users/{id}?include=summary` | FU/HQ admin | Connection counts before destructive ops |
| `DELETE /api/v1/users/{id}` | FU/HQ admin | Nuclear user delete (rare; usually done from Passport admin directly) |
| `PATCH /api/v1/users/{id}` | FU/HQ admin | Identity-state sync (ban, KYC verify) |
| `POST /api/v1/webhooks/subscribe` | partner apps | Receive `connection.revoked`, `user.deleted` events |

---

## 6. Where each operator action lives (2026-05-19)

| Action | Lives at | Why |
|---|---|---|
| User self-disconnects from a tenant | Passport `/passport/connections` | Passport owns the connection primitive |
| User self-deletes their entire account | Passport `/passport/settings` | Canonical store of identity |
| Admin deletes a user (canonical) | Passport `/admin/users` (iframed into FU AdminApp under "Passport") | Single canonical surface |
| Admin views/manages venues | HQ `/admin/venue-claims`, `/admin/outreach` (iframed into FU AdminApp under "Governance (HQ)") | Venue admin tools live on HQ |
| FU-side admin ops (orders, merch, etc.) | FU `/admin` | Tenant-specific |

Three iframed admin contexts, one operator pane at `www.fulluproar.com/admin`.

---

## 7. Trust ladder

Reputation and verification layers from cheapest to strongest.

```mermaid
flowchart LR
  unverified["Unverified Passport<br/>(emailVerified only)"] -->
  community["Community-vouched<br/>(badges from issuers,<br/>positive activity)"] -->
  staff["Staff-verified at store<br/>(tentativeIdVerified)"] -->
  kyc["KYC-verified<br/>(identityVerified via<br/>Persona / Stripe Identity)"]

  unverified -. "isFrozen via report" .- frozen["Frozen<br/>(admin moderation)"]
```

- **Unverified**: anyone with an email. Lowest reputation weight. Can
  RSVP, can claim libraries, can earn store points.
- **Community-vouched**: badges issued by other Passport holders or
  stores. Useful for events that gate on "regular here" / "trusted by N
  members of this crew."
- **Staff-verified**: a store has checked the customer's physical ID
  and tagged the Passport. Local to that store; not network-wide.
- **KYC-verified**: third-party identity service (Persona, Stripe
  Identity) has confirmed real-world identity. Required for prize-money
  tournaments, alcohol-event RSVPs, high-value trade-ins, business
  ownership verification.

---

## 8. Open architectural threads (as of 2026-05-19)

- Passport's `User` table has no role enum. Admin gate is an email
  whitelist hardcoded in `lib/admin.ts`. Doesn't scale to a 3rd admin
  cleanly — promote to a `User.adminRole` enum + persisted ACL.
- No abuse-report / user-block models in the Passport schema yet. The
  reputation system has the scores but not the actions that move them.
- Webhook delivery (Passport → consumer apps for `connection.revoked`,
  `user.deleted`) is not built. Today consumer apps poll or notice on
  next federation lookup.
- The "delete me" self-service path on Passport is referenced in this
  doc but not yet built. See followup sprint.
