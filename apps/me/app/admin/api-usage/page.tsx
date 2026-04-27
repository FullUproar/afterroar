/**
 * /admin/api-usage — federation API monitoring dashboard.
 *
 * Server-rendered. Aggregates ApiUsageLog over the trailing 24h:
 *  - Total requests, success rate, p95 latency, unique consumers
 *  - Top endpoints (by volume + error rate)
 *  - Top API keys (by usage + last seen)
 *  - Recent errors (status >= 400)
 *
 * Auto-refreshes every 30s via meta tag. Admin-only via isAdmin().
 */

import { auth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIOD_MS = 24 * 60 * 60 * 1000;

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function ms(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1) return "<1ms";
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(2)}s`;
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default async function ApiUsagePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/api-usage");
  if (!isAdmin(session.user.email)) {
    return (
      <main style={{ maxWidth: "32rem", margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ color: "#ef4444", fontSize: "1.5rem", fontWeight: 900 }}>Not authorized</h1>
        <p style={{ color: "#9ca3af" }}>This panel is admin-only.</p>
        <Link href="/" style={{ color: "#FF8200" }}>← Back</Link>
      </main>
    );
  }

  const since = new Date(Date.now() - PERIOD_MS);

  const [logs, keys] = await Promise.all([
    prisma.apiUsageLog.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: "desc" },
      include: { apiKey: { select: { id: true, name: true, keyPrefix: true } } },
      take: 5000, // hard cap so we don't bring down the page if traffic spikes
    }),
    prisma.apiKey.findMany({
      orderBy: [{ revokedAt: "asc" }, { lastUsedAt: "desc" }],
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    }),
  ]);

  const total = logs.length;
  const errors = logs.filter((l) => l.status >= 400).length;
  const successes = total - errors;
  const latencies = logs.map((l) => l.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const uniqueConsumers = new Set(logs.map((l) => l.apiKeyId).filter(Boolean)).size;

  // Top endpoints
  const byEndpoint = new Map<string, { total: number; errors: number; latSum: number }>();
  for (const l of logs) {
    const slot = byEndpoint.get(l.endpoint) ?? { total: 0, errors: 0, latSum: 0 };
    slot.total++;
    if (l.status >= 400) slot.errors++;
    slot.latSum += l.latencyMs;
    byEndpoint.set(l.endpoint, slot);
  }
  const topEndpoints = Array.from(byEndpoint.entries())
    .map(([endpoint, s]) => ({
      endpoint,
      total: s.total,
      errors: s.errors,
      avgLatency: s.total > 0 ? s.latSum / s.total : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Top consumers (by API key)
  const byKey = new Map<string, { total: number; errors: number; lastSeen: Date }>();
  for (const l of logs) {
    if (!l.apiKeyId) continue;
    const slot = byKey.get(l.apiKeyId) ?? { total: 0, errors: 0, lastSeen: l.timestamp };
    slot.total++;
    if (l.status >= 400) slot.errors++;
    if (l.timestamp > slot.lastSeen) slot.lastSeen = l.timestamp;
    byKey.set(l.apiKeyId, slot);
  }
  const topConsumers = Array.from(byKey.entries())
    .map(([id, s]) => {
      const meta = keys.find((k) => k.id === id);
      return { id, name: meta?.name ?? "(unknown)", prefix: meta?.keyPrefix ?? "—", ...s };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const recentErrors = logs.filter((l) => l.status >= 400).slice(0, 20);

  return (
    <>
      {/* Auto-refresh every 30s */}
      <meta httpEquiv="refresh" content="30" />
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        <header style={{ marginBottom: "2rem", display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ color: "#FBDB65", fontSize: "1.75rem", fontWeight: 900, margin: 0 }}>API Usage — last 24h</h1>
            <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
              Auto-refreshes every 30s · {logs.length === 5000 ? "showing newest 5,000 records" : `${total} requests`}
            </p>
          </div>
          <Link href="/admin/api-keys" style={{ color: "#FF8200", fontSize: "0.9rem", fontWeight: 700, textDecoration: "none" }}>
            Manage keys →
          </Link>
        </header>

        {/* Top stats */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "2rem" }}>
          <Stat label="Total requests" value={total.toLocaleString()} />
          <Stat label="Success rate" value={pct(successes, total)} positive={errors === 0} />
          <Stat label="p50 latency" value={ms(p50)} />
          <Stat label="p95 latency" value={ms(p95)} />
          <Stat label="p99 latency" value={ms(p99)} />
          <Stat label="Unique consumers" value={String(uniqueConsumers)} />
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={sectionH}>Top endpoints</h2>
          <DataTable
            headers={["Endpoint", "Requests", "Errors", "Avg latency"]}
            rows={topEndpoints.map((e) => [
              e.endpoint,
              e.total.toLocaleString(),
              <span key="err" style={{ color: e.errors > 0 ? "#ef4444" : "#10b981" }}>
                {e.errors > 0 ? `${e.errors} (${pct(e.errors, e.total)})` : "0"}
              </span>,
              ms(e.avgLatency),
            ])}
            empty="No requests in the last 24h."
          />
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={sectionH}>Top consumers</h2>
          <DataTable
            headers={["Name", "Prefix", "Requests (24h)", "Errors", "Last seen"]}
            rows={topConsumers.map((c) => [
              c.name,
              <code key="p" style={{ color: "#FBDB65", fontFamily: "monospace", fontSize: "0.85rem" }}>{c.prefix}</code>,
              c.total.toLocaleString(),
              <span key="e" style={{ color: c.errors > 0 ? "#ef4444" : "#10b981" }}>{c.errors}</span>,
              relativeTime(c.lastSeen),
            ])}
            empty="No authenticated requests in the last 24h."
          />
        </section>

        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={sectionH}>All API keys ({keys.length})</h2>
          <DataTable
            headers={["Name", "Prefix", "Scopes", "Total uses", "Last seen", "Status"]}
            rows={keys.map((k) => [
              k.name,
              <code key="p" style={{ color: "#FBDB65", fontFamily: "monospace", fontSize: "0.85rem" }}>{k.keyPrefix}</code>,
              <span key="s" style={{ color: "#94a3b8", fontSize: "0.78rem" }}>{k.scopes.join(", ")}</span>,
              k.usageCount.toLocaleString(),
              k.lastUsedAt ? relativeTime(k.lastUsedAt) : "never",
              <KeyStatus key="st" revokedAt={k.revokedAt} expiresAt={k.expiresAt} />,
            ])}
            empty="No API keys minted yet."
          />
        </section>

        <section>
          <h2 style={sectionH}>Recent errors ({recentErrors.length})</h2>
          {recentErrors.length === 0 ? (
            <div style={{ padding: "1rem", color: "#10b981", textAlign: "center", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "0.5rem" }}>
              ✓ No errors in the last 24h
            </div>
          ) : (
            <DataTable
              headers={["When", "Endpoint", "Status", "Error code", "Latency", "IP"]}
              rows={recentErrors.map((l) => [
                relativeTime(l.timestamp),
                l.endpoint,
                <span key="s" style={{ color: l.status >= 500 ? "#ef4444" : "#fbbf24" }}>{l.status}</span>,
                l.errorCode ?? "—",
                ms(l.latencyMs),
                <code key="ip" style={{ color: "#6b7280", fontSize: "0.78rem" }}>{l.ip ?? "—"}</code>,
              ])}
              empty=""
            />
          )}
        </section>
      </main>
    </>
  );
}

const sectionH: React.CSSProperties = {
  color: "#FBDB65",
  fontSize: "1rem",
  fontWeight: 700,
  marginBottom: "0.75rem",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(31, 41, 55, 0.85), rgba(17, 24, 39, 0.95))",
      borderRadius: "0.75rem",
      border: "1px solid rgba(255, 130, 0, 0.15)",
      padding: "1rem",
    }}>
      <div style={{ fontSize: "0.7rem", color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", color: positive ? "#10b981" : "#FBDB65", fontWeight: 900, marginTop: "0.375rem" }}>
        {value}
      </div>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0 && empty) {
    return <div style={{ padding: "1rem", color: "#6b7280", textAlign: "center", border: "1px solid #374151", borderRadius: "0.5rem" }}>{empty}</div>;
  }
  return (
    <div style={{ overflow: "auto", border: "1px solid #374151", borderRadius: "0.75rem" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ background: "rgba(0, 0, 0, 0.4)" }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: "0.625rem 0.875rem", textAlign: "left", color: "#94a3b8", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid #1f2937" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "0.625rem 0.875rem", color: "#e2e8f0", verticalAlign: "middle" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyStatus({ revokedAt, expiresAt }: { revokedAt: Date | null; expiresAt: Date | null }) {
  if (revokedAt) return <span style={{ color: "#ef4444", fontWeight: 700 }}>revoked</span>;
  if (expiresAt && expiresAt < new Date()) return <span style={{ color: "#fbbf24", fontWeight: 700 }}>expired</span>;
  return <span style={{ color: "#10b981", fontWeight: 700 }}>active</span>;
}
