"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useStore } from "@/lib/store-context";
import { useMode } from "@/lib/mode-context";
import { NAV_ITEMS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { store, staff, effectiveRole, isTestMode, can } = useStore();
  const { mode, setMode } = useMode();

  function handleSignOut() {
    signOut({ callbackUrl: "/login" });
  }

  const visibleNav = NAV_ITEMS.filter((item) => can(item.permission));

  // Hide sidebar in register mode
  if (mode === "register") return null;

  return (
    <aside className="hidden md:flex h-screen w-56 flex-col border-r border-card-border bg-card">
      <div className="border-b border-card-border px-4 py-4">
        <h1 className="text-lg font-bold text-foreground">Afterroar</h1>
        {store && (
          <p className="truncate text-xs text-muted">{store.name}</p>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {visibleNav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-card-hover text-foreground font-medium border-l-2 border-accent"
                  : "text-muted hover:bg-card-hover hover:text-foreground border-l-2 border-transparent"
              )}
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-card-border px-4 py-3">
        {staff && (
          <p className="truncate text-xs text-muted">
            {staff.name} &middot;{" "}
            <span className={isTestMode ? "text-purple-400" : ""}>
              {effectiveRole}
            </span>
            {isTestMode && (
              <span className="ml-1 text-purple-500">(test)</span>
            )}
          </p>
        )}
        <button
          onClick={handleSignOut}
          className="mt-2 text-xs text-muted hover:text-foreground transition-colors"
        >
          Sign out
        </button>
        <button
          onClick={() => setMode("register")}
          className="mt-2 w-full rounded-md border border-card-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors"
        >
          Register Mode
        </button>
      </div>
    </aside>
  );
}
