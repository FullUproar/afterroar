# Sentry rollout — apps/site, apps/hq, apps/me

The 2026-04-29 platform audit found that Sentry was wired in `apps/ops` only. This doc describes the rollout to bring the other three apps to parity.

## What was added

For each of `apps/site`, `apps/hq`, `apps/me`:

1. `@sentry/nextjs: ^10.47.0` added to `dependencies` (matches apps/ops pinning)
2. `sentry.client.config.ts` — client-side init with replay-on-error + ignore-noise list
3. `sentry.server.config.ts` — server-side init with `includeLocalVariables: true`
4. `sentry.edge.config.ts` — edge-runtime init for middleware
5. `app/global-error.tsx` — captures uncaught errors at the App Router boundary
6. `next.config.ts` wrapped with `withSentryConfig` (org/project/authToken from env, tunnelRoute `/monitoring` to defeat ad-blockers)

All four apps now use the same Sentry init shape. Tweak per-app behavior by editing each app's local `sentry.*.config.ts`.

## Required Vercel env vars per app

Each app should have its **own Sentry project** so the issues stream is filtered per app. Currently `afterroar-ops` (apps/ops) is the only Vercel project with these set.

For each Vercel project (`afterroar-me`, `full-uproar-site`, `hq`), set in **Production + Preview**:

| Env var | What it is | Source |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Public DSN (sent to client) | Sentry → project settings → Client Keys → DSN (Public) |
| `SENTRY_DSN` | Same as above; server reads this first | Same DSN |
| `SENTRY_ORG` | Sentry organization slug | Sentry → settings (e.g. `afterroar`) |
| `SENTRY_PROJECT` | Sentry project slug for THIS app | Each app gets its own project: `afterroar-me`, `full-uproar-site`, `hq` |
| `SENTRY_AUTH_TOKEN` | Build-time auth for source-map upload | Sentry → User Auth Tokens (scope: `project:releases`) |

The same auth token can be reused across the four projects.

## Setup checklist

For each new Sentry project:

1. Sentry → New Project → Next.js → name it `afterroar-me` / `full-uproar-site` / `hq`
2. Copy the DSN
3. Vercel project → Settings → Environment Variables → add the 5 vars above for Production + Preview
4. Trigger a redeploy (any push to main, or `vercel redeploy <last-prod-url>`)
5. Verify: hit a 500 path (or run `Sentry.captureMessage("test")` from a server route) and confirm it shows up in Sentry within ~30s

## What changed in code (deployable now even before env vars are set)

The `sentry.*.config.ts` files all check `enabled: process.env.NODE_ENV === "production"` and gracefully no-op when `NEXT_PUBLIC_SENTRY_DSN` is missing. So merging the code BEFORE setting the env vars is safe — Sentry init becomes a no-op until DSN appears, no errors thrown.

The `withSentryConfig` wrapper similarly tolerates missing env vars at build time (it just skips source-map upload). The build will succeed; the only thing missing is the upload of source maps. Once the auth token + org + project are set, source maps start uploading on the next deploy.

## Tunnel route

Each app exposes Sentry events through `/monitoring` (configured via `tunnelRoute` in `withSentryConfig`). This bypasses ad-blockers that target the standard Sentry hostnames. The route is added automatically by `@sentry/nextjs` — no separate API route to write.

## Why no DSN sharing across apps

A natural temptation: one Sentry project, all four apps emit to it. The reason we use separate projects:

- Per-project rate limits — a noisy bug in one app eats the quota for all apps
- Per-project release tracking — apps deploy independently; mixing release tags is messy
- Per-project alerts — different on-call routing per surface (apps/ops has 24/7 SLA via Garmr; apps/site is best-effort)
- Per-project source-map ownership — `SENTRY_PROJECT` controls which project receives uploads

Cost: 4 free Sentry projects vs 1 (free tier covers up to ~10 projects). Not a concern.

## Pre-existing local-build noise (unrelated)

While verifying the rollout I ran `npx tsc --noEmit` on each app:

- `apps/me`: clean
- `apps/hq`: 3 errors against stale `.next/types/app/chaos/[code]/page.ts` — disappear after `rm -rf .next`. CI runs from a fresh checkout so this is not a real issue.
- `apps/site`: 81 errors against `__tests__/*.test.tsx` files using `toBeInTheDocument` — `@testing-library/jest-dom` types aren't being picked up. Pre-existing issue, predates the Sentry rollout. Worth fixing separately by adding `import "@testing-library/jest-dom"` to a global test setup file or extending `tsconfig.json` `types`.
