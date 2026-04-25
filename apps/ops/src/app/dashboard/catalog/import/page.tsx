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

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="animate-spin" viewBox="0 0 24 24" fill="none" style={{ width: size, height: size }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

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

      <PageHeader
        title="Import Collection"
        crumb="TCG · Import"
        desc="Bulk-import an MTG collection from TCGPlayer, Moxfield, or any CSV with a name column."
        backHref="/dashboard/catalog"
      />

      <FeatureGate module="tcg_engine">
        {/* Step indicator — operator console mono pills */}
        <StepIndicator stage={stage} />

        {error && (
          <div
            className="px-4 py-3 font-mono"
            style={{
              background: "var(--red-mute)",
              border: "1px solid var(--red)",
              color: "var(--red)",
              fontSize: "0.78rem",
            }}
          >
            <div
              className="font-semibold uppercase"
              style={{ letterSpacing: "0.18em", fontSize: "0.66rem" }}
            >
              Something went wrong
            </div>
            <div className="mt-1 text-ink-soft">{error}</div>
          </div>
        )}

        {stage === "input" && (
          <div className="space-y-4">
            {/* Format help */}
            <div
              className="p-4 space-y-2"
              style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)" }}
            >
              <div
                className="font-mono uppercase font-semibold text-ink-faint flex items-center gap-2"
                style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    background: "currentColor",
                    clipPath:
                      "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
                  }}
                />
                Supported Formats
              </div>
              <ul
                className="space-y-1 list-disc pl-5 text-ink-soft"
                style={{ fontSize: "0.78rem", lineHeight: 1.5 }}
              >
                <li>
                  <span className="text-ink font-medium">TCGPlayer export</span> —
                  columns: Quantity, Name, Set Name, Set Code, Condition, Printing
                </li>
                <li>
                  <span className="text-ink font-medium">Moxfield export</span> —
                  columns: Count, Name, Edition, Condition, Foil
                </li>
                <li>
                  <span className="text-ink font-medium">Simple CSV</span> — any CSV
                  with a <code className="font-mono text-ink">name</code> column. Optional:{" "}
                  <code className="font-mono">quantity</code>,{" "}
                  <code className="font-mono">condition</code>,{" "}
                  <code className="font-mono">set</code>,{" "}
                  <code className="font-mono">foil</code>
                </li>
              </ul>
              <div
                className="font-mono text-ink-faint pt-1"
                style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
              >
                Limit: 500 cards per import. Cards are looked up on Scryfall for pricing and images.
              </div>
            </div>

            {/* File + textarea */}
            <div
              className="p-4 space-y-3"
              style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)" }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-mono uppercase font-semibold transition-colors"
                  style={{
                    fontSize: "0.62rem",
                    letterSpacing: "0.16em",
                    padding: "0 0.85rem",
                    minHeight: 44,
                    background: "var(--panel)",
                    border: "1px solid var(--rule-hi)",
                    color: "var(--ink-soft)",
                  }}
                >
                  Choose CSV File
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
                <span
                  className="font-mono uppercase text-ink-faint"
                  style={{ fontSize: "0.6rem", letterSpacing: "0.18em" }}
                >
                  or paste below
                </span>
                {csv && (
                  <span
                    className="ml-auto font-mono text-ink-faint tabular-nums"
                    style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
                  >
                    {csv.split("\n").length - 1} lines
                  </span>
                )}
              </div>

              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Paste CSV contents here, including the header row…"
                spellCheck={false}
                className="w-full font-mono text-ink placeholder:text-ink-faint focus:outline-none p-3"
                style={{
                  height: 224,
                  background: "var(--panel)",
                  border: "1px solid var(--rule-hi)",
                  fontSize: "0.78rem",
                  resize: "none",
                }}
              />

              <div className="flex justify-end">
                <button
                  onClick={runPreview}
                  disabled={loading || !csv.trim()}
                  className="font-mono uppercase font-semibold transition-opacity disabled:opacity-50"
                  style={{
                    fontSize: "0.7rem",
                    letterSpacing: "0.18em",
                    padding: "0 1.4rem",
                    minHeight: 48,
                    background: "var(--orange)",
                    color: "var(--void)",
                    border: "1px solid var(--orange)",
                  }}
                >
                  {loading ? "Parsing…" : "Preview"}
                </button>
              </div>
            </div>
          </div>
        )}

        {stage === "preview" && preview && (
          <div className="space-y-4">
            {/* Stat strip */}
            <div
              className="grid grid-cols-2 md:grid-cols-3"
              style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
            >
              {[
                { k: "Cards", v: preview.total.toLocaleString() },
                { k: "Total Qty", v: preview.total_quantity.toLocaleString() },
                {
                  k: "Preview Rows",
                  v: `${preview.preview.length} of ${preview.total}`,
                  sub: preview.total > preview.preview.length ? "first 20" : undefined,
                },
              ].map((cell) => (
                <div key={cell.k} className="px-3 py-2" style={{ background: "var(--panel-mute)" }}>
                  <div
                    className="font-mono uppercase font-semibold text-ink-faint"
                    style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
                  >
                    {cell.k}
                  </div>
                  <div
                    className="font-mono font-semibold mt-1 tabular-nums text-ink"
                    style={{ fontSize: "1rem", letterSpacing: "0.02em" }}
                  >
                    {cell.v}
                  </div>
                  {cell.sub && (
                    <div
                      className="font-mono text-ink-faint mt-0.5"
                      style={{ fontSize: "0.6rem", letterSpacing: "0.04em" }}
                    >
                      {cell.sub} shown
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Table */}
            <section className="ar-zone" style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}>
              <div className="ar-zone-head">
                <span>Preview Rows</span>
                <span className="text-ink-faint">{preview.preview.length} cards</span>
              </div>
              <div
                className="grid items-center px-4 py-2"
                style={{
                  gridTemplateColumns: "1fr 60px 60px 50px 120px",
                  gap: "0.85rem",
                  background: "var(--panel-mute)",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                {[
                  { l: "Name", a: "left" },
                  { l: "Qty", a: "right" },
                  { l: "Cond", a: "center" },
                  { l: "Foil", a: "center" },
                  { l: "Set", a: "left" },
                ].map((h) => (
                  <div
                    key={h.l}
                    className="font-mono uppercase font-semibold text-ink-faint"
                    style={{
                      fontSize: "0.55rem",
                      letterSpacing: "0.22em",
                      textAlign: h.a as "left" | "right" | "center",
                    }}
                  >
                    {h.l}
                  </div>
                ))}
              </div>
              <div>
                {preview.preview.map((c, i) => (
                  <div
                    key={i}
                    className="grid items-center px-4 py-1.5"
                    style={{
                      gridTemplateColumns: "1fr 60px 60px 50px 120px",
                      gap: "0.85rem",
                      borderBottom: "1px solid var(--rule-faint)",
                      fontSize: "0.78rem",
                    }}
                  >
                    <div className="text-ink truncate" title={c.name}>
                      {c.name}
                    </div>
                    <div className="text-right font-mono tabular-nums text-ink-soft">
                      {c.quantity}
                    </div>
                    <div className="text-center font-mono uppercase text-ink-soft" style={{ fontSize: "0.7rem", letterSpacing: "0.08em" }}>
                      {c.condition}
                    </div>
                    <div className="text-center" style={{ color: c.foil ? "var(--yellow)" : "var(--ink-ghost)" }}>
                      {c.foil ? (
                        <span
                          aria-hidden
                          style={{
                            display: "inline-block",
                            width: 6,
                            height: 6,
                            background: "currentColor",
                            clipPath:
                              "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
                          }}
                        />
                      ) : "—"}
                    </div>
                    <div className="font-mono truncate text-ink-soft" style={{ fontSize: "0.7rem" }} title={c.set_name}>
                      {c.set_name || c.set_code || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Actions */}
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={() => setStage("input")}
                disabled={loading}
                className="font-mono uppercase font-semibold transition-colors"
                style={{
                  fontSize: "0.66rem",
                  letterSpacing: "0.18em",
                  padding: "0 1rem",
                  minHeight: 48,
                  background: "var(--panel)",
                  border: "1px solid var(--rule-hi)",
                  color: "var(--ink-soft)",
                }}
              >
                Back
              </button>
              <button
                onClick={runImport}
                disabled={loading}
                className="font-mono uppercase font-semibold transition-opacity disabled:opacity-50"
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  padding: "0 1.4rem",
                  minHeight: 48,
                  background: "var(--orange)",
                  color: "var(--void)",
                  border: "1px solid var(--orange)",
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <Spinner />
                    Importing {preview.total}…
                  </span>
                ) : (
                  `Import ${preview.total} card${preview.total !== 1 ? "s" : ""}`
                )}
              </button>
            </div>

            <p
              className="font-mono text-ink-faint text-right"
              style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
            >
              Scryfall lookups take ~1 second per 10 cards. A 500-card import takes about a minute.
            </p>
          </div>
        )}

        {stage === "imported" && imported && (
          <div className="space-y-4">
            <div
              className="p-6 text-center"
              style={{ background: "var(--teal-mute)", border: "1px solid var(--teal)" }}
            >
              <div
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  margin: "0 auto 0.75rem",
                  background: "var(--teal)",
                  clipPath: "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
                }}
              />
              <div
                className="font-display text-ink"
                style={{ fontSize: "1.4rem", fontWeight: 600, letterSpacing: "0.005em" }}
              >
                Import Complete
              </div>
              <div className="font-mono text-ink-soft mt-1" style={{ fontSize: "0.78rem" }}>
                {imported.total} cards processed
              </div>
            </div>

            <div
              className="grid grid-cols-3"
              style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
            >
              {[
                { k: "Created", v: imported.created.toLocaleString(), tone: "var(--teal)" },
                { k: "Updated", v: imported.updated.toLocaleString() },
                {
                  k: "Failed",
                  v: imported.failed.toLocaleString(),
                  tone: imported.failed > 0 ? "var(--red)" : undefined,
                },
              ].map((cell) => (
                <div key={cell.k} className="px-3 py-2" style={{ background: "var(--panel-mute)" }}>
                  <div
                    className="font-mono uppercase font-semibold text-ink-faint"
                    style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
                  >
                    {cell.k}
                  </div>
                  <div
                    className="font-mono font-semibold mt-1 tabular-nums"
                    style={{
                      fontSize: "1.1rem",
                      letterSpacing: "0.02em",
                      color: cell.tone || "var(--ink)",
                    }}
                  >
                    {cell.v}
                  </div>
                </div>
              ))}
            </div>

            {imported.errors.length > 0 && (
              <div
                className="p-4 space-y-2"
                style={{ background: "var(--yellow-mute)", border: "1px solid rgba(251,219,101,0.4)" }}
              >
                <div
                  className="font-mono uppercase font-semibold flex items-center gap-2"
                  style={{ color: "var(--yellow)", fontSize: "0.66rem", letterSpacing: "0.18em" }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      background: "currentColor",
                      clipPath:
                        "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
                    }}
                  />
                  Couldn&apos;t Find on Scryfall
                </div>
                <ul
                  className="text-ink-soft space-y-0.5 list-disc pl-5"
                  style={{ fontSize: "0.74rem" }}
                >
                  {imported.errors.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                  {imported.failed > imported.errors.length && (
                    <li className="list-none italic text-ink-faint">
                      + {imported.failed - imported.errors.length} more
                    </li>
                  )}
                </ul>
                <p
                  className="font-mono text-ink-faint pt-1"
                  style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
                >
                  These cards still got added to inventory but without Scryfall pricing or images. Edit manually if needed.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={reset}
                className="font-mono uppercase font-semibold transition-colors"
                style={{
                  fontSize: "0.66rem",
                  letterSpacing: "0.18em",
                  padding: "0 1rem",
                  minHeight: 48,
                  background: "var(--panel)",
                  border: "1px solid var(--rule-hi)",
                  color: "var(--ink-soft)",
                }}
              >
                Import More
              </button>
              <a
                href="/dashboard/inventory"
                className="font-mono uppercase font-semibold transition-opacity inline-flex items-center"
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  padding: "0 1.4rem",
                  minHeight: 48,
                  background: "var(--orange)",
                  color: "var(--void)",
                  border: "1px solid var(--orange)",
                }}
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
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className="font-mono uppercase font-semibold inline-flex items-center gap-1.5"
              style={{
                fontSize: "0.62rem",
                letterSpacing: "0.18em",
                padding: "0 0.85rem",
                minHeight: 36,
                background: active
                  ? "var(--orange-mute)"
                  : done
                    ? "var(--teal-mute)"
                    : "var(--panel-mute)",
                color: active
                  ? "var(--orange)"
                  : done
                    ? "var(--teal)"
                    : "var(--ink-faint)",
                border: `1px solid ${active ? "var(--orange)" : done ? "var(--teal)" : "var(--rule-hi)"}`,
              }}
            >
              <span
                className="inline-flex items-center justify-center font-mono tabular-nums"
                style={{
                  width: 16,
                  height: 16,
                  background: "var(--void)",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 16,
                  height: 1,
                  background: i < idx ? "var(--teal)" : "var(--rule)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
