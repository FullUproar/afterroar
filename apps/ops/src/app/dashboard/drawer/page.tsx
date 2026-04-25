"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store-context";
import { formatCents, parseDollars } from "@/lib/types";
import { PageHeader } from "@/components/page-header";

interface DrawerSession {
  id: string;
  opened_at: string;
  opened_by: string;
  opening_amount_cents: number;
  sale_count: number;
  total_sales_cents: number;
  cash_sales_cents: number;
  card_sales_cents: number;
  credit_sales_cents: number;
  expected_cash_cents: number;
}

interface ZReport {
  opened_at: string;
  closed_at: string;
  opened_by: string;
  closed_by: string;
  opening_amount_cents: number;
  closing_amount_cents: number;
  expected_cash_cents: number;
  variance_cents: number;
  sale_count: number;
  total_sales_cents: number;
  cash_sales_cents: number;
  card_sales_cents: number;
  credit_sales_cents: number;
}

const DENOMINATIONS = [
  { label: "$100 bills", value: 10000 },
  { label: "$50 bills", value: 5000 },
  { label: "$20 bills", value: 2000 },
  { label: "$10 bills", value: 1000 },
  { label: "$5 bills", value: 500 },
  { label: "$1 bills", value: 100 },
  { label: "Quarters", value: 25 },
  { label: "Dimes", value: 10 },
  { label: "Nickels", value: 5 },
  { label: "Pennies", value: 1 },
];

/* ---------------------------------------------------------------- */
/*  Operator-Console KPI cell                                       */
/* ---------------------------------------------------------------- */
function KpiCell({
  k,
  v,
  sub,
  primary,
  accent,
}: {
  k: string;
  v: string;
  sub?: string;
  primary?: boolean;
  accent?: "teal" | "red" | "yellow";
}) {
  const accentClass =
    accent === "teal"
      ? "text-teal"
      : accent === "red"
        ? "text-red-fu"
        : accent === "yellow"
          ? "text-yellow"
          : primary
            ? "text-orange"
            : "text-ink";
  return (
    <div className="bg-panel-mute p-3 md:p-4 min-h-22 flex flex-col justify-between">
      <div
        className="font-mono uppercase text-ink-faint font-semibold"
        style={{ fontSize: "0.6rem", letterSpacing: "0.24em" }}
      >
        {k}
      </div>
      <div>
        <div
          className={`font-display font-bold leading-none mt-2 ${accentClass}`}
          style={{ fontSize: "clamp(1.4rem, 3.5vw, 2rem)", letterSpacing: "-0.01em" }}
        >
          {v}
        </div>
        {sub ? (
          <div
            className="font-mono text-ink-faint mt-1.5"
            style={{ fontSize: "0.62rem", letterSpacing: "0.04em" }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Data row used inside Z-Report and Open-drawer panels             */
/* ---------------------------------------------------------------- */
function DataRow({
  label,
  value,
  accent,
  bold,
}: {
  label: string;
  value: string;
  accent?: "teal" | "red" | "yellow" | "orange";
  bold?: boolean;
}) {
  const colorClass =
    accent === "teal"
      ? "text-teal"
      : accent === "red"
        ? "text-red-fu"
        : accent === "yellow"
          ? "text-yellow"
          : accent === "orange"
            ? "text-orange"
            : "text-ink";
  return (
    <div className="flex justify-between text-sm">
      <span className={bold ? "text-ink-soft font-medium" : "text-ink-soft"}>{label}</span>
      <span className={`font-mono tabular-nums ${bold ? "font-semibold" : "font-medium"} ${colorClass}`}>
        {value}
      </span>
    </div>
  );
}

export default function DrawerPage() {
  const { can } = useStore();
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [session, setSession] = useState<DrawerSession | null>(null);

  // Open drawer state
  const [openingAmount, setOpeningAmount] = useState("");
  const [opening, setOpening] = useState(false);

  // Close drawer state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [denomCounts, setDenomCounts] = useState<Record<string, string>>({});
  const [closeNotes, setCloseNotes] = useState("");
  const [blindClose, setBlindClose] = useState(true);
  const [closing, setClosing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Z-report state
  const [zReport, setZReport] = useState<ZReport | null>(null);

  const loadDrawer = useCallback(async () => {
    try {
      const res = await fetch("/api/drawer");
      if (res.ok) {
        const data = await res.json();
        setDrawerOpen(data.open);
        setSession(data.session);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrawer();
  }, [loadDrawer]);

  const countedTotal = DENOMINATIONS.reduce((sum, d) => {
    const count = parseInt(denomCounts[d.label] || "0", 10) || 0;
    return sum + count * d.value;
  }, 0);

  async function handleOpenDrawer() {
    if (opening) return;
    setOpening(true);
    try {
      const res = await fetch("/api/drawer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opening_amount_cents: parseDollars(openingAmount || "0"),
        }),
      });
      if (res.ok) {
        setOpeningAmount("");
        loadDrawer();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to open drawer");
      }
    } finally {
      setOpening(false);
    }
  }

  async function handleCloseDrawer() {
    if (closing) return;
    setClosing(true);
    try {
      const denominations: Record<string, number> = {};
      for (const d of DENOMINATIONS) {
        denominations[d.label] = parseInt(denomCounts[d.label] || "0", 10) || 0;
      }

      const res = await fetch("/api/drawer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closing_amount_cents: countedTotal,
          denominations,
          notes: closeNotes.trim() || null,
          blind_close: blindClose,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setZReport(data.z_report);
        setSubmitted(true);
        setDrawerOpen(false);
        setSession(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to close drawer");
      }
    } finally {
      setClosing(false);
    }
  }

  if (!can("checkout")) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-ink-soft">You don&apos;t have permission to manage the drawer.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <p className="text-ink-soft py-12 text-center font-mono uppercase tracking-wider" style={{ fontSize: "0.7rem" }}>
        Loading drawer status...
      </p>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Z-Report view after closing                                     */
  /* ---------------------------------------------------------------- */
  if (zReport) {
    const varianceAccent: "teal" | "yellow" | "red" =
      zReport.variance_cents === 0 ? "teal" : zReport.variance_cents > 0 ? "yellow" : "red";
    const varianceLabel =
      zReport.variance_cents > 0
        ? "(over)"
        : zReport.variance_cents < 0
          ? "(short)"
          : "(exact)";

    return (
      <div className="flex flex-col gap-4 max-w-2xl mx-auto">
        <PageHeader
          title="Z-Report"
          crumb="Console · Cash Drawer · Closed"
          desc="End-of-shift summary. Save or print before closing this view."
        />

        {/* KPI strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-rule border border-rule">
          <KpiCell k="Total Sales" v={formatCents(zReport.total_sales_cents)} primary sub={`${zReport.sale_count} txns`} />
          <KpiCell k="Cash Sales" v={formatCents(zReport.cash_sales_cents)} />
          <KpiCell k="Card Sales" v={formatCents(zReport.card_sales_cents)} />
          <KpiCell
            k="Variance"
            v={`${zReport.variance_cents >= 0 ? "+" : ""}${formatCents(zReport.variance_cents)}`}
            accent={varianceAccent}
            sub={varianceLabel}
          />
        </section>

        <div className="ar-zone">
          <div className="ar-zone-head">
            <span>Shift Detail</span>
            <span className="font-mono text-ink-faint normal-case" style={{ fontSize: "0.62rem", letterSpacing: "0.18em" }}>
              {new Date(zReport.opened_at).toLocaleDateString()}
            </span>
          </div>
          <div className="bg-panel-mute p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div
                  className="font-mono uppercase text-ink-faint font-semibold mb-1"
                  style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
                >
                  Opened By
                </div>
                <div className="text-ink font-medium">{zReport.opened_by}</div>
              </div>
              <div>
                <div
                  className="font-mono uppercase text-ink-faint font-semibold mb-1"
                  style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
                >
                  Closed By
                </div>
                <div className="text-ink font-medium">{zReport.closed_by}</div>
              </div>
              <div>
                <div
                  className="font-mono uppercase text-ink-faint font-semibold mb-1"
                  style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
                >
                  Opened At
                </div>
                <div className="text-ink font-mono text-xs">{new Date(zReport.opened_at).toLocaleString()}</div>
              </div>
              <div>
                <div
                  className="font-mono uppercase text-ink-faint font-semibold mb-1"
                  style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
                >
                  Closed At
                </div>
                <div className="text-ink font-mono text-xs">{new Date(zReport.closed_at).toLocaleString()}</div>
              </div>
            </div>

            <div className="border-t border-rule pt-4 space-y-2">
              <h3
                className="font-mono uppercase text-ink-soft font-semibold mb-2"
                style={{ fontSize: "0.62rem", letterSpacing: "0.24em" }}
              >
                Sales Summary
              </h3>
              <DataRow label={`Total Sales (${zReport.sale_count} transactions)`} value={formatCents(zReport.total_sales_cents)} bold />
              <DataRow label="Cash Sales" value={formatCents(zReport.cash_sales_cents)} />
              <DataRow label="Card Sales" value={formatCents(zReport.card_sales_cents)} />
              <DataRow label="Store Credit Sales" value={formatCents(zReport.credit_sales_cents)} />
            </div>

            <div className="border-t border-rule pt-4 space-y-2">
              <h3
                className="font-mono uppercase text-ink-soft font-semibold mb-2"
                style={{ fontSize: "0.62rem", letterSpacing: "0.24em" }}
              >
                Cash Drawer
              </h3>
              <DataRow label="Opening Amount" value={formatCents(zReport.opening_amount_cents)} />
              <DataRow label="Expected Cash" value={formatCents(zReport.expected_cash_cents)} />
              <DataRow label="Actual Cash Counted" value={formatCents(zReport.closing_amount_cents)} />
              <DataRow
                label="Variance"
                value={`${zReport.variance_cents >= 0 ? "+" : ""}${formatCents(zReport.variance_cents)} ${varianceLabel}`}
                accent={varianceAccent}
                bold
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setZReport(null);
            loadDrawer();
          }}
          className="w-full bg-orange text-void font-display font-bold uppercase transition-colors active:bg-yellow hover:opacity-90"
          style={{
            minHeight: 56,
            letterSpacing: "0.08em",
            fontSize: "0.95rem",
          }}
        >
          Done
        </button>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Drawer NOT open                                                 */
  /* ---------------------------------------------------------------- */
  if (!drawerOpen) {
    return (
      <div className="flex flex-col gap-4 max-w-lg mx-auto">
        <PageHeader
          title="Cash Drawer"
          crumb="Console · Cash Drawer"
          desc="No drawer is currently open. Set the opening float and start the shift."
        />

        <div className="ar-zone">
          <div className="ar-zone-head">
            <span>Status · Closed</span>
            <span className="ar-led" style={{ textTransform: "uppercase" }}>
              <span className="ar-led-dot" style={{ background: "var(--ink-faint)", boxShadow: "none" }} />
              <span style={{ color: "var(--ink-faint)" }}>Idle</span>
            </span>
          </div>
          <div className="bg-panel-mute p-6 space-y-5">
            <div className="text-center py-4">
              <div className="text-4xl mb-2 text-ink-faint" aria-hidden="true">▣</div>
              <p className="text-ink-soft">No drawer is currently open.</p>
            </div>

            <div>
              <label
                className="block font-mono uppercase text-ink-faint font-semibold mb-2"
                style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
              >
                Opening Cash Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft font-mono">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-panel text-ink font-mono tabular-nums placeholder:text-ink-ghost focus:outline-none"
                  style={{
                    border: "1px solid var(--rule-hi)",
                    paddingLeft: "1.75rem",
                    paddingRight: "1rem",
                    paddingTop: "0.7rem",
                    paddingBottom: "0.7rem",
                    minHeight: 48,
                    fontSize: "1rem",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--orange)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--rule-hi)")}
                />
              </div>
            </div>

            <button
              onClick={handleOpenDrawer}
              disabled={opening}
              className="w-full bg-orange text-void font-display font-bold uppercase transition-colors active:bg-yellow hover:opacity-90 disabled:opacity-50"
              style={{
                minHeight: 56,
                letterSpacing: "0.08em",
                fontSize: "0.95rem",
              }}
            >
              {opening ? "Opening..." : "Open Drawer"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Drawer IS open                                                  */
  /* ---------------------------------------------------------------- */
  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <PageHeader
        title="Cash Drawer"
        crumb="Console · Cash Drawer · Open"
        desc="Active shift. Close the drawer to finalize and run a Z-Report."
        action={
          <span className="ar-led" aria-label="Drawer open">
            <span className="ar-led-dot" />
            <span>Open</span>
          </span>
        }
      />

      {/* KPI strip */}
      {session && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-rule border border-rule">
          <KpiCell k="Sales" v={String(session.sale_count)} primary sub="this shift" />
          <KpiCell k="Cash" v={formatCents(session.cash_sales_cents)} />
          <KpiCell k="Card" v={formatCents(session.card_sales_cents)} />
          <KpiCell k="Credit" v={formatCents(session.credit_sales_cents)} />
        </section>
      )}

      {session && (
        <div className="ar-zone">
          <div className="ar-zone-head">
            <span>Shift · {session.opened_by}</span>
            <span className="font-mono text-ink-faint normal-case" style={{ fontSize: "0.62rem", letterSpacing: "0.18em" }}>
              Opened {new Date(session.opened_at).toLocaleString()}
            </span>
          </div>
          <div className="bg-panel-mute p-5 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div
                  className="font-mono uppercase text-ink-faint font-semibold mb-1"
                  style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
                >
                  Opening Amount
                </div>
                <div className="text-ink font-mono tabular-nums">{formatCents(session.opening_amount_cents)}</div>
              </div>
              <div>
                <div
                  className="font-mono uppercase text-ink-faint font-semibold mb-1"
                  style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
                >
                  Expected Cash
                </div>
                <div className="text-ink font-mono tabular-nums">{formatCents(session.expected_cash_cents)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setShowCloseModal(true);
          setDenomCounts({});
          setCloseNotes("");
          setBlindClose(true);
          setSubmitted(false);
        }}
        className="w-full bg-[var(--red-mute)] text-red-fu font-display font-bold uppercase transition-colors hover:bg-red-fu hover:text-void"
        style={{
          minHeight: 56,
          letterSpacing: "0.08em",
          fontSize: "0.95rem",
          border: "1px solid var(--red)",
        }}
      >
        Close Drawer
      </button>

      {/* Close Drawer Modal */}
      {showCloseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-bg"
          onClick={() => setShowCloseModal(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowCloseModal(false)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-panel-mute border border-rule shadow-2xl mx-4 scroll-visible"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="ar-zone-head flex items-center justify-between"
              style={{ position: "sticky", top: 0, zIndex: 1 }}
            >
              <span>Count the Drawer</span>
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex items-center justify-center text-ink-soft hover:text-ink active:bg-panel transition-colors"
                style={{
                  width: 44,
                  height: 44,
                  fontSize: "1.25rem",
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <label
                className="flex items-center gap-2 text-sm text-ink-soft mb-4"
                style={{ minHeight: 44 }}
              >
                <input
                  type="checkbox"
                  checked={blindClose}
                  onChange={(e) => setBlindClose(e.target.checked)}
                  className="bg-panel"
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: "var(--orange)",
                  }}
                />
                Blind close (hide expected amount until submitted)
              </label>

              <div className="space-y-2 mb-4">
                {DENOMINATIONS.map((d) => (
                  <div key={d.label} className="flex items-center justify-between gap-3">
                    <label className="text-sm text-ink w-28">{d.label}</label>
                    <input
                      type="number"
                      min={0}
                      value={denomCounts[d.label] || ""}
                      onChange={(e) =>
                        setDenomCounts({ ...denomCounts, [d.label]: e.target.value })
                      }
                      placeholder="0"
                      className="bg-panel text-ink font-mono tabular-nums text-center focus:outline-none"
                      style={{
                        border: "1px solid var(--rule-hi)",
                        width: 80,
                        minHeight: 44,
                        padding: "0.4rem 0.5rem",
                        fontSize: "0.92rem",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--orange)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--rule-hi)")}
                    />
                    <span className="text-sm text-ink-soft font-mono tabular-nums w-20 text-right">
                      {formatCents(
                        (parseInt(denomCounts[d.label] || "0", 10) || 0) * d.value
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-slate border border-rule p-4 mb-4 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span
                    className="font-mono uppercase text-ink-soft font-semibold"
                    style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
                  >
                    Total Counted
                  </span>
                  <span className="text-ink font-display font-bold tabular-nums" style={{ fontSize: "1.4rem" }}>
                    {formatCents(countedTotal)}
                  </span>
                </div>
                {!blindClose && session && (
                  <>
                    <DataRow label="Expected Cash" value={formatCents(session.expected_cash_cents)} />
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-ink-soft">Variance</span>
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          countedTotal - session.expected_cash_cents === 0
                            ? "text-teal"
                            : countedTotal - session.expected_cash_cents > 0
                              ? "text-yellow"
                              : "text-red-fu"
                        }`}
                      >
                        {countedTotal - session.expected_cash_cents >= 0 ? "+" : ""}
                        {formatCents(countedTotal - session.expected_cash_cents)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="mb-4">
                <label
                  className="block font-mono uppercase text-ink-faint font-semibold mb-2"
                  style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
                >
                  Notes (optional)
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-panel text-ink placeholder:text-ink-ghost focus:outline-none resize-none"
                  style={{
                    border: "1px solid var(--rule-hi)",
                    padding: "0.7rem 0.85rem",
                    fontSize: "0.92rem",
                  }}
                  placeholder="Any notes about the drawer count..."
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--orange)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--rule-hi)")}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 bg-panel text-ink-soft font-display font-semibold uppercase hover:bg-panel-hi hover:text-ink transition-colors"
                  style={{
                    border: "1px solid var(--rule-hi)",
                    minHeight: 48,
                    letterSpacing: "0.08em",
                    fontSize: "0.85rem",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseDrawer}
                  disabled={closing}
                  className="flex-1 bg-red-fu text-void font-display font-bold uppercase hover:opacity-90 disabled:opacity-50 transition-opacity"
                  style={{
                    minHeight: 48,
                    letterSpacing: "0.08em",
                    fontSize: "0.85rem",
                  }}
                >
                  {closing ? "Closing..." : "Submit & Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
