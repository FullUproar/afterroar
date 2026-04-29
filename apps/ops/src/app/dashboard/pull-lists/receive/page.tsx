"use client";

/**
 * /dashboard/pull-lists/receive — weekly comics receive workflow.
 *
 * Wednesday-morning ritual at every comic shop: the Diamond/Lunar
 * shipment arrives, you compare to the invoice, and you allocate
 * each issue to the customers on its pull list.
 *
 * This page lets staff paste a list of (series, issue, variant) lines —
 * either typed manually or pasted from a spreadsheet — and bulk-allocate
 * them. The UI shows per-row matching results so staff know which
 * subscribers are getting what.
 *
 * Out of scope for v1: parsing the Diamond/Lunar PDF/CSV directly.
 * That belongs in a separate ingest adapter; the manual paste path
 * works for shops of any size today.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

interface Row {
  series_title: string;
  issue_number: string;
  variant_label: string;
}

interface Result {
  series_title: string;
  issue_number: string;
  variant_label: string | null;
  matched_lists: number;
  allocated: number;
  skipped_already_allocated: number;
  list_ids: string[];
}

interface Totals {
  allocated: number;
  skipped: number;
  unmatched: number;
}

const SAMPLE = `Saga, 67, Cover B
Batman, 150
The Department of Truth, 24
Spawn, 359, 1:25 ratio
Saga, 67`;

export default function ReceiveComicsPage() {
  const [paste, setPaste] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parsePaste(paste), [paste]);

  async function submit() {
    if (parsed.length === 0) return;
    setSubmitting(true);
    setError(null);
    setResults(null);
    setTotals(null);
    try {
      const res = await fetch("/api/pull-lists/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issues: parsed,
          expires_in_days: expiresInDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setResults(data.results ?? []);
      setTotals(data.totals ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setPaste("");
    setResults(null);
    setTotals(null);
    setError(null);
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Receive Comics"
        crumb="Console · Pull Lists"
        backHref="/dashboard/pull-lists"
        desc="Paste this week's incoming issues. We allocate each one to every active subscriber for the matching series — pending pickup. Variant covers only go to subscribers who opted in."
        action={
          <Link
            href="/dashboard/pull-lists"
            className="font-mono uppercase border border-rule-hi text-ink-soft hover:text-ink px-3"
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.18em",
              fontWeight: 600,
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              background: "var(--panel)",
            }}
          >
            Back to Pull Lists
          </Link>
        }
      />

      {/* Input */}
      <section className="ar-zone" style={{ padding: "1.1rem" }}>
        <div className="flex items-baseline justify-between mb-2">
          <span
            className="font-mono uppercase text-ink-soft"
            style={{ fontSize: "0.62rem", letterSpacing: "0.28em", fontWeight: 600 }}
          >
            Issues Arriving
          </span>
          <button
            type="button"
            onClick={() => setPaste(SAMPLE)}
            className="font-mono uppercase text-ink-faint hover:text-orange transition-colors"
            style={{ fontSize: "0.6rem", letterSpacing: "0.18em", fontWeight: 600 }}
          >
            Use sample
          </button>
        </div>
        <p
          className="text-ink-faint mb-2"
          style={{ fontSize: "0.78rem", lineHeight: 1.5 }}
        >
          One issue per line: <span className="font-mono text-ink-soft">Series Title, Issue #, Variant Label (optional)</span>.
          Tab-separated also works (paste straight from a spreadsheet).
        </p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={10}
          placeholder={`Saga, 67, Cover B
Batman, 150
The Department of Truth, 24`}
          className="w-full font-mono text-ink focus:outline-none"
          style={{
            background: "var(--panel-mute)",
            border: "1px solid var(--rule-hi)",
            fontSize: "0.85rem",
            padding: "0.75rem",
            resize: "vertical",
            lineHeight: 1.5,
          }}
        />

        <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span
              className="font-mono uppercase text-ink-faint"
              style={{ fontSize: "0.62rem", letterSpacing: "0.18em", fontWeight: 600 }}
            >
              {parsed.length} {parsed.length === 1 ? "row" : "rows"} parsed
            </span>
            <label className="flex items-center gap-2">
              <span
                className="font-mono uppercase text-ink-faint"
                style={{ fontSize: "0.6rem", letterSpacing: "0.18em", fontWeight: 600 }}
              >
                Hold for
              </span>
              <input
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Math.max(1, parseInt(e.target.value || "90", 10)))}
                className="w-20 text-ink tabular-nums"
                style={{
                  background: "var(--panel-mute)",
                  border: "1px solid var(--rule-hi)",
                  fontSize: "0.85rem",
                  padding: "0.4rem 0.5rem",
                }}
              />
              <span
                className="font-mono uppercase text-ink-faint"
                style={{ fontSize: "0.6rem", letterSpacing: "0.18em", fontWeight: 600 }}
              >
                days
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            {results && (
              <button
                type="button"
                onClick={reset}
                className="font-mono uppercase border border-rule-hi text-ink-soft hover:text-ink px-3"
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  fontWeight: 600,
                  minHeight: 44,
                  background: "var(--panel)",
                }}
              >
                Start Over
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={submitting || parsed.length === 0 || !!results}
              className="font-display uppercase disabled:opacity-30"
              style={{
                fontSize: "0.85rem",
                letterSpacing: "0.06em",
                fontWeight: 700,
                padding: "0 1.15rem",
                minHeight: 44,
                color: "var(--void)",
                background: "var(--orange)",
                border: "1px solid var(--orange)",
              }}
            >
              {submitting ? "Allocating…" : results ? "Allocated" : "Allocate"}
            </button>
          </div>
        </div>
      </section>

      {/* Preview of parsed rows before allocating */}
      {!results && parsed.length > 0 && (
        <section
          className="ar-zone"
          style={{ padding: "0.75rem 1rem" }}
        >
          <div
            className="font-mono uppercase text-ink-soft mb-2"
            style={{ fontSize: "0.6rem", letterSpacing: "0.22em", fontWeight: 600 }}
          >
            Parse Preview
          </div>
          <div className="grid grid-cols-12 gap-2">
            {parsed.map((r, i) => (
              <div
                key={i}
                className="col-span-12 md:col-span-6 lg:col-span-4 font-mono"
                style={{
                  fontSize: "0.78rem",
                  color: "var(--ink-soft)",
                  padding: "0.4rem 0.6rem",
                  background: "var(--panel-mute)",
                  border: "1px solid var(--rule)",
                }}
              >
                <span className="text-ink">{r.series_title}</span>
                <span className="text-ink-faint mx-1">·</span>
                <span>#{r.issue_number}</span>
                {r.variant_label && (
                  <>
                    <span className="text-ink-faint mx-1">·</span>
                    <span style={{ color: "var(--orange)" }}>{r.variant_label}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p
          className="font-mono"
          style={{
            fontSize: "0.78rem",
            color: "var(--red)",
            background: "var(--red-mute)",
            border: "1px solid rgba(214,90,90,0.35)",
            padding: "0.6rem 0.8rem",
          }}
        >
          ! {error}
        </p>
      )}

      {/* Results */}
      {results && totals && (
        <>
          <section
            className="grid grid-cols-2 md:grid-cols-3 gap-px"
            style={{ background: "var(--rule)", border: "1px solid var(--rule)" }}
          >
            <KpiCell k="Allocated" v={totals.allocated.toLocaleString()} primary sub={totals.allocated > 0 ? "Issues queued for pickup" : undefined} />
            <KpiCell
              k="Skipped (Duplicate)"
              v={totals.skipped.toLocaleString()}
              sub={totals.skipped > 0 ? "Already allocated previously" : "—"}
              tone={totals.skipped > 0 ? "warn" : undefined}
            />
            <KpiCell
              k="No Subscribers"
              v={totals.unmatched.toLocaleString()}
              sub={totals.unmatched > 0 ? "No active pull list" : "—"}
              tone={totals.unmatched > 0 ? "warn" : undefined}
            />
          </section>

          <section
            className="flex flex-col"
            style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
          >
            {results.map((r, i) => (
              <ResultRow key={i} result={r} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function ResultRow({ result }: { result: Result }) {
  const status: "ok" | "dup" | "none" =
    result.matched_lists === 0
      ? "none"
      : result.allocated === 0
        ? "dup"
        : "ok";
  const fg =
    status === "ok"
      ? "var(--teal)"
      : status === "dup"
        ? "var(--yellow)"
        : "var(--ink-faint)";
  const bg =
    status === "ok"
      ? "var(--teal-mute)"
      : status === "dup"
        ? "var(--yellow-mute)"
        : "var(--panel)";

  return (
    <div
      style={{
        background: "var(--panel-mute)",
        padding: "0.65rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        flexWrap: "wrap",
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-display text-ink truncate"
            style={{ fontSize: "0.96rem", fontWeight: 600 }}
          >
            {result.series_title}
          </span>
          <span className="font-mono tabular-nums text-ink-soft">
            #{result.issue_number}
          </span>
          {result.variant_label && (
            <span
              className="font-mono uppercase"
              style={{
                fontSize: "0.58rem",
                letterSpacing: "0.16em",
                fontWeight: 600,
                color: "var(--orange)",
                border: "1px solid rgba(255,122,0,0.35)",
                background: "var(--orange-mute)",
                padding: "1px 5px",
              }}
            >
              {result.variant_label}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: "0.78rem",
            color: fg,
            fontWeight: 600,
            padding: "2px 8px",
            background: bg,
            border: `1px solid ${fg}40`,
          }}
        >
          {result.allocated > 0
            ? `+${result.allocated} allocated`
            : result.matched_lists === 0
              ? "no pull list"
              : `${result.skipped_already_allocated} duplicates`}
        </span>
        {result.matched_lists > 0 && (
          <span
            className="font-mono uppercase text-ink-faint"
            style={{ fontSize: "0.6rem", letterSpacing: "0.16em", fontWeight: 600 }}
          >
            {result.matched_lists} match{result.matched_lists === 1 ? "" : "es"}
          </span>
        )}
      </div>
    </div>
  );
}

function KpiCell({
  k,
  v,
  sub,
  primary,
  tone,
}: {
  k: string;
  v: string;
  sub?: string;
  primary?: boolean;
  tone?: "warn" | "err" | "ok";
}) {
  const toneColor =
    tone === "warn"
      ? "var(--yellow)"
      : tone === "err"
        ? "var(--red)"
        : tone === "ok"
          ? "var(--teal)"
          : undefined;
  return (
    <div className="bg-panel-mute flex flex-col justify-between" style={{ padding: "0.85rem 1.1rem", minHeight: 92 }}>
      <div
        className="font-mono uppercase text-ink-faint"
        style={{ fontSize: "0.55rem", letterSpacing: "0.24em", fontWeight: 600 }}
      >
        {k}
      </div>
      <div
        className="font-display leading-none mt-2 truncate"
        style={{
          fontWeight: 700,
          fontSize: "clamp(1.25rem, 2.5vw, 1.85rem)",
          letterSpacing: "-0.01em",
          color: toneColor ?? (primary ? "var(--orange)" : "var(--ink)"),
        }}
      >
        {v}
      </div>
      {sub && (
        <div
          className="font-mono mt-2 truncate"
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.04em",
            color: toneColor ?? "var(--ink-soft)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Parser. Accepts comma-, tab-, or pipe-separated lines.             */
/*  Strips quotes, leading "#", and "Issue " prefixes.                 */
/* ------------------------------------------------------------------ */
function parsePaste(text: string): Row[] {
  const out: Row[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#") && !line.match(/^#\s*\d/)) {
      // Allow a leading "# comment" line; still skip if it starts with a
      // number (then it's an issue with no series — invalid anyway).
      continue;
    }
    // Split on tab, comma, or pipe (in that priority).
    let parts: string[];
    if (line.includes("\t")) parts = line.split("\t");
    else if (line.includes("|")) parts = line.split("|");
    else parts = line.split(",");

    parts = parts.map((p) => p.trim().replace(/^"|"$/g, ""));

    const series = parts[0];
    if (!series) continue;
    let issue = parts[1] ?? "";
    issue = issue.replace(/^#\s*/, "").replace(/^issue\s+/i, "");
    if (!issue) continue;
    const variant = parts[2] ?? "";

    out.push({
      series_title: series,
      issue_number: issue,
      variant_label: variant,
    });
  }
  return out;
}
