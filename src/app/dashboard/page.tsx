import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/types";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-400">Not authenticated. Please sign in.</p>
      </div>
    );
  }

  const staff = await prisma.posStaff.findFirst({
    where: { user_id: session.user.id, active: true },
  });

  if (!staff) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-400">No store found. Please contact support.</p>
      </div>
    );
  }

  const storeId = staff.store_id;
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [inventoryCount, customerCount, todayTradeIns, upcomingEvents, recentLedger] =
    await Promise.all([
      prisma.posInventoryItem.count({ where: { store_id: storeId } }),
      prisma.posCustomer.count({ where: { store_id: storeId } }),
      prisma.posLedgerEntry.count({
        where: { store_id: storeId, type: "trade_in", created_at: { gte: todayStart } },
      }),
      prisma.posEvent.count({
        where: { store_id: storeId, starts_at: { gte: new Date() } },
      }),
      prisma.posLedgerEntry.findMany({
        where: { store_id: storeId },
        orderBy: { created_at: "desc" },
        take: 10,
      }),
    ]);

  const stats = [
    { label: "Total Inventory Items", value: inventoryCount },
    { label: "Active Customers", value: customerCount },
    { label: "Today's Trade-Ins", value: todayTradeIns },
    { label: "Upcoming Events", value: upcomingEvents },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Welcome back</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Ledger Entries</h2>
        {recentLedger.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-zinc-400">No ledger entries yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-zinc-400">Description</th>
                  <th className="px-4 py-3 text-right text-zinc-400">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                {recentLedger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{entry.description ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-white">
                      {formatCents(entry.amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
