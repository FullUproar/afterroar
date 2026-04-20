# Session Handoff — 2026-04-20

**For the next agent picking up on a fresh machine.** Shawn works across multiple machines; the auto-memory on one machine won't be on the next. This doc captures everything a new agent needs to resume.

## Where we left off

**Major launches coming up:**
- ~~Pollock Party April 17~~ — **CANCELED** due to family medical emergency. No reschedule planned. Passport launch no longer has a hard date anchor.
- **FMM (Mayhem Machine) pre-launch — was April 19-20** — verify status with Shawn. USPTO SOU screenshot capture was tied to this.
- **Connect soft launch — April 24** — store-facing B2B, Greg/Level Up Games pilot target.
- **Greg pilot — May 1** — first real paying store on Connect.
- **Mayhem Machine ships — July 1**

## What shipped recently (last 2 days of intensive work)

### Identity & auth architecture
- `docs/identity-and-consent.md` (HQ/FU repo) — **canonical source of truth**. Read this before any auth work.
- HQ now uses `AfterroarProvider` (OIDC into afterroar.me). Env vars already set on all Vercel projects.
- Lazy `ensurePassport()` on HQ sign-in generates Passport code if missing.
- "Fugly's HQ" rebrand complete — only keep "Afterroar Passport", "Sign in with Afterroar", "powered by Afterroar Passport" as correct Afterroar references. Everything else is HQ / Full Uproar / HQ Pro.

### HQ features built
- **Game Mode** — full-screen player lock with turn tracker, nudges, moment capture. Lives at `/game-nights/[id]/play`.
- **Chaos Agent V1** — room-based meta-game at `/chaos` and `/chaos/[code]`. Full auction/vote/verdict flow with 90 theatrical expressions. Sideline mode: 3 missions max, drip-fed replenishment.
- **Chaos Agent card deck V2** — `docs/chaos-agent-card-deck-v2.md` (FU site repo) is a 66-card physical version ready for print. Fugly voice throughout.
- **Discord + iCal integrations** — crew settings UI for Discord webhook + iCal subscription URL. Helper `lib/crew-discord.ts` has `pushGameNightCreated`, `pushGameNightLockedIn`, `pushRecap` ready to wire into game night lifecycle.
- **HQ landing CSS polish** — responsive 980px container, hero sizing, "Who are you?" audience tabs, removed fake stats.

### Store Ops features built
- **Canonical user flows** — `docs/canonical-user-flows.md`. 30+ P0-P3 flows written as narratives. **This is the testing bible.**
- **Deferred items from P0/P1 audit** — ALL THREE SHIPPED on 4/17-20:
  - Stripe Terminal idempotency + reconnect handling (with manual test plan in `docs/stripe-terminal-recovery-test-plan.md`)
  - Mode switch state preservation (`useFormDraft` + `useUnsavedChangesWarning` hooks, applied to customer create form as canonical example)
  - Pre-fulfillment oversell warning (hard hold at ingest, fulfillment UI banner with 3 resolution paths)
- **Sidebar collapsed from 11 → 8 items.** Trade-Ins, Consignment now under Inventory tab group. Help under Settings. Fulfillment + Returns under Orders. Card Catalog + Deck Builder also under Inventory.
- **SubNav pattern** — `components/ui/sub-nav.tsx` is sticky + flex-shrink-0. Wired into all sub-pages across Inventory/Orders/Events/Settings groups.
- **Pagination** — shared `components/ui/pagination.tsx`. Applied to all 5 dashboard tables (inventory, orders, events, trade-ins, consignment). Backends return `{ data, total, page, pageSize }`.
- **Shopify integration** — all Tier 2 + Tier 3 code shipped. Needs Shopify partner dashboard compliance webhook URLs configured (blocking App Store review — see `docs/shopify-app-listing.md`).

### Afterroar.me (Passport) features built
- **Connect V1** — full store-facing flow. Entities, consent requests, customer lookup, points award. Admin approval panel.
- **Audit log** — every PII access logged. Table + helper.
- **Retention cron** — daily at 7am UTC. Strips webhook PII after 30 days, purges after 180.
- **Security/DLP policy** — `docs/security-policy.md`. Covers all 9 Shopify compliance questions.

## The canonical flow bible (Store Ops)

[`docs/canonical-user-flows.md`](./canonical-user-flows.md) — 30+ flows organized P0-P3. Read this before touching Store Ops UX.

**Grading criteria (set by Shawn):**
- P0/P1: must work AND have clean UX
- P2+: must work, clean UX is nice-to-have

## The 3 things I deferred as "need design" and then built the next day

All in `docs/deferred-design-items.md` (marked complete) + shipped. Key lessons from that cycle:
- Don't over-cautiously defer things that are buildable with sensible defaults
- Document decisions in code comments, not just docs
- Hard-hold vs soft-hold was chosen for oversell; migration path to soft-hold is noted in `lib/order-ingest.ts` header

## Outstanding items Shawn flagged for next session

1. **S710 manual test walkthrough** — Shawn has the hardware. Tests 4, 5, 8 are the big ones (disconnect scenarios).
2. **Pollock Party flows** — still valid for eventual reschedule, no date pressure
3. **FMM pre-launch readiness** — was on 4/19-20, verify status. USPTO SOU screenshot capture plan was tied to this (`memory/project_uspto_sou_capture.md`).
4. **Connect onboarding for Greg** — target May 1. May need polish on the admin approval flow + marketing landing at `afterroar.me/store`.
5. **Merchant TOS at `/terms-merchant`** — needed for Shopify App Store review but not built yet.
6. **New status values `backordered` + `partial_cancelled`** — show in Orders "All" tab but not canned filter tabs. Marked `TODO[design]` in code.

## Key architectural decisions to remember

- **Afterroar is the protocol, Fugly's HQ is the product.** Apple ID vs Apple analogy. HQ is not a privileged client of Passport — it uses the same OAuth + EntityConsent system any third-party store would.
- **Auth and data sharing are separate concerns.** Always. The store can never see your password; they get consent-scoped API access.
- **Chaos Agent is a sideline, not the main event.** 3 missions max. Designed for glance-between-turns, not stare-at-phone.
- **HQ doesn't fight to keep users in HQ.** Push events to Discord/Calendar, pull users in at 4 key moments (plan, play, capture, remember).

## File structure recap

- **`c:\Full Uproar Platform\full-uproar-site\`** — the Full Uproar monorepo. Contains `apps/hq` (hq.fulluproar.com), `apps/site` (fulluproar.com), `packages/database` (shared schema).
- **`c:\Full Uproar Platform\ops-afterroar-store\`** — the Afterroar monorepo. Contains `apps/me` (afterroar.me Passport), `apps/ops` (ops.afterroar.store POS), `packages/database` (parallel schema declaring the afterroar-side tables).
- **Shared Neon Postgres** — both monorepos write to the same database via `DATABASE_URL`. Store Ops tables are prefixed `pos_`; Afterroar tables are PascalCase.

## Deploy + env notes

- **Vercel projects:** `full-uproar-site`, `hq`, `afterroar-me`, `afterroar-ops`. Shawn has full access.
- **Env var changes on Vercel do NOT auto-redeploy.** Always trigger a manual redeploy after changing env vars.
- **Never skip git hooks** (`--no-verify`). Shawn's standing rule.
- **Always build locally first** before pushing to Vercel (per FU site CLAUDE.md). Use `npx tsc --noEmit` at minimum.
- **Migrations** — Store Ops uses raw SQL in `packages/database/migrations/`. HQ uses Prisma migrations in `packages/database/prisma/migrations/`. Both get applied directly to prod via a Node script (see previous commits for pattern). Do NOT use `prisma migrate` or `prisma db push` on either side.

## Test accounts (Store Ops)

- Owner: `shawnoah.pollock@gmail.com` / Google OAuth
- God mode: `info@fulluproar.com`
- Manager: `manager@teststore.com` / `password123`
- Cashier: `cashier@teststore.com` / `password123`
- Bots for automated testing: `bot-{owner,manager,cashier}@afterroar.store` / `bot1234!`

## Working style preferences (from memory)

- Shawn moves fast. Large chunks of work OK, especially pre-launch.
- Don't ask about trivial decisions; pick a sensible default and note it.
- Push back honestly when disagreeing. "Build it all" directives get a reality-check counter-proposal before execution.
- Security is a prerequisite, not a polish step.
- Fugly voice is ALWAYS irreverent on consumer surfaces. Never corporate.
- Visual UX audits via Playwright screenshots are valuable.
- State-aware prompts: check session + DB + localStorage before rendering any prompt or modal to avoid re-asking the same question.
- When Shawn says "push to prod" he means commit + push. Migrations he expects to be applied too.

## Ready to pick up

1. New agent should read: `docs/canonical-user-flows.md`, `docs/identity-and-consent.md` (in FU site repo), `docs/deferred-design-items.md`, `docs/stripe-terminal-recovery-test-plan.md`
2. Check memory index: `C:\Users\ssp\.claude\projects\c--Full-Uproar-Platform\memory\MEMORY.md` (if transferring machines, this file is machine-specific — Shawn may need to copy it or build fresh from context)
3. Current working directory for Shawn's primary monorepo: `c:\Full Uproar Platform`
4. Ask Shawn: status of FMM pre-launch (was 4/19-20), any new priorities since handoff

## Revision log

| Date | Change |
|---|---|
| 2026-04-20 | Initial handoff from laptop → desktop. Everything committed + pushed. |
