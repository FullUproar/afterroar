"use client";

import { useState, useCallback, useRef } from "react";
import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/ui/sub-nav";
import { FeatureGate } from "@/components/feature-gate";

const INVENTORY_TABS = [
  { href: "/dashboard/inventory", label: "Inventory" },
  { href: "/dashboard/catalog", label: "Card Catalog" },
  { href: "/dashboard/deck-builder", label: "Deck Builder" },
  { href: "/dashboard/trade-ins", label: "Trade-Ins" },
  { href: "/dashboard/consignment", label: "Consignment" },
];

interface PreviewCard {
  name: string;
  quantity: number;
  set_name: string;
  set_code: string;
  condition: string;
  foil: boolean;
}

interface PreviewResponse {
  dry_run: true;
  total: number;
  preview: PreviewCard[];
  total_quantity: number;
}

interface ImportResponse {
  success: true;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
  total: number;
}

type Stage = "input" | "preview" | "imported";

export default function ImportCollectionPage() {
  const [stage, setStage] = useState<Stage>("input");
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [imported, setImported] = useState<ImportResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      setCsv(text);
      setError(null);
    };
    reader.readAsText(file);
  }, []);

  const runPreview = useCallback(async () => {
    if (!csv.trim()) {
      setError("Paste or upload a CSV first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/catalog/import-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, dry_run: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
      setStage("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }, [csv]);

  const runImport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/catalog/import-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImported(data);
      setStage("imported");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }, [csv]);

  const reset = useCallback(() => {
    setCsv("");
    setPreview(null);
    setImported(null);
    setError(null);
    setStage("input");
  }, []);

  return (
    <div className="flex flex-col h-full gap-4">
      <SubNav items={INVENTORY_TABS} />

      <div>
        <PageHeader title="Import Collection" backHref="/dashboard/catalog" />
        <p className="text-sm text-muted mt-1">
          Bulk-import an MTG collection from TCGPlayer, Moxfield, or any CSV
          with a <code className="text-foreground font-mono text-xs">name</code> column.
        </p>
      </div>

      <FeatureGate module="tcg_engine">
        {/* Progress steps */}
        <StepIndicator stage={stage} />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            <div className="font-medium">Something went wrong</div>
            <div className="text-red-300/80 mt-1">{error}</div>
          </div>
        )}

        {stage === "input" && (
          <div className="space-y-4">
            {/* Format help */}
            <div className="rounded-xl border border-card-border bg-card p-4 text-xs text-muted space-y-2">
              <div className="text-sm font-semibold text-foreground">
                Supported formats
              </div>
              <ul className="space-y-1 list-disc pl-5">
                <li>
                  <span className="text-foreground">TCGPlayer export</span> —
                  columns: Quantity, Name, Set Name, Set Code, Condition, Printing
                </li>
                <li>
                  <span className="text-foreground">Moxfield export</span> —
                  columns: Count, Name, Edition, Condition, Foil
                </li>
                <li>
                  <span className="text-foreground">Simple CSV</span> — any CSV
                  with a <code className="font-mono">name</code> column. Optional:{" "}
                  <code className="font-mono">quantity</code>,{" "}
                  <code className="font-mono">condition</code>,{" "}
                  <code className="font-mono">set</code>,{" "}
                  <code className="font-mono">foil</code>
                </li>
              </ul>
              <div className="text-[11px] text-muted/70 pt-1">
                Limit: 500 cards per import. Cards are looked up on Scryfall for
                pricing and images.
              </div>
            </div>

            {/* File + textarea */}
            <div className="rounded-xl border border-card-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-card-border bg-card-hover px-3 py-2 text-xs font-medium text-foreground hover:border-accent/40 transition-colors"
                >
                  Choose CSV file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFile(file);
                  }}
                />
                <span className="text-xs text-muted">or paste below</span>
                {csv && (
                  <span className="ml-auto text-[11px] text-muted tabular-nums">
                    {csv.split("\n").length - 1} lines
                  </span>
                )}
              </div>

              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Paste CSV contents here, including the header row..."
                spellCheck={false}
                className="w-full h-56 rounded-lg border border-input-border bg-card-hover px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted focus:border-accent focus:outline-none resize-none"
              />

              <div className="flex justify-end">
                <button
                  onClick={runPreview}
                  disabled={loading || !csv.trim()}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? "Parsing..." : "Preview"}
                </button>
              </div>
            </div>
          </div>
        )}

        {stage === "preview" && preview && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-xl border border-card-border bg-card p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Stat label="Cards" value={String(preview.total)} />
                <Stat
                  label="Total Quantity"
                  value={String(preview.total_quantity)}
                />
                <Stat
                  label="Preview Rows"
                  value={`${preview.preview.length} of ${preview.total}`}
                  sub={preview.total > preview.preview.length ? "first 20 shown" : undefined}
                />
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-card-border bg-card overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 text-[10px] text-muted uppercase tracking-wider border-b border-card-border">
                <div>Name</div>
                <div className="w-14 text-right">Qty</div>
                <div className="w-14 text-center">Cond</div>
                <div className="w-12 text-center">Foil</div>
                <div className="w-28 truncate">Set</div>
              </div>
              <div className="divide-y divide-card-border">
                {preview.preview.map((c, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-1.5 items-center text-xs"
                  >
                    <div className="text-foreground truncate" title={c.name}>
                      {c.name}
                    </div>
                    <div className="w-14 text-right tabular-nums text-muted">
                      {c.quantity}
                    </div>
                    <div className="w-14 text-center text-muted">{c.condition}</div>
                    <div className="w-12 text-center text-muted">
                      {c.foil ? "✦" : "—"}
                    </div>
                    <div className="w-28 truncate text-muted" title={c.set_name}>
                      {c.set_name || c.set_code || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={() => setStage("input")}
                disabled={loading}
                className="rounded-lg border border-card-border bg-card px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                Back
              </button>
              <button
                onClick={runImport}
                disabled={loading}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Importing {preview.total}...
                  </span>
                ) : (
                  `Import ${preview.total} card${preview.total !== 1 ? "s" : ""}`
                )}
              </button>
            </div>

            <p className="text-[11px] text-muted/70 text-right">
              Scryfall lookups take ~1 second per 10 cards. A 500-card import takes about a minute.
            </p>
          </div>
        )}

        {stage === "imported" && imported && (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6 text-center">
              <div className="text-3xl mb-2">✓</div>
              <div className="text-lg font-semibold text-foreground">
                Import complete
              </div>
              <div className="text-sm text-muted mt-1">
                {imported.total} cards processed
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Created" value={String(imported.created)} tone="good" />
              <Stat label="Updated" value={String(imported.updated)} tone="info" />
              <Stat
                label="Failed"
                value={String(imported.failed)}
                tone={imported.failed > 0 ? "bad" : undefined}
              />
            </div>

            {imported.errors.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <div className="text-sm font-semibold text-amber-300">
                  Couldn't find these on Scryfall
                </div>
                <ul className="text-xs text-amber-200/80 space-y-0.5 list-disc pl-5">
                  {imported.errors.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                  {imported.failed > imported.errors.length && (
                    <li className="list-none italic text-amber-200/60">
                      + {imported.failed - imported.errors.length} more
                    </li>
                  )}
                </ul>
                <p className="text-[11px] text-amber-200/60 pt-1">
                  These cards still got added to inventory but without Scryfall pricing or images. Edit manually if needed.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={reset}
                className="rounded-lg border border-card-border bg-card px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                Import more
              </button>
              <a
                href="/dashboard/inventory"
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-foreground hover:opacity-90 transition-opacity inline-flex items-center"
              >
                View Inventory
              </a>
            </div>
          </div>
        )}
      </FeatureGate>
    </div>
  );
}

/* ---------- helpers ---------- */

function StepIndicator({ stage }: { stage: Stage }) {
  const steps: { key: Stage; label: string }[] = [
    { key: "input", label: "Paste CSV" },
    { key: "preview", label: "Preview" },
    { key: "imported", label: "Done" },
  ];
  const idx = steps.findIndex((s) => s.key === stage);

  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                active
                  ? "bg-accent text-foreground font-semibold"
                  : done
                    ? "bg-accent/20 text-accent"
                    : "bg-card-hover text-muted"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px] tabular-nums">
                {done ? "✓" : i + 1}
              </span>
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-4 h-px ${
                  i < idx ? "bg-accent/40" : "bg-card-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "info";
}) {
  const colorClass =
    tone === "good"
      ? "text-green-400"
      : tone === "bad"
        ? "text-red-400"
        : tone === "info"
          ? "text-blue-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-card-border bg-card-hover/40 p-3">
      <div className="text-[10px] text-muted uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${colorClass}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-muted/80 mt-0.5">{sub}</div>
      )}
    </div>
  );
}
