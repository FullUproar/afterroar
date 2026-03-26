"use client";

import { SessionProvider } from "next-auth/react";
import { StoreProvider } from "@/lib/store-context";
import { Sidebar } from "@/components/sidebar";
import { TestPanel } from "@/components/test-panel";
import { NetworkStatusBar } from "@/components/network-status-bar";
import { OfflineProvider } from "@/components/offline-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <StoreProvider>
        <OfflineProvider>
          <div className="flex h-screen bg-zinc-950">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <div className="p-6 pb-0">
                <NetworkStatusBar />
              </div>
              <div className="p-6">{children}</div>
            </main>
          </div>
          <TestPanel />
        </OfflineProvider>
      </StoreProvider>
    </SessionProvider>
  );
}
