"use client";

import { SessionProvider } from "next-auth/react";
import { StoreProvider } from "@/lib/store-context";
import { ModeProvider } from "@/lib/mode-context";
import { OfflineProvider } from "@/components/offline-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { ToastProvider } from "@/components/toast";
import { DashboardLayoutInner } from "@/components/dashboard-layout-inner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <StoreProvider>
        <ModeProvider>
          <ThemeProvider>
          <OfflineProvider>
          <ToastProvider>
            <DashboardLayoutInner>
              {children}
            </DashboardLayoutInner>
            <ShortcutsHelp />
          </ToastProvider>
          </OfflineProvider>
          </ThemeProvider>
        </ModeProvider>
      </StoreProvider>
    </SessionProvider>
  );
}
