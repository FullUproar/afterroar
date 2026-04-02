# Afterroar Store Ops

POS and operating system for friendly local game stores (FLGS). Purpose-built for stores that sell TCG singles, run events, process trade-ins, and build community.

**Live at:** [afterroar.store](https://www.afterroar.store)
**Part of:** Full Uproar Games ecosystem

## Quick Start

```bash
npm install
npm run dev
```

## Architecture

See the [central docs](../full-uproar-site/docs/) for full architecture documentation:
- [Store Ops Architecture](../full-uproar-site/docs/store-ops-architecture.md)
- [HQ ↔ Store Ops Bridge Spec](../full-uproar-site/docs/hq-store-ops-bridge-spec.md)
- [Feature Grades](../full-uproar-site/docs/store-ops-feature-grades.md)

## Stack

- Next.js 16 + React 19 + TypeScript + Tailwind CSS
- Prisma ORM + PostgreSQL (shared with Afterroar HQ)
- NextAuth v5 (Google OAuth + Credentials)
- Stripe (payments + Terminal S710)
- Claude (AI Store Advisor, card identification)
- Vercel hosting

## Database

All Store Ops tables use `pos_` prefix. Migrations are raw SQL in `migrations/`. Never use `prisma migrate` or `prisma db push` — only `prisma generate`.

## Key Scripts

```bash
npm run dev          # Local development
npm run build        # Production build
npx prisma generate  # Regenerate Prisma client after schema changes
```

## Test Accounts

- **Owner:** Google sign-in (shawnoah.pollock@gmail.com)
- **Manager:** manager@teststore.com / password123
- **Cashier:** cashier@teststore.com / password123

## Env Vars

See `CLAUDE.md` for the full list. Key vars: `DATABASE_URL`, `AUTH_SECRET`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`.
