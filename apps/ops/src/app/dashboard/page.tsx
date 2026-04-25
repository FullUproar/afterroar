import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/types";
import Link from "next/link";
import { DashboardModeGuard } from "@/components/dashboard-mode-guard";
import { IntelligenceFeed } from "@/components/intelligence-feed";
import { StoreAdvisor } from "@/components/store-advisor";
import { DailyClose } from "@/components/daily-close";
import { StoreHealth } from "@/components/store-health";

export default async function DashboardPage() {
  let session;
  try {
    session = await auth();
  } catch {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted">Unable to load. The server may be temporarily unavailable.</p>
          <a href="/dashboard" className="text-xs text-accent hover:underline">Try again</a>
        </div>
      </div>
    );
  }

  if (!session?.user?.id) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted">Not authenticated. Please sign in.</p>
      </div>
    );
  }

  const sessionStoreId = (session as unknown as Record<string, unknown>).storeId as string | undefined;
  let staff;
  try {
    staff = await prisma.posStaff.findFirst({
      where: {
        user_id: session.user.id,
        active: true,
        ...(sessionStoreId ? { store_id: sessionStoreId } : {}),
      },
    });
  } catch {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted">Unable to load store data. Please try again.</p>
          <a href="/dashboard" className="text-xs text-accent hover:underline">Retry</a>
        </div>
      </div>
    );
  }

  if (!staff) {
    redirect("/setup");
  }

  const storeId = staff.store_id;
  const isCashier = staff.role === "cashier";

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [todaySales, todayRevenue, upcomingEvents, recentLedger, customersServedToday] =
    await Promise.all([
      prisma.posLedgerEntry.count({
        where: { store_id: storeId, type: "sale", created_at: { gte: todayStart } },
      }),
      prisma.posLedgerEntry.aggregate({
        where: { store_id: storeId, type: "sale", created_at: { gte: todayStart } },
        _sum: { amount_cents: true },
      }),
      prisma.posEvent.count({
        where: { store_id: storeId, starts_at: { gte: new Date() } },
      }),
      prisma.posLedgerEntry.findMany({
        where: { store_id: storeId },
        orderBy: { created_at: "desc" },
        take: 8,
      }),
      prisma.posLedgerEntry
        .findMany({
          where: { store_id: storeId, type: "sale", created_at: { gte: todayStart }, customer_id: { not: null } },
          select: { customer_id: true },
          distinct: ["customer_id"],
        })
        .then((rows) => rows.length)
        .catch(() => 0),
    ]);

  const todayRevenueCents = todayRevenue._sum.amount_cents || 0;
  const avgTicketCents = todaySales > 0 ? Math.round(todayRevenueCents / todaySales) : 0;
  const mobileLedger = recentLedger.slice(0, 5);

  // Greeting based on local hour
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (staff.name || "").split(" ")[0] || "there";
  const today = new Date();
  const dateStr = today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  if (isCashier) {
    return (
      <DashboardModeGuard>
        <div className="space-y-6">
          {/* Cashier greeting + shift summary */}
          <section>
            <p className="text-[0.6rem] tracking-[0.28em] uppercase text-ink-faint font-semibold mb-2 font-mono">
              Console · Your Shift
            </p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-ink leading-none">
              {greeting}, <span className="text-orange font-bold">{firstName}</span>.
            </h1>
            <p className="mt-2 text-sm text-ink-soft font-mono tracking-wide">
              {dateStr}
            </p>
          </section>

          {/* KPI strip */}
          <section className="grid grid-cols-2 gap-px bg-rule border border-rule">
            <KpiCell k="Revenue Today" v={formatCents(todayRevenueCents)} primary />
            <KpiCell k="Sales" v={String(todaySales)} />
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/dashboard/register"
              className="flex items-center gap-3 bg-orange text-void px-4 py-5 active:bg-yellow transition-colors"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.04em" }}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <rect x="2" y="6" width="20" height="13" /><path d="M2 11h20" />
              </svg>
              <div>
                <span className="text-base uppercase">Open Register</span>
                <span className="block text-xs opacity-70 normal-case font-mono tracking-wider">Start selling</span>
              </div>
            </Link>
            <Link
              href="/dashboard/trade-ins"
              className="flex items-center gap-3 border border-rule-hi bg-panel px-4 py-5 text-ink active:bg-panel-hi transition-colors"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.04em" }}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 12H5M12 5l-7 7 7 7M5 12h14M12 19l7-7-7-7" />
              </svg>
              <div>
                <span className="text-base uppercase">Trade-Ins</span>
                <span className="block text-xs text-ink-soft font-mono tracking-wider normal-case">Buy cards & games</span>
              </div>
            </Link>
          </div>

          <RecentActivity entries={recentLedger} compact />
        </div>
      </DashboardModeGuard>
    );
  }

  return (
    <DashboardModeGuard>
      <div className="flex flex-col gap-5">
        {/* Greeting hero — operator-console section header */}
        <section>
          <p className="text-[0.6rem] tracking-[0.28em] uppercase text-ink-faint font-semibold mb-2 font-mono">
            Console · Today's Operations
          </p>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-display font-semibold text-ink leading-none">
            {greeting}, <span className="text-orange font-bold">{firstName}</span>.
          </h1>
          <p className="mt-2 text-sm text-ink-soft font-mono tracking-wide">
            {dateStr} · {today.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </section>

        {/* KPI strip — operator dashboard read-out */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-rule border border-rule">
          <KpiCell k="Revenue Today" v={formatCents(todayRevenueCents)} primary />
          <KpiCell k="Sales" v={String(todaySales)} />
          <KpiCell k="Avg Ticket" v={formatCents(avgTicketCents)} />
          <KpiCell k="Customers" v={String(customersServedToday)} />
          <KpiCell k="Upcoming Events" v={String(upcomingEvents)} />
        </section>

        {/* Existing intelligence components — render in new color tokens */}
        <StoreHealth />
        <IntelligenceFeed compact />
        <StoreAdvisor />

        {/* Recent activity + Daily Close */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <p className="mb-2 text-[0.6rem] tracking-[0.28em] uppercase text-ink-faint font-semibold font-mono">
              Recent Activity
            </p>
            <RecentActivity entries={recentLedger} mobile={mobileLedger} />
          </div>
          <div>
            <DailyClose />
          </div>
        </div>
      </div>
    </DashboardModeGuard>
  );
}

/* ---------------------------------------------------------------- */

function KpiCell({ k, v, primary }: { k: string; v: string; primary?: boolean }) {
  return (
    <div className="bg-panel-mute p-3 md:p-4 min-h-22 flex flex-col justify-between">
      <div className="font-mono text-[0.55rem] md:text-[0.6rem] tracking-[0.24em] uppercase text-ink-faint font-semibold">
        {k}
      </div>
      <div
        className={`font-display font-bold leading-none mt-2 ${primary ? "text-orange" : "text-ink"}`}
        style={{ fontSize: "clamp(1.4rem, 3.5vw, 2rem)", letterSpacing: "-0.01em" }}
      >
        {v}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

interface LedgerEntry {
  id: string;
  type: string;
  amount_cents: number;
  description: string | null;
  created_at: Date;
}

function RecentActivity({
  entries,
  mobile,
  compact,
}: {
  entries: LedgerEntry[];
  mobile?: LedgerEntry[];
  compact?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="bg-panel-mute border border-rule p-8 text-center">
        <p className="text-ink-soft">No transactions yet. Open the register to make your first sale.</p>
      </div>
    );
  }

  const showMobile = mobile ?? entries.slice(0, 5);
  const isCompact = !!compact;

  return (
    <>
      {/* Mobile / kiosk: row list */}
      <div className={`${isCompact ? "" : "lg:hidden"} flex flex-col`} style={{ background: "var(--rule)", border: "1px solid var(--rule)", gap: "1px" }}>
        {showMobile.map((entry) => (
          <Row key={entry.id} entry={entry} />
        ))}
      </div>
      {/* Desktop: same row list (no need for table — operator-console reads as console log) */}
      {!isCompact && (
        <div className="hidden lg:flex flex-col" style={{ background: "var(--rule)", border: "1px solid var(--rule)", gap: "1px" }}>
          {entries.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </>
  );
}

function Row({ entry }: { entry: LedgerEntry }) {
  const isSale = entry.type === "sale";
  const time = new Date(entry.created_at);
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = time.toLocaleDateString([], { month: "short", day: "numeric" });
  const amountColor = isSale ? "var(--teal)" : entry.amount_cents < 0 ? "var(--red)" : "var(--ink)";

  return (
    <div
      className="grid items-center gap-3 px-3 py-2.5 bg-panel-mute hover:bg-panel transition-colors"
      style={{ gridTemplateColumns: "60px 22px 1fr auto", minHeight: 56 }}
    >
      <span className="font-mono text-[0.7rem] text-ink-faint tracking-wide">
        {timeStr}
        <span className="block text-[0.6rem] text-ink-ghost">{dateStr}</span>
      </span>
      <span
        className="flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          border: `1px solid ${isSale ? "rgba(94,176,155,0.35)" : "var(--rule-hi)"}`,
          background: isSale ? "var(--teal-mute)" : "transparent",
          color: isSale ? "var(--teal)" : "var(--ink-soft)",
        }}
        aria-hidden="true"
      >
        {isSale ? (
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 12l4 4L19 7" />
          </svg>
        ) : (
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M3 12h18" />
          </svg>
        )}
      </span>
      <div className="min-w-0">
        <div className="text-sm text-ink truncate font-medium">
          <span className="font-mono text-[0.62rem] text-orange uppercase tracking-[0.18em] mr-2">{entry.type}</span>
          {entry.description ?? "—"}
        </div>
      </div>
      <span className="font-mono font-semibold text-sm tabular-nums" style={{ color: amountColor }}>
        {formatCents(entry.amount_cents)}
      </span>
    </div>
  );
}
