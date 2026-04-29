"use client";

/**
 * /dashboard/pull-lists — comic shop pull-list management.
 *
 * "Pull list" = a customer subscription to a series. The shop reserves
 * each new issue for them when it arrives. Active pull lists determine
 * what to order from Diamond/Lunar each week.
 *
 * This page is the comic-shop-specific surface that helps the POS
 * compete with ComicHub on category depth. The data model lives in
 * PosPullList + PosPullListItem.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";

type PullListStatus = "active" | "paused" | "cancelled";

interface PullListSummary {
  id: string;
  customer_id: string;
  series_title: string;
  publisher: string | null;
  wants_variants: boolean;
  qty_per_issue: number;
  notes: string | null;
  status: PullListStatus;
  paused_at: string | null;
  cancelled_at: string | null;
  last_pickup_at: string | null;
  created_at: string;
  updated_at: string;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  items: Array<{
    id: string;
    issue_number: string;
    variant_label: string | null;
    status: "pending" | "held" | "fulfilled" | "skipped" | "expired";
    created_at: string;
    expires_at: string | null;
  }>;
  _count: { items: number };
}

interface CustomerLite {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

const STATUS_FILTERS: Array<{ key: PullListStatus | "all"; label: string }> = [
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

const STATUS_BADGE: Record<PullListStatus, { fg: string; bg: string; border: string; label: string }> = {
  active: { fg: "var(--teal)", bg: "var(--teal-mute)", border: "rgba(94,176,155,0.30)", label: "Active" },
  paused: { fg: "var(--yellow)", bg: "var(--yellow-mute)", border: "rgba(251,219,101,0.35)", label: "Paused" },
  cancelled: { fg: "var(--ink-faint)", bg: "var(--panel)", border: "var(--rule-hi)", label: "Cancelled" },
};

export default function PullListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<PullListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PullListStatus | "all">("active");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/pull-lists?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLists(data.pullLists ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const byStatus: Record<PullListStatus, number> = { active: 0, paused: 0, cancelled: 0 };
    let pendingItems = 0;
    let heldItems = 0;
    for (const l of lists) {
      byStatus[l.status]++;
      for (const it of l.items) {
        if (it.status === "pending") pendingItems++;
        if (it.status === "held") heldItems++;
      }
    }
    return { byStatus, pendingItems, heldItems, total: lists.length };
  }, [lists]);

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Pull Lists"
        crumb="Console · Comics"
        desc="Subscriber list per series. Allocations surface here as new issues arrive — drive the weekly Diamond/Lunar order, then call/text customers when their stack is ready."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/pull-lists/receive")}
              className="inline-flex items-center font-mono uppercase border px-3"
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                fontWeight: 600,
                minHeight: 48,
                color: "var(--ink-soft)",
                borderColor: "var(--rule-hi)",
                background: "var(--panel)",
              }}
            >
              Receive Comics
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center font-display uppercase"
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
              New Pull List
            </button>
          </div>
        }
      />

      {/* KPI strip */}
      <section
        className="grid grid-cols-2 md:grid-cols-4 gap-px"
        style={{ background: "var(--rule)", border: "1px solid var(--rule)" }}
      >
        <KpiCell k="Active Subscribers" v={counts.byStatus.active.toLocaleString()} primary />
        <KpiCell k="Paused" v={counts.byStatus.paused.toLocaleString()} tone={counts.byStatus.paused > 0 ? "warn" : undefined} />
        <KpiCell k="Issues Pending" v={counts.pendingItems.toLocaleString()} sub="Awaiting allocation" />
        <KpiCell k="Issues Held" v={counts.heldItems.toLocaleString()} sub={counts.heldItems > 0 ? "Notify pickup" : "—"} tone={counts.heldItems > 0 ? "warn" : undefined} />
      </section>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const on = statusFilter === f.key;
          const count =
            f.key === "all" ? counts.total : counts.byStatus[f.key as PullListStatus];
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className="inline-flex items-center gap-2 font-mono uppercase transition-colors"
              style={{
                fontSize: "0.66rem",
                letterSpacing: "0.18em",
                fontWeight: 600,
                padding: "0.45rem 0.8rem",
                minHeight: 36,
                color: on ? "var(--orange)" : "var(--ink-soft)",
                border: `1px solid ${on ? "var(--orange)" : "var(--rule-hi)"}`,
                background: on ? "var(--orange-mute)" : "var(--panel)",
              }}
            >
              <span>{f.label}</span>
              <span
                className="tabular-nums"
                style={{ opacity: 0.75, fontSize: "0.62rem", letterSpacing: "0.04em" }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Search by series title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full font-body text-ink placeholder:text-ink-faint focus:outline-none"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--rule-hi)",
            fontSize: "0.92rem",
            padding: "0.6rem 0.9rem",
            minHeight: 44,
          }}
        />
      </div>

      {/* List */}
      {loading ? (
        <p
          className="font-mono uppercase text-ink-soft"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.18em",
            padding: "2rem 0",
            textAlign: "center",
          }}
        >
          Loading pull lists…
        </p>
      ) : lists.length === 0 ? (
        <div className="ar-zone">
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div
              className="font-mono uppercase text-ink-faint"
              style={{ fontSize: "0.62rem", letterSpacing: "0.28em", fontWeight: 600 }}
            >
              {search ? "No matches" : statusFilter === "active" ? "No active pull lists" : `No ${statusFilter} lists`}
            </div>
            <p
              className="font-display text-ink"
              style={{ fontSize: "1.2rem", letterSpacing: "0.005em" }}
            >
              {search
                ? "Try a different series title."
                : "Set one up when a customer asks you to hold a book."}
            </p>
            {!search && statusFilter === "active" && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 inline-flex items-center font-display uppercase"
                style={{
                  fontSize: "0.85rem",
                  letterSpacing: "0.06em",
                  fontWeight: 700,
                  padding: "0.7rem 1.15rem",
                  minHeight: 48,
                  color: "var(--void)",
                  background: "var(--orange)",
                  border: "1px solid var(--orange)",
                }}
              >
                Create First Pull List
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col"
          style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
        >
          {lists.map((l) => (
            <PullListRow key={l.id} list={l} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePullListDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function PullListRow({ list }: { list: PullListSummary }) {
  const badge = STATUS_BADGE[list.status];
  const pending = list.items.filter((i) => i.status === "pending").length;
  const held = list.items.filter((i) => i.status === "held").length;

  return (
    <Link
      href={`/dashboard/pull-lists/${list.id}`}
      className="ar-lstripe block hover:bg-panel transition-colors"
      style={{
        background: "var(--panel-mute)",
        padding: "0.85rem 1rem",
        minHeight: 72,
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-display text-ink truncate"
              style={{ fontSize: "1rem", fontWeight: 600, letterSpacing: "0.005em" }}
            >
              {list.series_title}
            </span>
            <span
              className="inline-flex items-center font-mono"
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "2px 6px",
                border: `1px solid ${badge.border}`,
                background: badge.bg,
                color: badge.fg,
              }}
            >
              {badge.label}
            </span>
            {list.wants_variants && (
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
                Variants
              </span>
            )}
            {list.qty_per_issue > 1 && (
              <span
                className="font-mono uppercase tabular-nums"
                style={{
                  fontSize: "0.58rem",
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                  color: "var(--ink-soft)",
                  border: "1px solid var(--rule-hi)",
                  padding: "1px 5px",
                }}
              >
                ×{list.qty_per_issue}
              </span>
            )}
          </div>
          <div
            className="mt-1.5 flex items-center gap-3 font-mono flex-wrap"
            style={{ fontSize: "0.7rem", letterSpacing: "0.02em", color: "var(--ink-soft)" }}
          >
            <span className="truncate">
              <span className="text-ink-faint" style={{ marginRight: 6 }}>
                For
              </span>
              {list.customer.name}
            </span>
            {list.publisher && (
              <span className="truncate">
                <span className="text-ink-faint" style={{ marginRight: 6 }}>
                  Publisher
                </span>
                {list.publisher}
              </span>
            )}
            {list.last_pickup_at && (
              <span className="truncate">
                <span className="text-ink-faint" style={{ marginRight: 6 }}>
                  Last pickup
                </span>
                {new Date(list.last_pickup_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-3">
            {pending > 0 && (
              <span
                className="font-mono tabular-nums"
                style={{
                  fontSize: "0.7rem",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.04em",
                }}
                title="Pending issues"
              >
                {pending} pending
              </span>
            )}
            {held > 0 && (
              <span
                className="font-mono tabular-nums"
                style={{
                  fontSize: "0.7rem",
                  color: "var(--yellow)",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
                title="Held — ready for pickup"
              >
                {held} held
              </span>
            )}
          </div>
          <span
            className="font-mono uppercase text-ink-faint"
            style={{ fontSize: "0.55rem", letterSpacing: "0.18em", fontWeight: 600 }}
          >
            {list._count.items.toLocaleString()} all-time
          </span>
        </div>
      </div>
    </Link>
  );
}

function CreatePullListDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOptions, setCustomerOptions] = useState<CustomerLite[]>([]);
  const [picked, setPicked] = useState<CustomerLite | null>(null);
  const [series, setSeries] = useState("");
  const [publisher, setPublisher] = useState("");
  const [qty, setQty] = useState(1);
  const [wantsVariants, setWantsVariants] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Debounce customer search
  useEffect(() => {
    if (picked || !customerQuery.trim()) {
      setCustomerOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers?q=${encodeURIComponent(customerQuery.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          setCustomerOptions(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch {
        setCustomerOptions([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [customerQuery, picked]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!picked) {
      setError("Pick a customer first.");
      return;
    }
    if (!series.trim()) {
      setError("Series title is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/pull-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: picked.id,
          series_title: series.trim(),
          publisher: publisher.trim() || undefined,
          qty_per_issue: qty,
          wants_variants: wantsVariants,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--rule)",
          width: "100%",
          maxWidth: "32rem",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
          <h3
            className="font-display"
            style={{ fontSize: "1rem", fontWeight: 800, color: "var(--cream)" }}
          >
            New Pull List
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-soft hover:text-ink text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex flex-col gap-4">
          {/* Customer picker */}
          <FieldLabel label="Customer" required>
            {picked ? (
              <div
                className="flex items-center justify-between"
                style={{
                  background: "var(--orange-mute)",
                  border: "1px solid var(--orange)",
                  padding: "0.55rem 0.75rem",
                }}
              >
                <span className="text-ink truncate">
                  {picked.name}
                  {picked.email && (
                    <span className="text-ink-faint text-xs ml-2">{picked.email}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null);
                    setCustomerQuery("");
                  }}
                  className="font-mono uppercase text-ink-soft hover:text-orange"
                  style={{ fontSize: "0.6rem", letterSpacing: "0.16em", fontWeight: 600 }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  autoFocus
                  type="text"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search by name, email, or phone…"
                  className="w-full font-body text-ink focus:outline-none"
                  style={{
                    background: "var(--panel-mute)",
                    border: "1px solid var(--rule-hi)",
                    fontSize: "0.92rem",
                    padding: "0.6rem 0.85rem",
                    minHeight: 44,
                  }}
                />
                {customerOptions.length > 0 && (
                  <div
                    className="mt-1 flex flex-col"
                    style={{ border: "1px solid var(--rule)", maxHeight: 200, overflow: "auto" }}
                  >
                    {customerOptions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPicked(c)}
                        className="text-left px-3 py-2 hover:bg-panel-mute"
                        style={{ background: "var(--panel)" }}
                      >
                        <div className="text-sm text-ink">{c.name}</div>
                        <div
                          className="font-mono"
                          style={{ fontSize: "0.66rem", color: "var(--ink-faint)" }}
                        >
                          {c.email || c.phone || "no contact"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </FieldLabel>

          <FieldLabel label="Series Title" required>
            <input
              type="text"
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              placeholder='e.g. "Saga", "Batman (2016)"'
              className="w-full font-body text-ink focus:outline-none"
              style={{
                background: "var(--panel-mute)",
                border: "1px solid var(--rule-hi)",
                fontSize: "0.92rem",
                padding: "0.6rem 0.85rem",
                minHeight: 44,
              }}
            />
          </FieldLabel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FieldLabel label="Publisher">
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="e.g. Image, DC, Marvel"
                className="w-full font-body text-ink focus:outline-none"
                style={{
                  background: "var(--panel-mute)",
                  border: "1px solid var(--rule-hi)",
                  fontSize: "0.92rem",
                  padding: "0.6rem 0.85rem",
                  minHeight: 44,
                }}
              />
            </FieldLabel>
            <FieldLabel label="Qty per Issue">
              <input
                type="number"
                min={1}
                max={10}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="w-full font-body text-ink focus:outline-none tabular-nums"
                style={{
                  background: "var(--panel-mute)",
                  border: "1px solid var(--rule-hi)",
                  fontSize: "0.92rem",
                  padding: "0.6rem 0.85rem",
                  minHeight: 44,
                }}
              />
            </FieldLabel>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={wantsVariants}
              onChange={(e) => setWantsVariants(e.target.checked)}
            />
            <span className="text-sm text-ink-soft">Wants variants (covers B/C/etc.)</span>
          </label>

          <FieldLabel label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. only ratio variants 1:25+, hold up to 30 days"
              className="w-full font-body text-ink focus:outline-none"
              style={{
                background: "var(--panel-mute)",
                border: "1px solid var(--rule-hi)",
                fontSize: "0.88rem",
                padding: "0.55rem 0.85rem",
                resize: "vertical",
              }}
            />
          </FieldLabel>

          {error && (
            <p
              className="font-mono"
              style={{
                fontSize: "0.7rem",
                color: "var(--red)",
                background: "var(--red-mute)",
                border: "1px solid rgba(214,90,90,0.35)",
                padding: "0.55rem 0.75rem",
              }}
            >
              ! {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-rule">
          <button
            type="button"
            onClick={onClose}
            className="font-mono uppercase border border-rule-hi px-3 py-2 text-ink-soft hover:text-ink"
            style={{ fontSize: "0.7rem", letterSpacing: "0.18em", fontWeight: 600, minHeight: 40 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
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
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="font-mono uppercase text-ink-soft"
        style={{ fontSize: "0.6rem", letterSpacing: "0.22em", fontWeight: 600 }}
      >
        {label}
        {required ? <span className="text-orange ml-1">*</span> : null}
      </span>
      {children}
    </label>
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
