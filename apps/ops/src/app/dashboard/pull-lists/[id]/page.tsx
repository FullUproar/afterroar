"use client";

/**
 * /dashboard/pull-lists/[id] — manage allocations for a single pull list.
 *
 * Shows the subscriber, the series, and every issue allocation
 * (pending → held → fulfilled). Operators move issues between states
 * here when:
 *   - Diamond/Lunar shipment arrives → mark "held" (sets a 90-day expiry)
 *   - Customer picks up → mark "fulfilled" (advances last_pickup_at)
 *   - Customer skips → mark "skipped"
 *
 * Pause / cancel the subscription up at the header. Cancellation is soft —
 * the row stays for history but new allocations stop.
 */

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";

type ItemStatus = "pending" | "held" | "fulfilled" | "skipped" | "expired";
type PullListStatus = "active" | "paused" | "cancelled";

interface PullListDetail {
  id: string;
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
  customer: { id: string; name: string; email: string | null; phone: string | null };
}

interface PullListItem {
  id: string;
  issue_number: string;
  variant_label: string | null;
  status: ItemStatus;
  notified_at: string | null;
  held_at: string | null;
  fulfilled_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  inventory_item: { id: string; name: string; quantity: number; price_cents: number } | null;
}

const ITEM_BADGE: Record<ItemStatus, { fg: string; bg: string; border: string; label: string }> = {
  pending: { fg: "var(--ink-soft)", bg: "var(--panel)", border: "var(--rule-hi)", label: "Pending" },
  held: { fg: "var(--yellow)", bg: "var(--yellow-mute)", border: "rgba(251,219,101,0.35)", label: "Held" },
  fulfilled: { fg: "var(--teal)", bg: "var(--teal-mute)", border: "rgba(94,176,155,0.30)", label: "Picked Up" },
  skipped: { fg: "var(--ink-faint)", bg: "var(--panel)", border: "var(--rule)", label: "Skipped" },
  expired: { fg: "var(--red)", bg: "var(--red-mute)", border: "rgba(214,90,90,0.35)", label: "Expired" },
};

export default function PullListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [detail, setDetail] = useState<PullListDetail | null>(null);
  const [items, setItems] = useState<PullListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ItemStatus | "all" | "open">("open");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, itemsRes] = await Promise.all([
        fetch(`/api/pull-lists?status=all`).then((r) => r.json()),
        fetch(`/api/pull-lists/${id}/items`).then((r) => r.json()),
      ]);
      const found = (listRes.pullLists ?? []).find((l: PullListDetail) => l.id === id);
      setDetail(found ?? null);
      setItems(itemsRes.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchList(updates: Partial<PullListDetail>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pull-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function patchItem(itemId: string, status: ItemStatus) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pull-lists/${id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteList() {
    if (!confirm("Cancel this pull list? It will be marked cancelled but kept for history.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pull-lists/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard/pull-lists");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full gap-4">
        <PageHeader title="Pull List" backHref="/dashboard/pull-lists" />
        <p
          className="font-mono uppercase text-ink-soft"
          style={{ fontSize: "0.7rem", letterSpacing: "0.18em", padding: "2rem 0", textAlign: "center" }}
        >
          Loading…
        </p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col h-full gap-4">
        <PageHeader title="Pull List" backHref="/dashboard/pull-lists" />
        <div className="ar-zone p-12 text-center">
          <p className="font-display text-ink" style={{ fontSize: "1.2rem" }}>
            Pull list not found.
          </p>
        </div>
      </div>
    );
  }

  const filteredItems = items.filter((it) => {
    if (filter === "all") return true;
    if (filter === "open") return it.status === "pending" || it.status === "held";
    return it.status === filter;
  });

  const counts = {
    pending: items.filter((i) => i.status === "pending").length,
    held: items.filter((i) => i.status === "held").length,
    fulfilled: items.filter((i) => i.status === "fulfilled").length,
    skipped: items.filter((i) => i.status === "skipped").length,
    expired: items.filter((i) => i.status === "expired").length,
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title={detail.series_title}
        crumb={`Console · Pull Lists · ${detail.customer.name}`}
        backHref="/dashboard/pull-lists"
        action={
          <div className="flex gap-2">
            {detail.status === "active" ? (
              <button
                type="button"
                onClick={() => patchList({ status: "paused" } as { status: PullListStatus })}
                disabled={saving}
                className="font-mono uppercase border px-3 disabled:opacity-30"
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  fontWeight: 600,
                  minHeight: 44,
                  color: "var(--yellow)",
                  borderColor: "rgba(251,219,101,0.35)",
                  background: "var(--yellow-mute)",
                }}
              >
                Pause
              </button>
            ) : detail.status === "paused" ? (
              <button
                type="button"
                onClick={() => patchList({ status: "active" } as { status: PullListStatus })}
                disabled={saving}
                className="font-mono uppercase border px-3 disabled:opacity-30"
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  fontWeight: 600,
                  minHeight: 44,
                  color: "var(--teal)",
                  borderColor: "rgba(94,176,155,0.30)",
                  background: "var(--teal-mute)",
                }}
              >
                Resume
              </button>
            ) : null}
            {detail.status !== "cancelled" && (
              <button
                type="button"
                onClick={deleteList}
                disabled={saving}
                className="font-mono uppercase border border-rule-hi text-ink-soft hover:text-red px-3 disabled:opacity-30"
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  fontWeight: 600,
                  minHeight: 44,
                  background: "var(--panel)",
                }}
              >
                Cancel List
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              disabled={detail.status === "cancelled"}
              className="font-display uppercase disabled:opacity-30"
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
              Add Issue
            </button>
          </div>
        }
      />

      {/* Subscriber + meta */}
      <section
        className="ar-zone"
        style={{ padding: "0.85rem 1.1rem", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}
      >
        <Meta label="Customer" value={detail.customer.name} />
        <Meta label="Email" value={detail.customer.email || "—"} />
        <Meta label="Phone" value={detail.customer.phone || "—"} />
        <Meta label="Publisher" value={detail.publisher || "—"} />
        <Meta label="Qty per Issue" value={`×${detail.qty_per_issue}`} />
        <Meta label="Variants" value={detail.wants_variants ? "Yes" : "No"} />
        <Meta
          label="Last Pickup"
          value={detail.last_pickup_at ? new Date(detail.last_pickup_at).toLocaleDateString() : "Never"}
        />
        <Meta
          label="Created"
          value={new Date(detail.created_at).toLocaleDateString()}
        />
        {detail.notes && (
          <div className="basis-full">
            <div
              className="font-mono uppercase text-ink-faint"
              style={{ fontSize: "0.55rem", letterSpacing: "0.24em", fontWeight: 600 }}
            >
              Notes
            </div>
            <p
              className="text-ink-soft mt-1"
              style={{ fontSize: "0.85rem", lineHeight: 1.5 }}
            >
              {detail.notes}
            </p>
          </div>
        )}
      </section>

      {/* Filter */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: "open" as const, label: "Open", count: counts.pending + counts.held },
          { key: "pending" as const, label: "Pending", count: counts.pending },
          { key: "held" as const, label: "Held", count: counts.held },
          { key: "fulfilled" as const, label: "Picked Up", count: counts.fulfilled },
          { key: "skipped" as const, label: "Skipped", count: counts.skipped },
          { key: "expired" as const, label: "Expired", count: counts.expired },
          { key: "all" as const, label: "All", count: items.length },
        ].map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="inline-flex items-center gap-2 font-mono uppercase transition-colors"
              style={{
                fontSize: "0.66rem",
                letterSpacing: "0.18em",
                fontWeight: 600,
                padding: "0.35rem 0.7rem",
                minHeight: 32,
                color: on ? "var(--orange)" : "var(--ink-soft)",
                border: `1px solid ${on ? "var(--orange)" : "var(--rule-hi)"}`,
                background: on ? "var(--orange-mute)" : "var(--panel)",
              }}
            >
              <span>{f.label}</span>
              <span
                className="tabular-nums"
                style={{ opacity: 0.75, fontSize: "0.6rem", letterSpacing: "0.04em" }}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

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

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="ar-zone p-8 text-center">
          <div
            className="font-mono uppercase text-ink-faint"
            style={{ fontSize: "0.62rem", letterSpacing: "0.28em", fontWeight: 600 }}
          >
            {items.length === 0 ? "No issues allocated yet" : "No issues match this filter"}
          </div>
          {items.length === 0 && detail.status !== "cancelled" && (
            <p className="font-display text-ink mt-3" style={{ fontSize: "1rem" }}>
              Allocations will appear here when new issues arrive (manually or via Diamond/Lunar ingest).
            </p>
          )}
        </div>
      ) : (
        <div
          className="flex flex-col"
          style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
        >
          {filteredItems.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              listCancelled={detail.status === "cancelled"}
              onAction={(s) => patchItem(it.id, s)}
              saving={saving}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddItemDialog
          listId={id}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ItemRow({
  item,
  listCancelled,
  onAction,
  saving,
}: {
  item: PullListItem;
  listCancelled: boolean;
  onAction: (status: ItemStatus) => void;
  saving: boolean;
}) {
  const badge = ITEM_BADGE[item.status];
  const expiringSoon =
    item.status === "held" &&
    item.expires_at &&
    new Date(item.expires_at).getTime() - Date.now() < 7 * 24 * 3600 * 1000;

  return (
    <div
      style={{
        background: "var(--panel-mute)",
        padding: "0.75rem 1rem",
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-display text-ink"
              style={{ fontSize: "0.96rem", fontWeight: 600 }}
            >
              {item.issue_number.startsWith("#") ? item.issue_number : `#${item.issue_number}`}
            </span>
            {item.variant_label && (
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
                {item.variant_label}
              </span>
            )}
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
            {expiringSoon && item.expires_at && (
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: "0.58rem",
                  letterSpacing: "0.14em",
                  color: "var(--red)",
                  fontWeight: 600,
                }}
              >
                Expires {new Date(item.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div
            className="mt-1 flex items-center gap-3 font-mono flex-wrap"
            style={{ fontSize: "0.66rem", color: "var(--ink-faint)", letterSpacing: "0.02em" }}
          >
            <span>Allocated {new Date(item.created_at).toLocaleDateString()}</span>
            {item.held_at && <span>Held {new Date(item.held_at).toLocaleDateString()}</span>}
            {item.fulfilled_at && (
              <span style={{ color: "var(--teal)" }}>
                Picked up {new Date(item.fulfilled_at).toLocaleDateString()}
              </span>
            )}
            {item.inventory_item && (
              <span style={{ color: "var(--ink-soft)" }}>
                Linked to {item.inventory_item.name}
              </span>
            )}
          </div>
          {item.notes && (
            <p
              className="mt-1 text-ink-soft"
              style={{ fontSize: "0.78rem", lineHeight: 1.4 }}
            >
              {item.notes}
            </p>
          )}
        </div>

        {!listCancelled && (
          <div className="flex gap-1.5 shrink-0 flex-wrap">
            {item.status === "pending" && (
              <ActionBtn label="Mark Held" tone="warn" onClick={() => onAction("held")} disabled={saving} />
            )}
            {(item.status === "pending" || item.status === "held") && (
              <ActionBtn label="Picked Up" tone="ok" onClick={() => onAction("fulfilled")} disabled={saving} />
            )}
            {item.status !== "skipped" && item.status !== "fulfilled" && item.status !== "expired" && (
              <ActionBtn label="Skip" onClick={() => onAction("skipped")} disabled={saving} />
            )}
            {(item.status === "skipped" || item.status === "expired") && (
              <ActionBtn label="Reopen" onClick={() => onAction("pending")} disabled={saving} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  tone?: "ok" | "warn";
  onClick: () => void;
  disabled?: boolean;
}) {
  const fg =
    tone === "ok" ? "var(--teal)" : tone === "warn" ? "var(--yellow)" : "var(--ink-soft)";
  const border =
    tone === "ok"
      ? "rgba(94,176,155,0.30)"
      : tone === "warn"
        ? "rgba(251,219,101,0.35)"
        : "var(--rule-hi)";
  const bg =
    tone === "ok"
      ? "var(--teal-mute)"
      : tone === "warn"
        ? "var(--yellow-mute)"
        : "var(--panel)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono uppercase border disabled:opacity-30"
      style={{
        fontSize: "0.62rem",
        letterSpacing: "0.16em",
        fontWeight: 600,
        padding: "0 0.7rem",
        minHeight: 32,
        color: fg,
        borderColor: border,
        background: bg,
      }}
    >
      {label}
    </button>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="font-mono uppercase text-ink-faint"
        style={{ fontSize: "0.55rem", letterSpacing: "0.24em", fontWeight: 600 }}
      >
        {label}
      </div>
      <div
        className="font-display text-ink mt-1"
        style={{ fontSize: "0.92rem", fontWeight: 500 }}
      >
        {value}
      </div>
    </div>
  );
}

function AddItemDialog({
  listId,
  onClose,
  onAdded,
}: {
  listId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [issueNumber, setIssueNumber] = useState("");
  const [variant, setVariant] = useState("");
  const [days, setDays] = useState(90);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!issueNumber.trim()) {
      setError("Issue number is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/pull-lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue_number: issueNumber.trim(),
          variant_label: variant.trim() || undefined,
          expires_in_days: days,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      onAdded();
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
          maxWidth: "28rem",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
          <h3 className="font-display" style={{ fontSize: "1rem", fontWeight: 800, color: "var(--cream)" }}>
            Add Issue
          </h3>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink text-xl">
            ×
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <FieldLabel label="Issue Number" required>
            <input
              autoFocus
              type="text"
              value={issueNumber}
              onChange={(e) => setIssueNumber(e.target.value)}
              placeholder="e.g. 47, 47B, Annual 2026"
              className="w-full font-body text-ink focus:outline-none"
              style={{
                background: "var(--panel-mute)",
                border: "1px solid var(--rule-hi)",
                fontSize: "0.92rem",
                padding: "0.55rem 0.85rem",
                minHeight: 44,
              }}
            />
          </FieldLabel>
          <FieldLabel label="Variant Label">
            <input
              type="text"
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              placeholder="e.g. Cover B, 1:25 ratio"
              className="w-full font-body text-ink focus:outline-none"
              style={{
                background: "var(--panel-mute)",
                border: "1px solid var(--rule-hi)",
                fontSize: "0.92rem",
                padding: "0.55rem 0.85rem",
                minHeight: 44,
              }}
            />
          </FieldLabel>
          <FieldLabel label="Hold For (days)">
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Math.max(1, parseInt(e.target.value || "90", 10)))}
              className="w-full font-body text-ink focus:outline-none tabular-nums"
              style={{
                background: "var(--panel-mute)",
                border: "1px solid var(--rule-hi)",
                fontSize: "0.92rem",
                padding: "0.55rem 0.85rem",
                minHeight: 44,
              }}
            />
          </FieldLabel>
          <FieldLabel label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full font-body text-ink focus:outline-none"
              style={{
                background: "var(--panel-mute)",
                border: "1px solid var(--rule-hi)",
                fontSize: "0.85rem",
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
            {saving ? "Adding…" : "Add"}
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
