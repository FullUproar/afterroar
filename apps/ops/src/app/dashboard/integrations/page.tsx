"use client";

/**
 * /dashboard/integrations — connection status for every data integration.
 *
 * Shows each integration in the registry with status pill (ok / degraded /
 * down / unconfigured / untested), last-test timestamp, latency, error,
 * and a "Test connection" button. Grouped by integration kind for scanability.
 *
 * Strategy doc: docs/DATA_INTEGRATIONS_STRATEGY.md.
 */

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";

interface IntegrationStatus {
  id: string;
  name: string;
  kind: string;
  categories: string[];
  description: string;
  docsUrl?: string;
  configScope: "platform" | "per_store" | "hybrid";
  requiredEnv: string[];
  capabilities: {
    search?: boolean;
    lookup?: boolean;
    mapToCatalog?: boolean;
    pricing?: boolean;
    listing?: boolean;
  };
  active: boolean;
  priority: number;
  status: "ok" | "degraded" | "down" | "unconfigured" | "untested";
  last_tested_at: string | null;
  last_latency_ms: number | null;
  last_error: string | null;
  missing_env: string[];
}

const STATUS_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  ok: { bg: "rgba(16,185,129,0.15)", fg: "var(--teal)", label: "OK" },
  degraded: { bg: "rgba(251,191,36,0.15)", fg: "var(--amber)", label: "Degraded" },
  down: { bg: "rgba(239,68,68,0.15)", fg: "var(--red)", label: "Down" },
  unconfigured: { bg: "rgba(148,163,184,0.15)", fg: "var(--ink-soft)", label: "Unconfigured" },
  untested: { bg: "rgba(148,163,184,0.10)", fg: "var(--ink-faint)", label: "Untested" },
};

const KIND_LABELS: Record<string, string> = {
  metadata: "Catalog metadata",
  marketplace: "Marketplace listing",
  pricing: "Secondary pricing",
  distributor: "Distributor catalog",
  payment: "Payment infrastructure",
  barcode: "Barcode lookup",
};

const KIND_ORDER = ["metadata", "pricing", "barcode", "marketplace", "distributor", "payment"];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [bulkTesting, setBulkTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function testOne(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/integrations/${id}/test`, { method: "POST" });
      if (res.ok) {
        await load();
      }
    } finally {
      setTestingId(null);
    }
  }

  async function testAll() {
    setBulkTesting(true);
    try {
      // Sequential to avoid pummeling sources at once.
      for (const i of integrations) {
        if (!i.active) continue;
        await fetch(`/api/integrations/${i.id}/test`, { method: "POST" }).catch(() => {});
      }
      await load();
    } finally {
      setBulkTesting(false);
    }
  }

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_LABELS[kind] ?? kind,
    items: integrations.filter((i) => i.kind === kind).sort((a, b) => a.priority - b.priority),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Integrations"
        crumb="Console · Settings"
        desc="Health + capabilities for every data source the POS talks to. See docs/DATA_INTEGRATIONS_STRATEGY.md for context."
        action={
          <button
            type="button"
            onClick={testAll}
            disabled={bulkTesting || loading}
            className="inline-flex items-center font-display uppercase disabled:opacity-30"
            style={{
              fontSize: "0.85rem",
              letterSpacing: "0.06em",
              fontWeight: 700,
              padding: "0 1rem",
              minHeight: 48,
              color: "var(--void)",
              background: "var(--orange)",
              border: "1px solid var(--orange)",
            }}
          >
            {bulkTesting ? "Testing…" : "Test all"}
          </button>
        }
      />

      {loading ? (
        <div className="ar-zone p-8 text-center text-ink-soft text-sm">Loading…</div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.kind} className="ar-zone">
              <div className="ar-zone-head">
                <span>{group.label}</span>
                <span>{group.items.length}</span>
              </div>
              <div className="divide-y divide-rule">
                {group.items.map((i) => (
                  <IntegrationRow
                    key={i.id}
                    integration={i}
                    onTest={() => testOne(i.id)}
                    testing={testingId === i.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationRow({
  integration: i,
  onTest,
  testing,
}: {
  integration: IntegrationStatus;
  onTest: () => void;
  testing: boolean;
}) {
  const color = STATUS_COLOR[i.status] ?? STATUS_COLOR.untested!;
  const lastTestedAgo = i.last_tested_at ? formatRelative(i.last_tested_at) : "never";

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-foreground font-medium">{i.name}</span>
            <span
              className="font-mono uppercase px-1.5 py-0.5 rounded-full"
              style={{
                fontSize: "0.62rem",
                letterSpacing: "0.08em",
                background: color.bg,
                color: color.fg,
                border: `1px solid ${color.fg}40`,
              }}
            >
              {color.label}
            </span>
            {!i.active && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-400">
                Inactive
              </span>
            )}
            {i.configScope !== "platform" && (
              <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                {i.configScope === "per_store" ? "Per-store" : "Hybrid"}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wider text-ink-faint">
              priority #{i.priority}
            </span>
          </div>
          <p className="text-[11px] text-ink-soft mt-1 leading-relaxed">{i.description}</p>
          {i.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {i.categories.map((c) => (
                <span
                  key={c}
                  className="text-[10px] uppercase tracking-wider text-ink-faint border border-rule px-1.5 py-0.5 rounded-full"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          {i.missing_env.length > 0 && (
            <div className="mt-1 text-[11px]" style={{ color: "var(--amber)" }}>
              Missing env: {i.missing_env.join(", ")}
            </div>
          )}
          {i.last_error && (
            <div className="mt-1 text-[11px]" style={{ color: "var(--red)" }}>
              {i.last_error}
            </div>
          )}
          <div className="mt-1 text-[10px] text-ink-faint">
            Last tested {lastTestedAgo}
            {i.last_latency_ms != null && ` · ${i.last_latency_ms}ms`}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={onTest}
            disabled={testing}
            className="font-mono uppercase border border-rule px-2.5 py-1 hover:border-ink-soft text-ink-soft hover:text-ink transition-colors disabled:opacity-30"
            style={{ fontSize: "0.65rem", letterSpacing: "0.08em" }}
          >
            {testing ? "Testing…" : "Test"}
          </button>
          {i.docsUrl && (
            <a
              href={i.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] uppercase tracking-wider text-ink-faint hover:text-ink"
            >
              Docs ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h ago`;
  if (ms < 604800_000) return `${Math.floor(ms / 86400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}
