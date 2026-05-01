# Alcohol-Themed Events — v2 Build Roadmap

**Status:** Pocketed. Prohibited by ToS. Build trigger: first venue partner explicitly requests support.

This document is the engineering reference for the alcohol-themed events feature. The feature is documented in advance so that when demand materializes (first venue request), implementation is well-scoped and we don't relitigate the design.

## Why this is a separate v2 feature

Generic 21+ events (adult board-game night, no-kids vibe) use JIT DOB attestation today. That gate is sufficient because alcohol is incidental, not the marketing point.

Alcohol-themed events are different. The event name itself ("Drunk Magic," "Shots & Ladders," "Beer & Boards Night") is a marketing signal that alcohol IS the activity. The legal exposure is qualitatively higher:

- A minor self-attesting through a soft DOB gate to a "Drunk Magic" event creates a record where Afterroar's name is attached to a minor's RSVP for an alcohol-promoting event.
- Plaintiff's lawyer narrative writes itself: "Afterroar published a marketing channel for getting minors drunk."
- ToS indemnity from the venue covers in-person verification but does not protect against the platform-level "you advertised this to minors" exposure.

So alcohol-themed events need a stricter gate than incidental-21+. ID-verified RSVP from the user side and license-verified posting from the venue side, both required.

## Current state (v1)

- ToS clause prohibits alcohol-themed events explicitly (`apps/me/app/terms/page.tsx`)
- `audience` field on GameNight is a String column. `validateAudience()` rejects `'alcohol-themed'` server-side with a clear error message redirecting to ToS
- `apps/hq/lib/event-audience.ts` defines `SUPPORTED_AUDIENCES` (writable today) and `RESERVED_AUDIENCES` (rejected today, future-supported)
- POST and PATCH `/api/game-nights[/:id]` both call `validateAudience()` on writes

## What v2 adds

### 1. Liquor license on venue

New schema fields on the canonical `Venue` table (`ops-afterroar-store/packages/database/prisma/schema.prisma`):

```prisma
model Venue {
  // existing fields...
  liquorLicenseDocUrl     String?     // signed URL or storage path
  liquorLicenseState      String?     // US state abbreviation; alcohol regs are state-by-state
  liquorLicenseNumber     String?     // license identifier
  liquorLicenseExpiresAt  DateTime?
  liquorLicenseStatus     String?     // pending | verified | rejected | expired
  liquorLicenseReviewedAt DateTime?
  liquorLicenseReviewedBy String?     // admin User.id who verified
}
```

### 2. License verification workflow

- Venue uploads license document via Connect-tier admin UI
- Goes into a manual review queue (admin tool, not customer-facing)
- Admin reviews, marks verified or rejected with notes
- Verified status with non-expired date unlocks alcohol-themed event posting
- Daily cron flips verified → expired when `liquorLicenseExpiresAt < now`
- Venue receives renewal-reminder email at T-30d, T-14d, T-1d

### 3. Audience validator update

In `apps/hq/lib/event-audience.ts`, move `'alcohol-themed'` from `RESERVED_AUDIENCES` to `SUPPORTED_AUDIENCES`. Update `validateAudience` to accept it but layer on a venue-license check:

```typescript
// New signature: validateAudience(input, { venueId? })
// When audience === 'alcohol-themed', additionally:
//   - venue must exist
//   - venue.liquorLicenseStatus === 'verified'
//   - venue.liquorLicenseExpiresAt > now
// Otherwise return { ok: false, reason: 'Alcohol-themed events require a verified liquor license on file.' }
```

### 4. ID-verified RSVP gate

In `apps/hq/app/api/game-nights/discover/route.ts` POST handler, add a check for `event.audience === 'alcohol-themed'`:

- User must have `identityVerified === true` (Persona-verified Pro tier)
- DOB on file must classify as 21+
- If DOB missing → return 412 with `requires_dob: true` (existing JIT modal flow)
- If `identityVerified === false` → return 403 with `requires_id_verification: true` and a CTA to upgrade to Pro

### 5. Event creation UI

When a venue with `liquorLicenseStatus === 'verified'` creates a public event, the audience picker shows an additional option: "Alcohol-themed (21+, ID-verified RSVP required)". Selecting it surfaces a confirmation dialog explaining the additional restrictions.

### 6. ToS update at v2 launch

Lift the prohibition clause and replace with the operational policy (license required, ID-verified RSVP, audience tag drives gating).

## Implementation effort estimate

| Piece | Effort | Owner |
|---|---|---|
| Schema migration (Venue license fields) | 30 min | Eng |
| Document upload + storage (S3 / Vercel Blob) | 4 hours | Eng |
| Admin review queue UI | 6 hours | Eng |
| License expiration cron + emails | 2 hours | Eng |
| `validateAudience` upgrade with venue-license check | 1 hour | Eng |
| ID-verified RSVP gate on discover endpoint | 1 hour | Eng |
| Venue event-creation UI option | 2 hours | Eng |
| ToS clause rewrite | 30 min | Legal review + Eng |
| Internal admin training doc | 2 hours | Ops |

**Total:** roughly 2–3 days of focused engineering, plus legal review of the license-storage compliance posture and admin training.

## Storage compliance considerations

- Liquor license documents contain personal/business data. Treat as sensitive.
- Recommend signed URLs with short TTLs; never expose the raw doc URL in API responses to non-admins.
- Retention: keep the most recent verified license + a 7-year audit trail of submitted licenses. State liquor commissions can audit retroactively.
- On venue uninstall / Connect cancellation: purge license documents within 48 hours per the existing privacy policy (matches Shopify shop-redact pattern).

## Build trigger

This work fires when **a venue partner explicitly asks to host alcohol-themed events**. Until then, prohibition stands. The trigger event:

1. Venue contacts support: "We want to run Drunk Magic at our brewery on Saturdays."
2. Support routes to product. Product decides build-now vs continue-pocketing.
3. If build-now: this doc becomes the kickoff brief.

## References

- `project_alcohol_themed_events_policy.md` — top-level policy memory
- `project_age_filter_only_no_field_exposure.md` — same filter-not-field rule applies to alcohol events at v2
- `project_passport_canonical_venues.md` — venue identity is canonical on Passport DB; license fields go there
- ToS section "Public events at venues → Alcohol-themed events are not currently permitted"
