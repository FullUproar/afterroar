"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { StaffQuickSwitch } from "@/components/staff-quick-switch";

/* ------------------------------------------------------------------ */
/*  Quick-Switch Context                                               */
/*  Mounted once at the dashboard layout level. Any component can      */
/*  call useQuickSwitch().open() to surface the operator picker.       */
/*  Keeps the modal portal-free (no React.Portal) — the dashboard      */
/*  layout already covers the viewport, so a fixed-position overlay    */
/*  inside it is correct without needing to escape stacking contexts.  */
/* ------------------------------------------------------------------ */

interface QuickSwitchContextValue {
  open: () => void;
  close: () => void;
}

const QuickSwitchContext = createContext<QuickSwitchContextValue>({
  open: () => {},
  close: () => {},
});

export function QuickSwitchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <QuickSwitchContext.Provider value={{ open, close }}>
      {children}
      <StaffQuickSwitch open={isOpen} onClose={close} />
    </QuickSwitchContext.Provider>
  );
}

export function useQuickSwitch() {
  return useContext(QuickSwitchContext);
}
