"use client";

import { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { StoreProvider } from "@/lib/store-context";
import { ModeProvider } from "@/lib/mode-context";
import { TrainingModeProvider, TrainingBanner } from "@/lib/training-mode";
import { OfflineProvider } from "@/components/offline-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { ToastProvider } from "@/components/toast";
import { DashboardLayoutInner } from "@/components/dashboard-layout-inner";
import { StaffLockGate } from "@/components/staff-lock-gate";
import { TrialBanner } from "@/components/trial-banner";
import { OnboardingPanel, OnboardingSandboxBanner } from "@/components/onboarding-panel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prevent hydration mismatch: all dashboard chrome depends on client-only
  // state (session, store context, localStorage). Server renders a loading
  // shell, client fills in everything after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <SessionProvider>
      <StoreProvider>
        <ModeProvider>
          <TrainingModeProvider>
          <ThemeProvider>
          <OfflineProvider>
          <ToastProvider>
            {!mounted ? (
              <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-muted text-sm">Loading...</div>
              </div>
            ) : (
              <StaffLockGate>
                <TrialBanner />
                <TrainingBanner />
                <OnboardingSandboxBanner />
                <DashboardLayoutInner>
                  {children}
                </DashboardLayoutInner>
                <OnboardingPanel />
                <ShortcutsHelp />
              </StaffLockGate>
            )}
          </ToastProvider>
          </OfflineProvider>
          </ThemeProvider>
          </TrainingModeProvider>
        </ModeProvider>
      </StoreProvider>
    </SessionProvider>
  );
}
