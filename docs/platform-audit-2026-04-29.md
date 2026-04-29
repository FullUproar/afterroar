# Platform Foundation Audit — 2026-04-29

Holistic sweep across the four core products (FU site, HQ, Store Ops, Passport) covering CI/CD, architecture, config hygiene, Credo compliance, engineering practices, and documentation. This is a reference document — findings are organized by severity, not by category.

Tooling used:
- `git ls-files`, `grep -rn`, `find` for code surface inventory
- Direct file reads for the high-stakes findings
- Vercel-pulled env files for config verification (deleted after use)

---

## CRITICAL — Engineering hygiene

### C1. Hardcoded `info@fulluproar.com` super-admin checks pervasive across the platform

**Framing correction (post-review):** A platform-operations super-admin role is necessary engineering, not a Credo violation. The Credo prohibits preferential *commercial / data* access to ecosystem participants (stores, publishers, distributors), not the existence of an operator role for running the platform itself. The fix below is good-engineering, not Credo-compliance.

`info@fulluproar.com` is hardcoded as a privileged user in **at least 26 places** across the platform code (not counting documentation):

**Store Ops (`apps/ops`):**
- `src/lib/require-staff.ts` defines `GOD_ADMIN_EMAIL = "info@fulluproar.com"` and `requireStaff()` short-circuits if the email matches
- `src/lib/store-context.tsx` mirrors the same constant
- `src/app/api/admin/migrate/route.ts` defines `GOD_ADMIN = "info@fulluproar.com"` (migration powers)
- `src/app/api/push/subscribe/route.ts:18,75` — bypasses owner-only check if email matches

**Passport (`apps/me`):**
- `app/api/library/scan/route.ts` — `UNLIMITED_EMAILS = ['info@fulluproar.com', 'shawnoah.pollock@gmail.com']` bypasses subscription scan limits

**FU site (`apps/site`):**
- `lib/permissions/config.ts:98` — `GOD = 'GOD' // info@fulluproar.com - absolute power` enum value
- `lib/auth-config.ts:205` — role assigned by email match
- `lib/auth-enhanced.ts` — multiple god-mode checks
- `app/admin/components/RolesManagement.tsx` — UI shows a Crown emoji when email matches
- `app/api/admin/ensure-admin-user/route.ts`, `ensure-god-user/route.ts`, `fix-admin-access/route.ts`, `grant-admin/route.ts`, `users/[id]/roles/route.ts`, `notifications/test/route.ts`, `test-user-role/route.ts` — all reference the email directly

**Why this is bad engineering (independent of Credo):**
- Hardcoded checks aren't auditable — no log of when GOD power was exercised
- Can't be revoked without a code deploy
- Can't be granted to an additional operator (e.g. a contractor) without a code change
- Doesn't survive an email change
- Couples privilege to a single literal string compare scattered across 26+ call sites

**The right pattern:**
- A `Role` enum in the DB (already exists as `GOD` in `apps/site/lib/permissions/config.ts`) with role assignment via DB write
- An audit log row every time a `GOD` role exercises elevated power, capturing actor + action + target tenant
- Migration: any user currently relying on the hardcoded check gets their role explicitly assigned in DB once, and the email-string checks are deleted from code
- A single helper (`requireGod()` or similar) per app that all admin endpoints call, instead of inlined `email === "info@fulluproar.com"` checks

### C2. Cross-DB user deletion is not federated

**The Credo (tier 1) says:** *"When someone says 'forget me,' we forget them — fully, immediately, and without residue."*

Three deletion endpoints exist:
- `apps/me/app/api/delete-account/route.ts` — deletes only Passport-side rows. Anonymizes PointsLedger (correct), deletes UserActivity + UserConsent + Account + User. Does NOT notify other apps.
- `apps/site/app/api/account/delete-data/route.ts` — calls `notifyStoresOfUserDeletion(...)`. **This is the right pattern.** Two modes: `personal_data` and `full_account`.
- `apps/ops/src/app/api/customers/[id]/delete-data/route.ts` — store-side delete.

**Gaps:**
1. The Passport-side delete (`apps/me/.../delete-account`) doesn't notify the FU side or any Store Ops tenant. The FU side caches a `User` snapshot per CLAUDE.md, and `pos_customers` rows can carry `afterroar_user_id`. Both will keep stale references.
2. The three endpoints have different deletion guarantees and confirmation patterns (one wants the email typed, another wants `DELETE`, another wants `DELETE MY ACCOUNT`). Inconsistent UX, but more importantly: inconsistent semantics about what "delete" means.
3. There's no documented cross-app "user-delete fan-out" contract. The `notifyStoresOfUserDeletion` call in apps/site exists but I can't confirm without reading the implementation that it actually reaches every tenant DB.

**Recommended fix:** A single canonical "Forget me" endpoint on Passport that:
1. Deletes Passport-side data
2. Fans out a deletion event (signed JWT) to every consumer of Passport identity (FU site, every Store Ops tenant)
3. Each consumer responds with confirmation; deletion is "complete" only when all consumers ack
4. Emits an audit log row on success
5. Single confirmation pattern shared by all UIs

---

## CRITICAL — Operational risk

### O1. **Zero CI/CD pipelines.** No GitHub Actions on either repo.

```
$ ls .github/workflows/    # in both repos
(does not exist)
```

What this means:
- No automated typecheck on PR
- No automated lint on PR
- No automated test runs on PR
- No build verification before merge to `main`
- No security/secret-scanning on PR
- Only safety net: Vercel's deploy build, which runs AFTER merge to main

The platform survived this far because there's effectively one developer pushing carefully. As soon as a second pair of hands lands (mobile work, contractor, etc.) or as soon as Claude lands a typo on a Friday afternoon, this goes from theoretical to real.

**Recommended fix (single afternoon of work):**
- Add `.github/workflows/ci.yml` to each repo running: typecheck, lint, unit tests, e2e smoke (apps that have it)
- Branch protection on `main` requiring CI green
- Dependabot config (already partially showing — saw old dependabot branches)

### O2. No pre-commit hooks (no Husky / lint-staged)

A typo, a missed import, a leftover `console.log`, or a leaked `.env` value can land in a commit because nothing checks at commit time. Combined with "no CI" above, the only check is the developer's eyes.

**Recommended fix:** Add Husky + lint-staged + a `pre-commit` hook running typecheck on staged files + `gitleaks`-style secret scan.

### O3. Sentry is wired in `apps/ops` but NOT in `apps/site` or `apps/hq` or `apps/me`

- `apps/ops`: 8 `@sentry/*` imports, in package.json — wired
- `apps/site`, `apps/hq`, `apps/me`: 0 `@sentry/*` imports

Per `ops-afterroar-store/docs/sentry-uptime-config.md`, the plan was 4 uptime monitors across the platform — but only 1 of 4 apps has actual error tracking in code. A 500 in the Passport login flow goes nowhere observable.

**Recommended fix:** Add `@sentry/nextjs` to apps/site, apps/hq, apps/me with shared DSN (per app, separate DSNs for project filtering).

### O4. Schema drift risk: `prisma db push` is the deploy mechanism, no migration history

Both repos use `prisma db push` rather than `prisma migrate dev` / `prisma migrate deploy`. That means:
- No migration files committed to git
- No history of what schema looked like at any past point
- Rolling back is hand-edit + push
- Two developers can't merge concurrent schema changes cleanly

The push helper I wrote this morning (`packages/database/scripts/push-prod.js`) at least has a host-check guard, but the underlying approach is brittle. The 2026-04-27 incident (7 dropped tables) is partly a symptom of this — `db push` happily applies destructive changes.

**Recommended fix:** Migrate to `prisma migrate dev` flow. One-time investment to baseline the current schema, then every change produces a tracked migration file. CI can then check for schema-drift between the dev DB and main.

---

## HIGH — Engineering practices

### H1. README missing on every workspace

```
✗ full-uproar-site/apps/hq/README.md
✗ full-uproar-site/apps/site/README.md
✗ full-uproar-site/packages/afterroar-client/README.md
✗ full-uproar-site/packages/database/README.md
✗ ops-afterroar-store/apps/ops/README.md
✗ ops-afterroar-store/apps/me/README.md
✗ ops-afterroar-store/packages/database/README.md
```

Top-level READMEs exist (36 + 51 lines respectively) but nothing per-workspace. A new contributor (or a fresh Claude session) has no per-app onboarding.

**Recommended fix:** One-paragraph README in each workspace explaining: what this is, where its env vars live, what its deploy target is, how to run it locally.

### H2. TODO/FIXME debt: 57 in `full-uproar-site`, 11 in `ops-afterroar-store`

11 is fine. 57 is a smell — likely indicates places where things were left half-done across multiple sessions. Worth a triage pass.

### H3. Test coverage uneven

- `full-uproar-site`: 66 test files (jest), older + larger codebase
- `ops-afterroar-store`: 13 test files (vitest + playwright), newer

Without CI running these tests, the actual coverage is whatever each developer remembers to run locally. With CI added (O1) we'd at least know what's passing/failing.

### H4. The platform-level `CLAUDE.md` is not in any git repo

It lives at `c:\dev\FULL UPROAR PLATFORM\CLAUDE.md` (loose file). Edits don't propagate to the laptop. This morning's canonical-path update only exists on this machine.

**Recommended fix:** Move it into one of the tracked repos (probably `ops-afterroar-store/PLATFORM_MAP.md` since that's where most platform-level docs live), then symlink or document where the canonical lives.

---

## MEDIUM — Architecture & hygiene

### M1. Tenant isolation: needs a sweep

Heuristic count: 582 `db.pos*` queries in `apps/ops/src/app/api`, only 189 nearby `store_id`/`storeId` mentions. That's a 32% rate — most of the rest are likely safe (Prisma tenant extension auto-filters per `requireStaff()`'s storeId injection, and many queries use indexed-by-id-only access where the FK chain enforces tenancy). But "likely safe" isn't "verified safe."

**Recommended fix:** A dedicated tenancy review pass. For every `pos_*` query, confirm one of: (a) `where: { store_id }` is present, (b) the query is on a leaf model whose parent is store-scoped and the parent ID is verified, or (c) the row is platform-wide (e.g. `PosIntegrationStatus` with `store_id: null`).

### M2. Three different AUTH_SECRETs across local files

Per the audit yesterday: FU + HQ share one secret, Store Ops has another, Passport has a third. CLAUDE.md says they should be shared across the four core Vercel projects via the `.fulluproar.com` cookie domain — but the AUTH_URLs are on three separate cookie domains (`fulluproar.com`, `afterroar.store`, `afterroar.me`), so the shared-secret claim doesn't actually apply at the cookie layer. Either the doc is wrong or the practice is. Worth a deliberate decision.

### M3. The trap-path lesson isn't enforced

CLAUDE.md (now updated) lists historical trap paths. But there's nothing preventing someone from re-cloning to `c:\dev\full-uproar-site\` accidentally. The migration script + a check in `push-prod.js` could be extended to look for known-bad paths and refuse to operate from them.

### M4. .gitignore missing `dist/`

Both repos. Minor — but if a TS project introduces a `dist/` build target, it'd get tracked.

---

## LOW — Polish

### L1. Two `packages/database` packages, one in each monorepo

Architecturally correct (FU-side schema differs from Afterroar-side schema per the 2026-04-27 split). But the directory naming is identical, which makes IDE workspaces confusing. Consider renaming one to e.g. `@fu-uproar/database-fu` vs `@afterroar/database`.

### L2. Documentation tree is rich but uneven

`full-uproar-site/docs/`: 41 entries. `ops-afterroar-store/docs/`: 24 entries. `c:/dev/FULL UPROAR PLATFORM/docs/`: 1 entry. Some of the platform-wide docs (this audit, the canonical-paths note, the Sentry config) probably belong in a single platform-level docs tree, not scattered.

### L3. `core-pkg` / `game-platform/` artifacts in old canonical were 192MB untracked

Already handled by the canonical migration. Worth a `.gitignore` rule for `game-platform/` if that subproject is meant to live separately.

---

## Recommended sequence (today's catchup)

If we're spending today on foundation, here's the order I'd tackle these:

1. **C1 (god-mode backdoor)** — biggest credibility gap. Even a partial fix (move FU site's god checks into role-based + add audit log) starts paying down the Credo debt.
2. **O1 (CI/CD)** — single afternoon, immediate impact, makes everything else safer.
3. **O3 (Sentry parity)** — three apps need it, copy-paste from apps/ops's wiring.
4. **C2 (federated user delete)** — design the contract first, then implement.
5. **O2 (pre-commit hooks)** — small, paid forward immediately.
6. **H1 (per-workspace READMEs)** — small, high leverage for future contributors.
7. **O4 (Prisma migrate)** — heavier lift; might want to defer until after the schema stabilizes more.
8. **M1 (tenant isolation sweep)** — focused review pass; might want a separate session.

The C1 + O1 + O3 combo is the highest-impact thing we can do in a day. Everything else can be scheduled.
