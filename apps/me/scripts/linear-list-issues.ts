/**
 * One-off: list open Linear issues in the configured team. Used as a
 * pre-flight when working through the queue — surfaces title, identifier,
 * priority, state, labels, and a description preview so we can pick
 * what's actually trivially fixable vs needs a real conversation.
 *
 * Usage:
 *   set -a && . .env.local && set +a && npx tsx scripts/linear-list-issues.ts
 */

const LINEAR_API_URL_LIST = "https://api.linear.app/graphql";

async function listGql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("LINEAR_API_KEY is not set");
  const res = await fetch(LINEAR_API_URL_LIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors) throw new Error(`Linear graphql errors: ${JSON.stringify(json.errors)}`);
  if (!json.data) throw new Error("Linear returned no data");
  return json.data;
}

interface IssueResp {
  issues: {
    nodes: Array<{
      id: string;
      identifier: string;
      title: string;
      description: string | null;
      url: string;
      priority: number;
      priorityLabel: string;
      state: { name: string; type: string };
      labels: { nodes: Array<{ name: string }> };
      createdAt: string;
      assignee: { name: string; email: string } | null;
    }>;
  };
}

async function main() {
  const teamKey = process.env.LINEAR_TEAM_KEY || "FUL";
  console.log(`→ Listing open Linear issues in ${teamKey}…\n`);

  const data = await listGql<IssueResp>(
    `
      query OpenIssues($team: String!) {
        issues(
          filter: {
            team: { key: { eq: $team } }
            state: { type: { in: ["unstarted", "started", "backlog"] } }
          }
          orderBy: createdAt
          first: 100
        ) {
          nodes {
            id
            identifier
            title
            description
            url
            priority
            priorityLabel
            state { name type }
            labels { nodes { name } }
            createdAt
            assignee { name email }
          }
        }
      }
    `,
    { team: teamKey },
  );

  const issues = data.issues.nodes;
  if (issues.length === 0) {
    console.log("(no open issues)");
    return;
  }

  console.log(`Found ${issues.length} open:\n`);
  for (const i of issues) {
    const labels = i.labels.nodes.map((l) => l.name).join(", ") || "—";
    const assignee = i.assignee ? i.assignee.name : "(unassigned)";
    const desc = (i.description ?? "").trim().split("\n").slice(0, 6).join("\n");

    console.log(`━━━ ${i.identifier}  [${i.state.name} · ${i.priorityLabel}]  ${labels}`);
    console.log(`    ${i.title}`);
    console.log(`    ${i.url}`);
    console.log(`    Assignee: ${assignee}`);
    if (desc.length > 0) {
      console.log(`    ────`);
      for (const line of desc.split("\n")) console.log(`    ${line}`);
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("✗", err.message ?? err);
  process.exit(1);
});
