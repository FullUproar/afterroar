/**
 * One-off: close a batch of Linear issues with their resolution comments,
 * and file the new HQ-build-blocker issue. Hand-curated for the
 * 2026-04-26 cleanup pass — safe to delete after running.
 */

import { closeLinearIssue, createLinearIssue } from "../lib/linear";

interface ToClose {
  id: string;
  comment: string;
}

const closures: ToClose[] = [
  {
    id: "FUL-5",
    comment:
      "Fixed: 'Fugly's HQ' → 'Game Night HQ' on the masthead, footer, and sign-in heading. Browser title was already correct. Lands once the hq.fulluproar.com build blocker (separate Linear issue) is unblocked.",
  },
  {
    id: "FUL-6",
    comment:
      "Fixed: footer 'Identity powered by The Credo' → 'Identity powered by Afterroar'. Link target moved from /credo to afterroar.me root — Credo is the philosophy doc, attribution should point at the product Passport users sign in with. Lands with the same hq deploy unblock.",
  },
  {
    id: "FUL-8",
    comment:
      "Fixed: quick-action tile 'My crews & nights' → 'My crews & game nights'. Lands with the same hq deploy unblock.",
  },
  {
    id: "FUL-12",
    comment:
      "Fixed: theme button focused a hidden input (display:none on a focus call is a silent no-op). Replaced the implicit-show DOM hack with a state-driven visibility toggle (themeInputVisible). Click button → setState(visible) → setTimeout(focus, 0) on the next tick once React has flushed. Input persists if the user already typed a theme.",
  },
  {
    id: "FUL-13",
    comment:
      "Fixed: handleCreate had `if (isTentative && derivedSlots.length < 2) return` — the 'No date yet' path sets isTentative=true but never collects tentativeSlots, so the < 2 check silently bailed and 'Let's Go!' did nothing. Added a `dateMode === 'open'` bypass so vote and explicit-tentative modes still need 2+ slots, but open mode flows through.",
  },
  {
    id: "FUL-15",
    comment:
      "Fixed and deployed to afterroar.me. Bumped small body copy on /login and /signup: terms/privacy disclosure 0.72→0.82rem, 'What is a Passport?' link 0.78→0.85rem, resend hint 0.78→0.85rem, field labels 0.78→0.85rem, field hints 0.7→0.82rem. Left the 0.7rem 'OR' divider alone — uppercase visual separator with letter-spacing, fine at that size.",
  },
];

async function main() {
  console.log(`→ Resolving ${closures.length} issues…\n`);
  for (const c of closures) {
    process.stdout.write(`  ${c.id}… `);
    const ok = await closeLinearIssue(c.id, c.comment);
    console.log(ok ? "✓" : "✗ FAILED");
  }

  console.log("\n→ Filing hq-deploy-blocker issue…");
  const issue = await createLinearIssue({
    title: "hq.fulluproar.com build blocked: slug conflict in /chaos",
    description: [
      "**Symptom:** `npm run build` on `apps/hq` fails with:",
      "",
      "> Error: You cannot use different slug names for the same dynamic path ('code' !== 'sessionId').",
      "",
      "**Root cause:** two sibling page routes use different slug names at the same nesting level:",
      "",
      "- `apps/hq/app/chaos/[code]/page.tsx` (Chaos Agent V1, added in `fac6ff8`)",
      "- `apps/hq/app/chaos/[sessionId]/page.tsx` (older Chaos session UI, from the original `apps/hq` scaffold in `14ee699`)",
      "",
      "Next.js's App Router requires every dynamic segment at the same path level to share one slug name.",
      "",
      "**Impact:** blocks every deploy to hq.fulluproar.com. The fixes shipped in commit `1ca802c` (FUL-5, FUL-6, FUL-8, FUL-12, FUL-13) won't reach prod until this is resolved.",
      "",
      "**Resolution options (need product call):**",
      "1. Move one route under a non-conflicting parent — e.g. `chaos/agent/[code]` or `chaos/session/[sessionId]`. Cheapest, but breaks any link/QR pointing at the old URL.",
      "2. Standardize on one slug name. Pick `[code]` everywhere if the new Chaos Agent flow is the canonical one going forward; merge the old session page logic in (or sunset it).",
      "3. Use a `(group)` route group to disambiguate without changing URLs, e.g. `chaos/(agent)/[code]` and `chaos/(session)/[sessionId]`. Next docs say this works for organization but does NOT resolve slug conflicts when both groups expose a top-level `[slug]` of the same path — verify before relying.",
      "",
      "Recommended: option 1 with `[code]` moved under `chaos/agent/`. Newer feature, easier to redirect from any places that reference it.",
      "",
      "**Note:** the build also surfaces unrelated TS errors in `app/api/chaos/agent/route.ts` and `app/api/cal/[token]/route.ts` (Prisma schema drift — `agentMissions`, `participants`, `calendarToken` not on the generated client). Those are separate; should be triaged together since they're all in the chaos surface.",
    ].join("\n"),
    labels: ["HQ", "Bug"],
  });

  if (issue) {
    console.log(`✓ Filed: ${issue.identifier} — ${issue.url}`);
  } else {
    console.log("✗ Could not file build-blocker issue (Linear API)");
  }
}

main().catch((err) => {
  console.error("✗", err.message ?? err);
  process.exit(1);
});
