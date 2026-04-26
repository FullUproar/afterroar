/**
 * One-off: post comments on open Linear issues. Used to add follow-up
 * notes after the 2026-04-26 cleanup pass — safe to delete after running.
 */

const LINEAR_API_URL = "https://api.linear.app/graphql";

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("LINEAR_API_KEY is not set");
  const res = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors) throw new Error(`Linear: ${JSON.stringify(json.errors)}`);
  if (!json.data) throw new Error("Linear returned no data");
  return json.data;
}

async function findIssueId(identifier: string): Promise<string | null> {
  const num = parseInt(identifier.split("-")[1] ?? "0", 10);
  const data = await gql<{ issues: { nodes: Array<{ id: string; identifier: string }> } }>(
    `
      query F($num: Float!) {
        issues(filter: { number: { eq: $num } }, first: 5) {
          nodes { id identifier }
        }
      }
    `,
    { num },
  );
  return data.issues.nodes.find((i) => i.identifier === identifier)?.id ?? null;
}

async function comment(identifier: string, body: string) {
  const id = await findIssueId(identifier);
  if (!id) {
    console.log(`  ${identifier}… ✗ not found`);
    return;
  }
  const r = await gql<{ commentCreate: { success: boolean } }>(
    `
      mutation C($input: CommentCreateInput!) {
        commentCreate(input: $input) { success }
      }
    `,
    { input: { issueId: id, body } },
  );
  console.log(`  ${identifier}… ${r.commentCreate.success ? "✓" : "✗"}`);
}

async function main() {
  console.log("→ Posting follow-up comments…\n");

  await comment(
    "FUL-11",
    [
      "Can't repro from code review — every step in CreateGameNightModal.tsx renders unconditional content (h2 + form fields + nav buttons). Step 1 → date selection. Step 2 → 'What time?' (specific mode only). Step 3 → vibe. Step 4 → name. Step 5 → location. Step 6 → optional extras + Let's Go.",
      "",
      "To unblock: would you mind capturing one of:",
      "- A screen recording of the flow that produces the blank page",
      "- Browser console errors (F12 → Console tab) on the broken state",
      "- Or just: which step is blank? After 'No Date Yet' you should land on the vibe picker (step 3).",
      "",
      "Could be a render issue specific to a viewport size or a transient state where the modal scrolls off — easier to confirm with a recording than to keep guessing.",
    ].join("\n"),
  );

  await comment(
    "FUL-10",
    [
      "Plan for the date redesign per spec:",
      "",
      "Replace the current 4 hardcoded options with a smart day-of-week-aware list. Algorithm:",
      "",
      "1. Always include **Tonight**, **Tomorrow** as the first two slots.",
      "2. Then add **Next Friday** and **Next Saturday** unless they overlap with #1 or #2.",
      "   - If today is Thursday, 'Next Friday' = Tomorrow → drop Friday option.",
      "   - If today is Friday, 'Tonight' = Friday → drop Friday option; 'Next Saturday' = Tomorrow → drop Saturday.",
      "3. Always include **Select Date** (opens the existing calendar picker).",
      "4. Always include **No Date Yet** (existing 'open' mode).",
      "",
      "Implementation: add a helper `function getQuickDateOptions(today: Date)` that returns the 4-6 deduped options. Render those as buttons in step 1 instead of (or alongside) the 'When are you thinking' three-mode selector. Behavior is the same as today's specific-date pick after selection.",
      "",
      "Will pick this up after the chaos-route slug conflict (FUL-16) is resolved so HQ deploys can ship again.",
    ].join("\n"),
  );

  await comment(
    "FUL-16",
    [
      "Full context for the build fix:",
      "",
      "**Symptom:** `npm run build` on `apps/hq` fails with `Error: You cannot use different slug names for the same dynamic path ('code' !== 'sessionId').`",
      "",
      "**Two routes in conflict:**",
      "- `apps/hq/app/chaos/[code]/page.tsx` — Chaos Agent V1 (added in fac6ff8)",
      "- `apps/hq/app/chaos/[sessionId]/page.tsx` — older Chaos session page (from initial hq scaffold)",
      "",
      "**Recommended fix:** move the newer `[code]` route under a parent like `apps/hq/app/chaos/agent/[code]/page.tsx`. Update any internal links + QR codes that point at `/chaos/{code}` to use `/chaos/agent/{code}`. The older `[sessionId]` route stays put.",
      "",
      "**Also broken in the same surface (separate but related):** TS errors in `app/api/chaos/agent/route.ts` and `app/api/cal/[token]/route.ts` from Prisma schema drift (`agentMissions`, `participants`, `calendarToken` not on the generated client). Worth triaging as a chaos-surface cleanup pass.",
      "",
      "Once this is unblocked, the FUL-5/6/8/12/13 fixes (already in main on commit 1ca802c) will deploy.",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error("✗", err.message ?? err);
  process.exit(1);
});
