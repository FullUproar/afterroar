"use client";

import { useStore } from "@/lib/store-context";

export default function CashFlowPage() {
  const { can } = useStore();

  if (!can("cash_flow")) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-500">You don&apos;t have permission to view cash flow data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Cash Flow</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Money In Inventory</p>
          <p className="mt-2 text-3xl font-semibold text-white">—</p>
          <p className="mt-1 text-xs text-zinc-500">Total cost basis of all stock</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">This Week Revenue</p>
          <p className="mt-2 text-3xl font-semibold text-white">—</p>
          <p className="mt-1 text-xs text-zinc-500">Sales + event fees</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">This Week Payouts</p>
          <p className="mt-2 text-3xl font-semibold text-white">—</p>
          <p className="mt-1 text-xs text-zinc-500">Trade-in cash + credit issued</p>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center">
        <p className="text-lg font-medium text-zinc-400">Coming Soon</p>
        <p className="mt-2 text-sm text-zinc-500">
          Inventory velocity, margin by category, dead stock alerts, trade-in ROI,
          reorder intelligence
        </p>
      </div>
    </div>
  );
}
