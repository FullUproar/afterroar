"use client";

import { useStore } from "@/lib/store-context";

export default function StaffPage() {
  const { can } = useStore();

  if (!can("staff.manage")) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-500">You don&apos;t have permission to manage staff.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Staff</h1>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Invite Staff
        </button>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center">
        <p className="text-lg font-medium text-zinc-400">Coming Soon</p>
        <p className="mt-2 text-sm text-zinc-500">
          Invite staff by email, assign roles (owner/manager/cashier),
          manage permissions, view activity logs
        </p>
      </div>
    </div>
  );
}
