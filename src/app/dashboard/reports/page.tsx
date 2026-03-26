import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/types";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const staff = await prisma.posStaff.findFirst({
    where: { user_id: session.user.id, active: true },
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

  return (
    <div className="space-y-6">
      <h1 className="hidden md:block text-2xl font-bold text-white">Event ROI</h1>

      {results.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">No events yet.</p>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {results.map((event) => (
              <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 min-h-11">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white truncate mr-2">{event.name}</span>
                  <span className="text-sm font-medium text-white whitespace-nowrap">{formatCents(event.total_revenue)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">{event.event_type}</span>
                    <span className="ml-2">{event.checkin_count} players</span>
                  </span>
                  <span>{new Date(event.starts_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-zinc-400">Event</th>
                  <th className="px-4 py-3 text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-right text-zinc-400">Entry Fees</th>
                  <th className="px-4 py-3 text-right text-zinc-400">Tagged Sales</th>
                  <th className="px-4 py-3 text-right text-zinc-400">Total</th>
                  <th className="px-4 py-3 text-right text-zinc-400">Players</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {results.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 font-medium text-white">{event.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                      {new Date(event.starts_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                        {event.event_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-white">
                      {formatCents(event.entry_fees)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-white">
                      {formatCents(event.tagged_sales)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-white">
                      {formatCents(event.total_revenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">{event.checkin_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
