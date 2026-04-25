"use client";

import React from "react";

/* ------------------------------------------------------------------ */
/*  MobileCard — Operator Console design language                     */
/*  Used by: trade-ins, events, inventory detail pages.               */
/*  1px hard rule, panel-mute fill, orange focus stripe on hover.     */
/* ------------------------------------------------------------------ */

interface MobileCardProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function MobileCard({ title, subtitle, right, onClick, children }: MobileCardProps) {
  const Wrapper = onClick ? "button" : "div";
  const interactive = !!onClick;

  return (
    <Wrapper
      onClick={onClick}
      className={`ar-lstripe flex w-full items-center gap-3 px-4 py-3.5 md:px-5 md:py-4 text-left transition-colors ${
        interactive ? "cursor-pointer" : ""
      }`}
      style={{
        background: "var(--panel-mute)",
        border: "1px solid var(--rule)",
        minHeight: "56px",
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="truncate text-sm md:text-base leading-snug"
          style={{ color: "var(--ink)", fontWeight: 600 }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            className="truncate mt-0.5 font-mono uppercase tracking-[0.14em]"
            style={{ fontSize: "0.68rem", color: "var(--ink-soft)" }}
          >
            {subtitle}
          </div>
        )}
        {children}
      </div>
      {right && <div className="shrink-0">{right}</div>}
      {interactive && (
        <span
          className="shrink-0 font-mono"
          style={{ color: "var(--ink-faint)", fontSize: "1rem" }}
          aria-hidden
        >
          &#x203A;
        </span>
      )}
    </Wrapper>
  );
}

/* ------------------------------------------------------------------ */
/*  StatusBadge (variant-based) — Operator Console outline style      */
/*  Variants:                                                         */
/*    success → teal (ok / valid / in-stock)                          */
/*    pending → yellow (earned / pending notice)                      */
/*    warning → yellow (notable but not error)                        */
/*    error   → red (stop / destructive / overdue)                    */
/*    info    → orange (active / live / brand workflow)               */
/*    special → orange (highlighted / featured)                       */
/*  Mono-caps, 1px hard border, no fill (kept transparent so it       */
/*  reads on any panel surface).                                      */
/* ------------------------------------------------------------------ */
type BadgeVariant = "success" | "pending" | "warning" | "error" | "info" | "special";

const BADGE_VAR_STYLE: Record<BadgeVariant, React.CSSProperties> = {
  success: { color: "var(--teal)", borderColor: "var(--teal)", background: "var(--teal-mute)" },
  pending: { color: "var(--yellow)", borderColor: "var(--yellow)", background: "var(--yellow-mute)" },
  warning: { color: "var(--yellow)", borderColor: "var(--yellow)", background: "var(--yellow-mute)" },
  error: { color: "var(--red)", borderColor: "var(--red)", background: "var(--red-mute)" },
  info: { color: "var(--orange)", borderColor: "var(--orange)", background: "var(--orange-mute-2)" },
  special: { color: "var(--orange)", borderColor: "var(--orange)", background: "var(--orange-mute-2)" },
};

interface StatusBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant = "info", children, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 font-mono uppercase tracking-[0.18em] whitespace-nowrap ${className}`}
      style={{
        ...BADGE_VAR_STYLE[variant],
        fontSize: "0.65rem",
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  );
}
