"use client";

/**
 * Per-event ticket management + prize-pool inventory holds.
 *
 * Mounts inside the expanded row on /dashboard/events. Exposes:
 *   - Sell-ticket dialog (tier picker + customer-or-guest fields, capacity-aware)
 *   - Sold-ticket list (filterable by status, with refund + serial display)
 *   - Scan-to-redeem (paste/scan a serial, marks ticket redeemed + creates checkin)
 *   - Prize-pool inventory holds (reserve booster boxes / sealed product for the event)
 *
 * Server-side enforces capacity, idempotency, and refund rules. This UI is
 * intentionally thin — it surfaces affordances and trusts API responses.
 */

import { useCallback, useEffect, useState } from "react";
import { formatCents } from "@/lib/types";

interface Props {
  eventId: string;
}

interface TicketTier {
  id: string;
  name: string;
  price_cents: number;
  capacity: number | null;
  sold: number;
  active: boolean;
}

interface Ticket {
  id: string;
  serial: string;
  status: "sold" | "redeemed" | "refunded" | "cancelled";
  amount_paid_cents: number;
  guest_name: string | null;
  guest_email: string | null;
  sold_at: string;
  redeemed_at: string | null;
  tier: { id: string; name: string; price_cents: number };
  customer: { id: string; name: string; email: string | null } | null;
}

interface InventoryHold {
  id: string;
  quantity: number;
  reason: string | null;
  status: string;
  held_at: string;
  expires_at: string;
  item: { id: string; name: string; quantity: number; sku: string | null };
  staff: { id: string; name: string } | null;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface InventoryItemLite {
  id: string;
  name: string;
  quantity: number;
  sku: string | null;
}

export function TicketingPanel({ eventId }: Props) {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [holds, setHolds] = useState<InventoryHold[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "sold" | "redeemed" | "refunded">("sold");

  // Sell-ticket dialog state
  const [sellOpen, setSellOpen] = useState(false);

  // Scan-to-redeem state
  const [scanSerial, setScanSerial] = useState("");
  const [scanFeedback, setScanFeedback] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  // Add-to-prize-pool dialog state
  const [holdOpen, setHoldOpen] = useState(false);

  // Ticket viewer (QR display)
  const [viewTicket, setViewTicket] = useState<Ticket | null>(null);

  const loadTiers = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/tiers`);
    if (res.ok) {
      const data = await res.json();
      setTiers(Array.isArray(data) ? data : (data.tiers ?? []));
    }
  }, [eventId]);

  const loadTickets = useCallback(async () => {
    const url =
      statusFilter === "all"
        ? `/api/events/${eventId}/tickets`
        : `/api/events/${eventId}/tickets?status=${statusFilter}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setTickets(data.tickets ?? []);
    }
  }, [eventId, statusFilter]);

  const loadHolds = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/inventory-holds`);
    if (res.ok) {
      const data = await res.json();
      setHolds(data.holds ?? []);
    }
  }, [eventId]);

  useEffect(() => {
    void loadTiers();
    void loadTickets();
    void loadHolds();
  }, [loadTiers, loadTickets, loadHolds]);

  async function handleScan() {
    if (!scanSerial.trim() || scanning) return;
    setScanning(true);
    setScanFeedback(null);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(scanSerial.trim())}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) {
        setScanFeedback({ tone: "err", msg: data.error ?? `Failed (${res.status})` });
      } else if (data.already_redeemed) {
        setScanFeedback({
          tone: "ok",
          msg: `Already redeemed at ${new Date(data.ticket.redeemed_at).toLocaleTimeString()}`,
        });
      } else {
        setScanFeedback({
          tone: "ok",
          msg: `✓ Redeemed: ${data.ticket.tier?.name ?? "ticket"}${
            data.ticket.customer ? ` · ${data.ticket.customer.name}` : ""
          }`,
        });
        setScanSerial("");
        void loadTickets();
      }
    } finally {
      setScanning(false);
    }
  }

  async function handleRefund(ticketId: string) {
    if (!confirm("Refund this ticket? The seat reopens for resale.")) return;
    const res = await fetch(`/api/tickets/${ticketId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Manual refund from dashboard" }),
    });
    if (res.ok) {
      void loadTickets();
      void loadTiers();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Refund failed");
    }
  }

  async function releaseHold(holdId: string) {
    if (!confirm("Release this prize-pool hold back to general inventory?")) return;
    const res = await fetch(`/api/inventory/holds`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hold_id: holdId }),
    });
    if (res.ok) loadHolds();
  }

  return (
    <div className="space-y-3">
      {/* Header + tiers summary */}
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3
          className="font-mono uppercase text-ink-faint"
          style={{ fontSize: "0.62rem", letterSpacing: "0.28em", fontWeight: 600 }}
        >
          Tickets &amp; Prize Pool
        </h3>
        <div className="flex flex-wrap gap-3">
          {tiers.map((t) => (
            <span key={t.id} className="text-xs text-ink-soft">
              <span className="font-mono">{t.name}</span>{" "}
              <span className="text-ink-faint">
                {t.sold}
                {t.capacity ? `/${t.capacity}` : ""} · {formatCents(t.price_cents)}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSellOpen(true)}
          className="inline-flex items-center font-display uppercase"
          style={{
            fontSize: "0.74rem",
            letterSpacing: "0.06em",
            fontWeight: 700,
            padding: "0.4rem 0.875rem",
            color: "var(--void)",
            background: "var(--orange)",
            border: "1px solid var(--orange)",
          }}
          disabled={tiers.length === 0}
          title={tiers.length === 0 ? "Configure ticket tiers first" : ""}
        >
          Sell ticket
        </button>
        <button
          onClick={() => setHoldOpen(true)}
          className="inline-flex items-center font-display uppercase"
          style={{
            fontSize: "0.74rem",
            letterSpacing: "0.06em",
            fontWeight: 700,
            padding: "0.4rem 0.875rem",
            color: "var(--ink)",
            background: "transparent",
            border: "1px solid var(--rule)",
          }}
        >
          + Prize-pool hold
        </button>
        <div className="flex-1" />
        {/* Status filter */}
        <div className="flex gap-1">
          {(["sold", "redeemed", "refunded", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="font-mono uppercase"
              style={{
                fontSize: "0.66rem",
                letterSpacing: "0.1em",
                padding: "0.3rem 0.625rem",
                color: statusFilter === s ? "var(--void)" : "var(--ink-soft)",
                background: statusFilter === s ? "var(--orange)" : "transparent",
                border: `1px solid ${statusFilter === s ? "var(--orange)" : "var(--rule)"}`,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Scan-to-redeem strip */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Scan or type ticket serial (TKT-XXXX-XXXX)…"
          value={scanSerial}
          onChange={(e) => setScanSerial(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleScan();
          }}
          className="rounded-md border border-input-border bg-input-bg px-3 py-1.5 text-sm font-mono text-foreground focus:border-accent focus:outline-none flex-1 min-w-[18rem]"
        />
        <button
          onClick={handleScan}
          disabled={scanning || !scanSerial.trim()}
          className="font-mono uppercase disabled:opacity-30"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.1em",
            padding: "0.4rem 0.875rem",
            color: "var(--void)",
            background: "var(--teal)",
            border: "1px solid var(--teal)",
          }}
        >
          {scanning ? "…" : "Redeem"}
        </button>
        {scanFeedback && (
          <span
            className="text-xs"
            style={{ color: scanFeedback.tone === "ok" ? "var(--teal)" : "var(--red)" }}
          >
            {scanFeedback.msg}
          </span>
        )}
      </div>

      {/* Tickets list */}
      <div>
        <div
          className="font-mono uppercase text-ink-faint mb-2"
          style={{ fontSize: "0.62rem", letterSpacing: "0.18em", fontWeight: 600 }}
        >
          {statusFilter === "all" ? "All tickets" : `${statusFilter} tickets`} · {tickets.length}
        </div>
        {tickets.length === 0 ? (
          <p className="text-xs text-ink-faint">None.</p>
        ) : (
          <div className="grid gap-1 grid-cols-1 md:grid-cols-2">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-rule text-xs"
                style={{ background: "var(--panel-mute)" }}
              >
                <span
                  className="font-mono"
                  style={{ color: t.status === "sold" ? "var(--cream)" : t.status === "redeemed" ? "var(--teal)" : "var(--ink-faint)" }}
                >
                  {t.serial}
                </span>
                <span className="text-ink-soft truncate flex-1">
                  {t.tier?.name ?? "?"} · {t.customer?.name ?? t.guest_name ?? "guest"}
                </span>
                <span className="font-mono uppercase text-[10px] text-ink-faint">{t.status}</span>
                <button
                  onClick={() => setViewTicket(t)}
                  className="text-[10px] uppercase text-ink-soft hover:text-ink"
                  title="Show QR + printable ticket"
                >
                  View
                </button>
                {t.status === "sold" && (
                  <button
                    onClick={() => handleRefund(t.id)}
                    className="text-[10px] uppercase text-red-400 hover:text-red-300"
                  >
                    Refund
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prize pool holds */}
      <div>
        <div
          className="font-mono uppercase text-ink-faint mb-2"
          style={{ fontSize: "0.62rem", letterSpacing: "0.18em", fontWeight: 600 }}
        >
          Prize pool · {holds.filter((h) => h.status === "active").length} active
        </div>
        {holds.length === 0 ? (
          <p className="text-xs text-ink-faint">No holds yet.</p>
        ) : (
          <div className="space-y-1">
            {holds.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-rule text-xs"
                style={{ background: "var(--panel-mute)" }}
              >
                <span className="font-mono text-cream">{h.quantity}×</span>
                <span className="flex-1 truncate text-ink">{h.item.name}</span>
                <span className="font-mono uppercase text-[10px] text-ink-faint">{h.status}</span>
                {h.status === "active" && (
                  <button
                    onClick={() => releaseHold(h.id)}
                    className="text-[10px] uppercase text-red-400 hover:text-red-300"
                  >
                    Release
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {sellOpen && (
        <SellTicketModal
          eventId={eventId}
          tiers={tiers}
          onClose={() => setSellOpen(false)}
          onSuccess={() => {
            setSellOpen(false);
            void loadTickets();
            void loadTiers();
          }}
        />
      )}
      {holdOpen && (
        <PrizePoolHoldModal
          eventId={eventId}
          onClose={() => setHoldOpen(false)}
          onSuccess={() => {
            setHoldOpen(false);
            void loadHolds();
          }}
        />
      )}
      {viewTicket && <TicketViewerModal ticket={viewTicket} onClose={() => setViewTicket(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ticket viewer (QR + printable display)                             */
/* ------------------------------------------------------------------ */

function TicketViewerModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const qrUrl = `/api/tickets/${encodeURIComponent(ticket.serial)}/qr`;
  return (
    <ModalShell title={`Ticket · ${ticket.tier?.name ?? "Event"}`} onClose={onClose}>
      <div className="space-y-3 print:p-0">
        <div className="flex flex-col items-center bg-white rounded p-4">
          <img
            src={qrUrl}
            alt={`QR for ${ticket.serial}`}
            className="w-64 h-64"
            style={{ imageRendering: "pixelated" }}
          />
          <div className="font-mono text-lg font-bold text-black mt-2 tracking-widest">
            {ticket.serial}
          </div>
        </div>
        <div className="text-sm text-foreground space-y-1">
          <div>
            <span className="text-ink-faint">Holder:</span>{" "}
            {ticket.customer?.name ?? ticket.guest_name ?? "Guest"}
          </div>
          {(ticket.customer?.email || ticket.guest_email) && (
            <div>
              <span className="text-ink-faint">Email:</span>{" "}
              {ticket.customer?.email ?? ticket.guest_email}
            </div>
          )}
          <div>
            <span className="text-ink-faint">Tier:</span> {ticket.tier?.name}{" "}
            <span className="text-ink-faint">·</span>{" "}
            {formatCents(ticket.amount_paid_cents)}
          </div>
          <div>
            <span className="text-ink-faint">Status:</span>{" "}
            <span className="uppercase font-mono text-xs">{ticket.status}</span>
          </div>
          <div className="text-[11px] text-ink-faint pt-2 border-t border-rule">
            Sold {new Date(ticket.sold_at).toLocaleString()}
            {ticket.redeemed_at && ` · redeemed ${new Date(ticket.redeemed_at).toLocaleString()}`}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1 print:hidden">
          <button
            onClick={() => window.print()}
            className="font-mono uppercase text-xs px-3 py-1.5 border border-rule text-ink"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="font-mono uppercase text-xs px-3 py-1.5 border border-rule text-ink-soft"
          >
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Sell-ticket modal                                                  */
/* ------------------------------------------------------------------ */

function SellTicketModal({
  eventId,
  tiers,
  onClose,
  onSuccess,
}: {
  eventId: string;
  tiers: TicketTier[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tierId, setTierId] = useState(tiers.find((t) => t.active)?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerSearch.trim() || customer) {
      setCustomerResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(customerSearch.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerResults(Array.isArray(data) ? data.slice(0, 6) : []);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [customerSearch, customer]);

  async function handleSubmit() {
    if (!tierId) return;
    if (!customer && !guestName.trim() && !guestEmail.trim()) {
      setError("Pick a customer or enter at least guest name or email");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_tier_id: tierId,
          quantity,
          customer_id: customer?.id ?? null,
          guest_name: guestName.trim() || null,
          guest_email: guestEmail.trim() || null,
          client_tx_id: `ticket-${eventId}-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sell failed");
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Sell ticket" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-faint mb-1">Tier</label>
          <select
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            className="w-full rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
          >
            {tiers.map((t) => {
              const left = t.capacity != null ? t.capacity - t.sold : null;
              const disabled = !t.active || (left != null && left <= 0);
              return (
                <option key={t.id} value={t.id} disabled={disabled}>
                  {t.name} · {formatCents(t.price_cents)}
                  {left != null ? ` · ${left} left` : ""}
                  {disabled && left != null && left <= 0 ? " (sold out)" : ""}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-faint mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-24 rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-faint mb-1">Customer</label>
          {customer ? (
            <div className="flex items-center justify-between rounded border border-card-border bg-card px-2 py-1.5">
              <span className="text-sm text-foreground">{customer.name}</span>
              <button onClick={() => setCustomer(null)} className="text-xs text-ink-soft hover:text-ink">×</button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Search by name / email / phone…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
              />
              {customerResults.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5 max-h-32 overflow-y-auto rounded border border-card-border bg-card">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomer(c);
                        setCustomerSearch("");
                      }}
                      className="text-left px-2 py-1.5 text-sm hover:bg-card-hover"
                    >
                      {c.name}
                      <span className="text-ink-faint text-[10px] ml-1">
                        {[c.email, c.phone].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="text-[10px] uppercase tracking-wider text-ink-faint -mb-1">
          Or sell as a guest (no customer record)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Guest name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            disabled={!!customer}
            className="rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground disabled:opacity-40"
          />
          <input
            type="email"
            placeholder="Guest email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            disabled={!!customer}
            className="rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground disabled:opacity-40"
          />
        </div>

        {error && (
          <div className="text-xs" style={{ color: "var(--red)" }}>
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="font-mono uppercase text-xs px-3 py-1.5 border border-rule text-ink-soft">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !tierId}
            className="font-mono uppercase text-xs px-3 py-1.5 disabled:opacity-30"
            style={{ background: "var(--orange)", color: "var(--void)", border: "1px solid var(--orange)" }}
          >
            {submitting ? "Selling…" : `Sell ${quantity > 1 ? `${quantity} ` : ""}ticket${quantity > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Prize-pool hold modal                                              */
/* ------------------------------------------------------------------ */

function PrizePoolHoldModal({
  eventId,
  onClose,
  onSuccess,
}: {
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<InventoryItemLite[]>([]);
  const [picked, setPicked] = useState<InventoryItemLite | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!search.trim() || picked) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(search.trim())}`);
      if (res.ok) {
        const data = await res.json();
        const items = (data.items ?? data ?? []) as InventoryItemLite[];
        setResults(items.slice(0, 8));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, picked]);

  async function handleSubmit() {
    if (!picked) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/inventory-holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory_item_id: picked.id,
          quantity,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hold failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Reserve inventory for prize pool" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-faint mb-1">Item</label>
          {picked ? (
            <div className="flex items-center justify-between rounded border border-card-border bg-card px-2 py-1.5">
              <span className="text-sm text-foreground">
                {picked.name}{" "}
                <span className="text-ink-faint text-[10px]">qty {picked.quantity}</span>
              </span>
              <button onClick={() => setPicked(null)} className="text-xs text-ink-soft hover:text-ink">×</button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Search by name, sku, or barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
              />
              {results.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5 max-h-40 overflow-y-auto rounded border border-card-border bg-card">
                  {results.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setPicked(it)}
                      className="text-left px-2 py-1.5 text-sm hover:bg-card-hover"
                    >
                      {it.name}{" "}
                      <span className="text-ink-faint text-[10px]">
                        qty {it.quantity}
                        {it.sku ? ` · ${it.sku}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-faint mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            max={picked?.quantity ?? 1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-24 rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-faint mb-1">
            Reason (optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Top 4 prize, door prizes, etc."
            className="w-full rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
          />
        </div>

        {error && (
          <div className="text-xs" style={{ color: "var(--red)" }}>
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="font-mono uppercase text-xs px-3 py-1.5 border border-rule text-ink-soft">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!picked || submitting}
            className="font-mono uppercase text-xs px-3 py-1.5 disabled:opacity-30"
            style={{ background: "var(--orange)", color: "var(--void)", border: "1px solid var(--orange)" }}
          >
            {submitting ? "Reserving…" : "Reserve"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared modal shell                                                 */
/* ------------------------------------------------------------------ */

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
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
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--rule)",
          maxWidth: "32rem",
          width: "100%",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
          <h3
            className="font-display"
            style={{ fontSize: "1rem", fontWeight: 800, color: "var(--cream)" }}
          >
            {title}
          </h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-xl">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
