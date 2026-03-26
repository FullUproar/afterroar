"use client";

import { SessionProvider } from "next-auth/react";
import { StoreProvider } from "@/lib/store-context";
import { Sidebar } from "@/components/sidebar";
import { TestPanel } from "@/components/test-panel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <StoreProvider>
        <div className="flex h-screen bg-zinc-950">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
        <TestPanel />
      </StoreProvider>
    </SessionProvider>
  );
}
