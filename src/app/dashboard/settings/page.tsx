"use client";

import { useStore } from "@/lib/store-context";

export default function SettingsPage() {
  const { can, store } = useStore();

  if (!can("store.settings")) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-500">You don&apos;t have permission to view settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Store Settings</h1>

      <div className="max-w-lg space-y-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-sm font-medium text-zinc-300">General</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Store Name</label>
              <input
                type="text"
                defaultValue={store?.name ?? ""}
                disabled
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Store Credit Bonus %</label>
              <input
                type="number"
                defaultValue={30}
                disabled
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center">
          <p className="text-sm font-medium text-zinc-400">More settings coming</p>
          <p className="mt-1 text-xs text-zinc-500">
            Payment integration (Stripe Connect), receipt customization,
            tax rates, e-commerce sync, hardware setup
          </p>
        </div>
      </div>
    </div>
  );
}
