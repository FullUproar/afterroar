import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/ui/sub-nav";

const REPORTS_TABS = [
  { href: "/dashboard/reports", label: "Event ROI" },
  { href: "/dashboard/reports/sales", label: "Sales" },
  { href: "/dashboard/reports/margins", label: "Margins" },
  { href: "/dashboard/reports/inventory-health", label: "Inventory Health" },
  { href: "/dashboard/reports/channels", label: "Channels" },
  { href: "/dashboard/reports/staff", label: "Staff" },
];

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const sessionStoreId = (session as unknown as Record<string, unknown>).storeId as string | undefined;
  const staff = await prisma.posStaff.findFirst({
    where: {
      user_id: session.user.id,
      active: true,
      ...(sessionStoreId ? { store_id: sessionStoreId } : {}),
    },
  });
  if (!staff) return null;

  const events = await prisma.posEvent.findMany({
    where: { store_id: staff.store_id },
    orderBy: { starts_at: "desc" },
    include: {
      ledger_entries: { select: { amount_cents: true, type: true } },
      _count: { select: { checkins: true } },
    },
  });

  const results = events.map((event) => {
    const entry_fees = event.ledger_entries
      .filter((e) => e.type === "event_fee")
      .reduce((sum, e) => sum + e.amount_cents, 0);
    const tagged_sales = event.ledger_entries
      .filter((e) => e.type === "sale")
      .reduce((sum, e) => sum + e.amount_cents, 0);

    return {
      id: event.id,
      name: event.name,
      starts_at: event.starts_at,
      event_type: event.event_type,
      entry_fees,
      tagged_sales,
      total_revenue: entry_fees + tagged_sales,
      checkin_count: event._count.checkins,
    };
  });

  /* ---- KPI roll-ups ---- */
  const totalRevenue = results.reduce((s, r) => s + r.total_revenue, 0);
  const totalEntryFees = results.reduce((s, r) => s + r.entry_fees, 0);
  const totalTaggedSales = results.reduce((s, r) => s + r.tagged_sales, 0);
  const totalPlayers = results.reduce((s, r) => s + r.checkin_count, 0);
  const eventCount = results.length;

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Reports"
        crumb="Console · Reports"
        desc="Operator analytics across events, sales, margins, inventory, channels, and staff."
      />

      <SubNav items={REPORTS_TABS} />

      <div>
        <p
          className="font-mono uppercase font-semibold text-ink-faint mb-3"
          style={{ fontSize: "0.6rem", letterSpacing: "0.28em" }}
        >
          Event ROI · All-time
        </p>

        {/* KPI strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-rule border border-rule">
          <KpiCell k="Events" v={String(eventCount)} primary />
          <KpiCell k="Total Revenue" v={formatCents(totalRevenue)} />
          <KpiCell k="Entry Fees" v={formatCents(totalEntryFees)} />
          <KpiCell k="Players" v={String(totalPlayers)} sub={`${formatCents(totalTaggedSales)} tagged sales`} />
        </section>
      </div>

      {results.length === 0 ? (
        <div className="bg-panel-mute border border-rule p-8 text-center">
          <p className="text-ink-soft">No events yet.</p>
        </div>
      ) : (
        <>
          {/* Mobile / kiosk: row list */}
          <div className="md:hidden flex flex-col" style={{ background: "var(--rule)", border: "1px solid var(--rule)", gap: "1px" }}>
            {results.map((event) => (
              <div
                key={event.id}
                className="ar-lstripe bg-panel-mute hover:bg-panel transition-colors px-3 py-3"
                style={{ minHeight: 56 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-medium text-ink truncate">{event.name}</span>
                  <span className="font-mono font-semibold text-sm tabular-nums text-ink whitespace-nowrap">
                    {formatCents(event.total_revenue)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-ink-soft">
                  <span className="flex items-center gap-2">
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: "0.55rem",
                        letterSpacing: "0.18em",
                        padding: "1px 6px",
                        border: "1px solid var(--rule-hi)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {event.event_type}
                    </span>
                    <span className="font-mono tabular-nums">{event.checkin_count} players</span>
                  </span>
                  <span className="font-mono tabular-nums text-ink-faint">
                    {new Date(event.starts_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: operator-grade row table */}
          <div className="hidden md:block ar-zone">
            <div className="ar-zone-head">
              <span>Events · ROI · {eventCount}</span>
              <span className="font-mono text-ink-faint" style={{ fontSize: "0.62rem", letterSpacing: "0.18em" }}>
                Total · <span className="text-ink">{formatCents(totalRevenue)}</span>
              </span>
            </div>
            <div className="overflow-x-auto scroll-visible">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr
                    className="font-mono uppercase text-ink-faint"
                    style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
                  >
                    <th className="px-4 py-3 font-semibold border-b border-rule">Event</th>
                    <th className="px-4 py-3 font-semibold border-b border-rule">Date</th>
                    <th className="px-4 py-3 font-semibold border-b border-rule">Type</th>
                    <th className="px-4 py-3 font-semibold text-right border-b border-rule">Entry Fees</th>
                    <th className="px-4 py-3 font-semibold text-right border-b border-rule">Tagged Sales</th>
                    <th className="px-4 py-3 font-semibold text-right border-b border-rule">Total</th>
                    <th className="px-4 py-3 font-semibold text-right border-b border-rule">Players</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((event) => (
                    <tr
                      key={event.id}
                      className="ar-lstripe hover:bg-panel transition-colors"
                      style={{ borderBottom: "1px solid var(--rule-faint)" }}
                    >
                      <td className="px-4 py-3 font-display font-medium text-ink">{event.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-ink-soft">
                        {new Date(event.starts_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="font-mono uppercase inline-block"
                          style={{
                            fontSize: "0.55rem",
                            letterSpacing: "0.18em",
                            padding: "1px 6px",
                            border: "1px solid var(--rule-hi)",
                            color: "var(--ink-soft)",
                          }}
                        >
                          {event.event_type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-ink">
                        {formatCents(event.entry_fees)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-ink">
                        {formatCents(event.tagged_sales)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold tabular-nums text-teal">
                        {formatCents(event.total_revenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-soft">
                        {event.checkin_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function KpiCell({
  k,
  v,
  sub,
  primary,
}: {
  k: string;
  v: string;
  sub?: string;
  primary?: boolean;
}) {
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
          className={`font-display font-bold leading-none mt-2 ${primary ? "text-orange" : "text-ink"}`}
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
