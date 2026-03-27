"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  NotificationCenter — bell icon with dropdown notifications          */
/*  Generates alerts from live data: low stock, overdue checkouts,      */
/*  today's events, pending POs.                                        */
/* ------------------------------------------------------------------ */

interface Notification {
  id: string;
  type: "low_stock" | "overdue_checkout" | "event_today" | "po_pending";
  title: string;
  detail: string;
  href: string;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // Network error — silently ignore
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, []);

  // Fetch on first open
  useEffect(() => {
    if (open && !fetched) {
      fetchNotifications();
    }
  }, [open, fetched, fetchNotifications]);

  // Refresh every 5 minutes when open
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [open, fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const unreadCount = notifications.length;

  const typeIcon = (type: Notification["type"]) => {
    switch (type) {
      case "low_stock": return "▦";
      case "overdue_checkout": return "♜";
      case "event_today": return "★";
      case "po_pending": return "⊞";
    }
  };

  const typeColor = (type: Notification["type"]) => {
    switch (type) {
      case "low_stock": return "text-amber-400";
      case "overdue_checkout": return "text-red-400";
      case "event_today": return "text-blue-400";
      case "po_pending": return "text-emerald-400";
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Notifications"
      >
        {/* Bell icon */}
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            {fetched && (
              <button
                onClick={fetchNotifications}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Refresh
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-80">
            {loading && !fetched && (
              <div className="px-4 py-6 text-center text-sm text-zinc-500">Loading...</div>
            )}

            {fetched && notifications.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-zinc-500">
                All clear — no alerts right now.
              </div>
            )}

            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOpen(false);
                  router.push(n.href);
                }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-b-0"
              >
                <span className={`text-lg mt-0.5 shrink-0 ${typeColor(n.type)}`}>
                  {typeIcon(n.type)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{n.title}</div>
                  <div className="text-xs text-zinc-500 truncate">{n.detail}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
