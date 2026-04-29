"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface Toast {
  id: number;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextToastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string) => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext value={{ showToast }}>
      {children}
      {/*
        Toast container. Stacking context (do not regress without checking):
          z-40 mobile-nav, z-50 mobile-nav menu overlay, z-65/70 register
          modals, z-80 customer-display. Toasts MUST sit above all of these
          because "syncing..." applies regardless of which surface is open;
          a hidden-behind-modal toast is functionally a missing toast.
      */}
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-100 flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-slide-up rounded-xl bg-card border border-card-border px-5 py-3 text-sm font-medium text-foreground shadow-lg"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
