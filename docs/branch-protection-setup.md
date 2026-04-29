# Branch Protection — `main` branch on both repos

Apply these once the first CI run on each repo has gone green. The CI workflows are at `.github/workflows/ci.yml` in each repo.

## Both repos: `FullUproar/afterroar` and `FullUproar/full-uproar-site`

GitHub → repo → Settings → Branches → Branch protection rules → Add rule

**Branch name pattern:** `main`

**Settings to enable:**

- ✅ Require a pull request before merging
  - ✅ Require approvals: **0** (single-developer right now; switch to 1 when a second dev lands)
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - **Required status checks:** add the per-matrix CI jobs once they've appeared in a run:
    - For `FullUproar/afterroar`: `ops — typecheck + lint`, `me — typecheck + lint`, `ops — unit tests`
    - For `FullUproar/full-uproar-site`: `site — typecheck + lint`, `hq — typecheck + lint`, `site — unit tests`
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings (so even repo admins go through CI)

**Settings to leave OFF (for now):**

- ❌ Require signed commits — we're not signing today
- ❌ Require linear history — squash on merge handles this
- ❌ Require deployments to succeed — Vercel deploys after merge, not before
- ❌ Restrict who can push to matching branches — we're a single-dev shop

## Why these specific settings

- **Status checks required**: this is the whole point of adding CI. Without "require status checks to pass," the workflow runs but doesn't gate merges.
- **Up-to-date before merging**: prevents rebase races where two people merge stale branches that each pass CI individually but break together.
- **No bypass for admins**: the 2026-04-27 incident (7 dropped tables) was a single-developer mistake. Admin-bypass would be the lever to skip CI in a panic, which is exactly when CI matters most.
- **0 approvals required**: turn this up to 1 when a second contributor joins. Today it would just block solo work.

## After applying

The next PR opened against either repo will gate on CI green. The first PR that fires CI will create the status check names you need to register as "required" — open a throwaway PR on each repo, wait for the first run, then add the names. After that subsequent PRs are gated.

## Future additions (post-launch)

- **Vercel preview deploy required** — once we've verified Vercel previews work cleanly with the new env-var setup post-DB-split, we can require Vercel's deploy check to gate merges too. That's an extra few minutes per PR but catches build-time issues that CI deliberately doesn't reproduce.
- **Codecov / coverage gates** — once test coverage is meaningful enough to set a floor, drop a coverage threshold check.
- **Secrets scanning (gitleaks)** — add a separate workflow that scans the diff for accidentally-committed secrets and blocks on hits.
