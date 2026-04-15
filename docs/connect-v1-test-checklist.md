# Afterroar Connect V1 — Test Checklist

Soft launch target: **April 24, 2026.** Run this end-to-end before showing Greg or any prospect.

## Setup (do once)

- [ ] Run migration: `2026-04-14_consent-requests.sql` against Neon
- [ ] Verify `EntityConsentRequest` table exists
- [ ] Run `npx prisma generate --schema=packages/database/prisma/schema.prisma`
- [ ] Confirm `qrcode` package is installed in `apps/me`
- [ ] Sanity check: `/admin/entities` loads only when signed in as `info@fulluproar.com` or `shawnoah.pollock@gmail.com`

## Test accounts you'll need

- **Admin**: info@fulluproar.com (approves entities)
- **Store owner**: a real-or-test Google account that will own the test store
- **Customer**: a different Google account on a phone (so you can test the QR scan flow)

---

## Path 1: Store registration → approval → dashboard

- [ ] Sign out, visit `/store` — see Connect landing page
- [ ] Sign in as the test store owner
- [ ] `/store` now shows "no application yet" + Apply form
- [ ] Submit the apply form with valid name + contactEmail
- [ ] See "pending" state with the message about review
- [ ] As **admin**, visit `/admin/entities` — see the new application in Pending
- [ ] Click **Approve** — entity moves to Approved section
- [ ] As **store owner**, refresh `/store` — now shows "Go to dashboard"
- [ ] Click through to `/store/[slug]` — dashboard loads
- [ ] Header shows entity name, city/state, "Approved · Beta" badge
- [ ] Stats: Connected customers = 0, Connected this week = 0, Points awarded (30d) = 0
- [ ] Customer lookup widget renders (input + button disabled when empty)
- [ ] Consent QR widget renders (5 scopes with default checks)

## Path 2: Consent request flow (QR → approval)

- [ ] On store dashboard, default scopes selected: identity / wishlist / points (badges + library off)
- [ ] Toggle library ON, type a note ("Loyalty signup at checkout")
- [ ] Click **Generate QR code** — QR appears, countdown starts at 15:00
- [ ] **Copy link** copies the URL; **New request** clears it
- [ ] Generate again, scan QR with phone (camera or QR app)
- [ ] On phone (signed out), redirected through `/login?callbackUrl=/connect/...`
- [ ] Sign in as the **customer** account on phone
- [ ] Land on `/connect/[token]` — see entity name, requested scopes with icons + descriptions, the note
- [ ] Tap **Allow access** — see green "Connected with [name]" success
- [ ] Auto-redirected to `/settings`
- [ ] Settings shows new "Connected stores & creators" section with the entity, scopes, since-date, Revoke button
- [ ] Back on store dashboard, refresh — Connected customers = 1, Connected this week = 1
- [ ] Click the Connected customers stat → `/store/[slug]/customers` → see the customer with display name, passport code, scopes, 0 points

## Path 3: Customer lookup

- [ ] On dashboard, enter the customer's 8-char Passport code (uppercase, monospace input)
- [ ] Click **Look up** — result loads
- [ ] Identity card: name, Passport code, verified badge if applicable
- [ ] If badges granted: badge chips render with emoji + color
- [ ] Wishlist: shows count + first 10 items with priority labels (or "no games" empty state)
- [ ] Library: shows count + top 5 titles
- [ ] Points: shows balance (0 initially) + Award/Redeem widget
- [ ] Try a non-existent code → "Passport not found"
- [ ] Try a Passport that hasn't connected → orange "hasn't connected with [name] yet" panel

## Path 4: Points award & redeem

- [ ] On a successful lookup with points scope, click **+5** quick button
- [ ] See green success: "+5 pts · new balance 5", balance updates above
- [ ] Click **+25** → balance = 30
- [ ] Switch to **Redeem** tab — quick buttons show −5/−10/−25/−50, the −50 should be disabled (greater than balance)
- [ ] Tap **−10** → balance = 20
- [ ] Try Redeem custom 999 → see "Insufficient points balance"
- [ ] Type custom 7 + reason "Bonus", click Go → balance = 27
- [ ] Refresh dashboard → Points awarded (30d) reflects total earns (5 + 25 + 7 = 37)

## Path 5: Revoke + post-revoke behavior

- [ ] As **customer** on phone, `/settings` → tap **Revoke** on the connected store
- [ ] Page reloads, store no longer appears in connected list
- [ ] As **store owner**, look up the same Passport code → see the orange "hasn't connected" state
- [ ] Try `POST /api/store/points` for that Passport (via curl or repeat the award flow) → 403 "Customer has not granted points access"
- [ ] Verify the points balance from before the revoke is still in `PointsLedger` (data isn't deleted, access just stops)

## Path 6: Edge cases

- [ ] Generate a consent request, wait 15 minutes (or manually expire `expiresAt` in DB), visit URL → "Request expired"
- [ ] Generate a request, accept it, visit the same URL again → "Already used"
- [ ] As a non-member, visit `/store/someone-elses-slug` → "Access denied"
- [ ] As an owner whose entity is `pending`, visit `/store/[slug]` → redirected back to `/store`
- [ ] Try `POST /api/store/consent-request` with `entityId` you don't belong to → 403
- [ ] Try `GET /api/store/customer-lookup` with an `entityId` you don't belong to → 403
- [ ] Try with a 7-char code → 400 "must be 8 characters"
- [ ] Try points award with amount 0 → 400; with amount > 100,000 → 400

## Path 7: Admin panel

- [ ] As admin, `/admin/entities` shows Pending / Approved / Suspended sections
- [ ] **Approve** an application → moves to Approved, `approvedAt` set
- [ ] **Suspend** an approved entity → status changes; owner sees `/store/[slug]` redirect to `/store`
- [ ] **Reopen** a suspended entity → back to Pending
- [ ] **Reject** a pending application → status = rejected
- [ ] As a non-admin signed-in user, `/admin/entities` → "Not authorized"

## Smoke check before any external demo

- [ ] All Fugly voice still intact (no corporate phrasing creeping in)
- [ ] No console errors on dashboard, lookup, consent flow
- [ ] Mobile (iPhone Safari + Android Chrome) — both render the consent approval page well
- [ ] QR is sharp at small sizes (240px works at arm's length on a phone)
- [ ] All "coming soon" copy matches what's actually shipping next:
  - federated points (cross-store)
  - real-time wishlist stock matching
  - cross-store verification badges
  - collection-based recommendations

## Known holes / cut from V1

- Wishlist stock matching (we read wishlists, but no inventory side yet)
- Federated points (each store's points are isolated)
- Store-issued custom badges
- Activity log for "scans today"-style stats
- Bulk customer export
- Email/SMS notifications when connections happen

## Files to know

- API: `app/api/store/{customer-lookup,consent-request,points}/route.ts`
- API: `app/api/consent/request/[token]/route.ts`
- API: `app/api/entities/apply/route.ts`
- Pages: `app/store/page.tsx`, `app/store/[slug]/{page,customers/page}.tsx`
- Pages: `app/connect/[token]/page.tsx`, `app/admin/entities/page.tsx`
- Components: `app/store/[slug]/{customer-lookup,consent-qr,points-award}.tsx`
- Settings revoke: `app/(passport)/settings/page.tsx`
- Migration: `packages/database/sql-migrations/2026-04-14_consent-requests.sql`
- Admin allowlist: `lib/admin.ts`
