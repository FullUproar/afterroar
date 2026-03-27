"use client";

import { SessionProvider } from "next-auth/react";
import { StoreProvider } from "@/lib/store-context";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { TestPanel } from "@/components/test-panel";
import { NetworkStatusBar } from "@/components/network-status-bar";
import { OfflineProvider } from "@/components/offline-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { NotificationCenter } from "@/components/notification-center";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { ToastProvider } from "@/components/toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <StoreProvider>
        <ThemeProvider>
        <OfflineProvider>
        <ToastProvider>
          <div className="flex h-screen bg-background overflow-x-hidden max-w-[100vw]">
            <Sidebar />
            <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
              <div className="flex items-center gap-2 p-4 md:p-6 pb-0">
                <div className="flex-1 min-w-0">
                  <NetworkStatusBar />
                </div>
                <NotificationCenter />
              </div>
              <div className="p-4 md:p-6">{children}</div>
            </main>
            <MobileNav />
          </div>
          <TestPanel />
          <ShortcutsHelp />
        </ToastProvider>
        </OfflineProvider>
        </ThemeProvider>
      </StoreProvider>
    </SessionProvider>
  );
}
