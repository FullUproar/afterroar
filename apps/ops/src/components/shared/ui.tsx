"use client";

import React from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Shared UI Components — Operator Console design language           */
/*  Single source of truth for common UI patterns across Store Ops.   */
/*  Used by: dashboard, fulfillment, orders, events, staff, reports,  */
/*  customers, inventory, and all detail pages.                       */
/*                                                                    */
/*  Color discipline:                                                 */
/*    ORANGE = active · primary · brand                               */
/*    YELLOW = noteworthy · pending · earned                          */
/*    TEAL   = success · ok · valid · in-stock                        */
/*    RED    = error · destructive · overdue · out-of-stock           */
/*  Color is never alone — always paired with shape + text.           */
/* ------------------------------------------------------------------ */

/* ---- StatusBadge ----
 *
 * Operator-console badge: 1px solid border, no fill, mono-caps label.
 * Token map:
 *   teal   → success/active/in-stock/fulfilled/delivered/completed/open
 *   yellow → pending/processing/picking/unfulfilled/packed
 *   orange → live/in-progress/shipped (active workflow movement)
 *   red    → cancelled/inactive/closed/error
 *   neutral→ draft/paused
 */

type StatusKind = "teal" | "yellow" | "orange" | "red" | "neutral";

const STATUS_KIND_MAP: Record<string, StatusKind> = {
  // teal — settled positive states
  active: "teal",
  open: "teal",
  available: "teal",
  in_stock: "teal",
  completed: "teal",
  delivered: "teal",
  fulfilled: "teal",

  // yellow — earned/pending/notice
  pending: "yellow",
  processing: "yellow",
  picking: "yellow",
  unfulfilled: "yellow",
  packed: "yellow",

  // orange — active in-progress / brand workflow
  shipped: "orange",
  in_progress: "orange",
  live: "orange",

  // red — error/cancelled
  cancelled: "red",
  canceled: "red",
  inactive: "red",
  closed: "red",
  failed: "red",
  refunded: "red",

  // neutral — draft / paused
  draft: "neutral",
  paused: "neutral",
};

const STATUS_KIND_STYLE: Record<StatusKind, React.CSSProperties> = {
  teal: { color: "var(--teal)", borderColor: "var(--teal)", background: "var(--teal-mute)" },
  yellow: { color: "var(--yellow)", borderColor: "var(--yellow)", background: "var(--yellow-mute)" },
  orange: { color: "var(--orange)", borderColor: "var(--orange)", background: "var(--orange-mute-2)" },
  red: { color: "var(--red)", borderColor: "var(--red)", background: "var(--red-mute)" },
  neutral: { color: "var(--ink-soft)", borderColor: "var(--rule-hi)", background: "var(--panel-mute)" },
};

const BADGE_SIZE_CLASSES = {
  xs: "text-[10px] px-1.5 py-0 leading-4",
  sm: "text-[11px] px-2 py-0.5 leading-4",
  md: "text-xs px-2.5 py-1",
};

// Public alias — STATUS_COLORS retained for any consumer that imported it.
const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.keys(STATUS_KIND_MAP).map((k) => [k, STATUS_KIND_MAP[k]])
);

export function StatusBadge({
  status,
  size = "sm",
  className = "",
}: {
  status: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const key = status.toLowerCase().replace(/[\s-]+/g, "_");
  const kind: StatusKind = STATUS_KIND_MAP[key] ?? "neutral";
  const style = STATUS_KIND_STYLE[kind];
  const sizeClass = BADGE_SIZE_CLASSES[size];

  return (
    <span
      className={`inline-block border font-mono uppercase tracking-[0.18em] whitespace-nowrap ${sizeClass} ${className}`}
      style={{ ...style, fontWeight: 600 }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ---- ActionButton ----
 *
 * Operator-console button: 1px hard edges, mono-caps label, ≥44px tap.
 * Variants:
 *   primary     → orange fill on void ink (brand action)
 *   accent      → orange fill on void ink (alias of primary)
 *   secondary   → panel-mute fill, rule border, ink text
 *   destructive → red border + red text, transparent fill
 *   ghost       → transparent, ink-soft text, hover panel-mute
 */

type ButtonVariant = "primary" | "secondary" | "destructive" | "accent" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANT_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: "var(--orange)", color: "var(--void)", borderColor: "var(--orange)" },
  accent: { background: "var(--orange)", color: "var(--void)", borderColor: "var(--orange)" },
  secondary: { background: "var(--panel-mute)", color: "var(--ink)", borderColor: "var(--rule-hi)" },
  destructive: { background: "transparent", color: "var(--red)", borderColor: "var(--red)" },
  ghost: { background: "transparent", color: "var(--ink-soft)", borderColor: "transparent" },
};

const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 text-[11px] tracking-[0.18em]",
  md: "px-4 text-xs tracking-[0.20em]",
  lg: "px-6 text-sm tracking-[0.20em]",
};

const BUTTON_SIZE_HEIGHT: Record<ButtonSize, string> = {
  sm: "44px",
  md: "44px",
  lg: "48px",
};

export function ActionButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  style,
  ...props
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "disabled">) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 border font-mono uppercase font-semibold transition-colors active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none ${BUTTON_SIZE_CLASSES[size]} ${className}`}
      style={{
        minHeight: BUTTON_SIZE_HEIGHT[size],
        borderWidth: "1px",
        borderStyle: "solid",
        ...BUTTON_VARIANT_STYLE[variant],
        ...style,
      }}
      {...props}
    >
      {loading && <span className="animate-spin inline-block">&#9696;</span>}
      {children}
    </button>
  );
}

/* ---- StatCard ----
 *
 * Operator-console stat tile: panel-mute fill, rule border, mono-caps
 * label, JetBrains Mono numeric value (Antonio for largest), accent
 * applied via token color.
 */

type StatAccent = "default" | "green" | "red" | "amber" | "purple";

const STAT_ACCENT_COLOR: Record<StatAccent, string> = {
  default: "var(--ink)",
  green: "var(--teal)",
  red: "var(--red)",
  amber: "var(--yellow)",
  purple: "var(--orange)", // remap legacy "purple" → orange (brand)
};

export function StatCard({
  label,
  value,
  trend,
  trendUp,
  accent = "default",
  className = "",
}: {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  accent?: StatAccent;
  className?: string;
}) {
  return (
    <div
      className={`p-4 ${className}`}
      style={{
        background: "var(--panel-mute)",
        border: "1px solid var(--rule)",
      }}
    >
      <p
        className="font-mono uppercase tracking-[0.22em]"
        style={{
          fontSize: "0.62rem",
          color: "var(--ink-soft)",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        className="mt-2 font-display tabular-nums"
        style={{
          fontSize: "1.6rem",
          lineHeight: 1.05,
          fontWeight: 700,
          letterSpacing: "0.02em",
          color: STAT_ACCENT_COLOR[accent],
        }}
      >
        {value}
      </p>
      {trend && (
        <p
          className="mt-1 font-mono uppercase tracking-[0.14em]"
          style={{
            fontSize: "0.65rem",
            fontWeight: 600,
            color: trendUp ? "var(--teal)" : "var(--red)",
          }}
        >
          {trend}
        </p>
      )}
    </div>
  );
}

/* ---- EmptyState ----
 *
 * Operator-console empty: panel-mute fill, rule border, Antonio title,
 * mono-caps action button, no rounded corners.
 */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  const actionStyle: React.CSSProperties = {
    background: "var(--orange)",
    color: "var(--void)",
    borderColor: "var(--orange)",
    borderWidth: "1px",
    borderStyle: "solid",
    minHeight: "44px",
  };
  const actionClass =
    "inline-flex items-center justify-center mt-5 px-5 font-mono uppercase font-semibold tracking-[0.20em] text-xs transition-colors active:scale-[0.98]";

  return (
    <div
      className={`p-10 text-center ${className}`}
      style={{
        background: "var(--panel-mute)",
        border: "1px solid var(--rule)",
      }}
    >
      <span
        className="block mx-auto mb-4"
        style={{ fontSize: "2.25rem", opacity: 0.45 }}
      >
        {icon}
      </span>
      <p
        className="font-display uppercase"
        style={{
          fontSize: "1.05rem",
          letterSpacing: "0.14em",
          fontWeight: 700,
          color: "var(--ink)",
        }}
      >
        {title}
      </p>
      {description && (
        <p
          className="mt-2 mx-auto max-w-md"
          style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}
        >
          {description}
        </p>
      )}
      {action &&
        (action.href ? (
          <Link href={action.href} className={actionClass} style={actionStyle}>
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className={actionClass} style={actionStyle}>
            {action.label}
          </button>
        ))}
    </div>
  );
}

/* ---- DataRow ----
 *
 * Operator-console label/value row: mono-caps label on left, ink value
 * on right, faint rule beneath.
 */

export function DataRow({
  label,
  value,
  muted = false,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2.5 ${className}`}
      style={{ borderBottom: "1px solid var(--rule-faint)" }}
    >
      <span
        className="font-mono uppercase tracking-[0.18em]"
        style={{ fontSize: "0.68rem", color: "var(--ink-soft)", fontWeight: 600 }}
      >
        {label}
      </span>
      <span
        className="text-sm tabular-nums"
        style={{
          color: muted ? "var(--ink-soft)" : "var(--ink)",
          fontWeight: muted ? 400 : 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ---- MonoValue ----
 *
 * JetBrains Mono numeric display, tabular-nums for clean column alignment.
 */

const MONO_SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};

export function MonoValue({
  size = "md",
  className = "",
  children,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`font-mono font-bold tabular-nums ${MONO_SIZE_CLASSES[size]} ${className}`}
      style={{ color: "var(--ink)" }}
    >
      {children}
    </span>
  );
}

/* ---- SectionHeader ----
 *
 * Operator-console zone-style heading: Antonio display, mono-caps count
 * pill in panel-hi.
 */

export function SectionHeader({
  children,
  count,
  className = "",
}: {
  children: string;
  count?: number;
  className?: string;
}) {
  return (
    <h2
      className={`font-display uppercase flex items-center gap-3 ${className}`}
      style={{
        fontSize: "0.95rem",
        letterSpacing: "0.16em",
        fontWeight: 700,
        color: "var(--ink)",
      }}
    >
      {children}
      {count !== undefined && (
        <span
          className="font-mono tabular-nums px-2 py-0.5"
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.14em",
            color: "var(--ink-soft)",
            background: "var(--panel-hi)",
            border: "1px solid var(--rule)",
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
    </h2>
  );
}

/* ---- Re-exports for convenience ---- */

export { STATUS_COLORS };
