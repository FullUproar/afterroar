"use client";

/* ------------------------------------------------------------------ */
/*  LegalityBadge — Operator Console format-legality indicator.        */
/*  Status communicated via color + dot shape + text label.            */
/* ------------------------------------------------------------------ */

import type { LegalityCheck } from "@/lib/deck-analysis";

interface LegalityBadgeProps {
  check: LegalityCheck | undefined;
  formatLabel?: string;
  compact?: boolean;
}

const FORMAT_LABELS: Record<string, string> = {
  standard: "Standard",
  pioneer: "Pioneer",
  modern: "Modern",
  legacy: "Legacy",
  vintage: "Vintage",
  commander: "Commander",
  pauper: "Pauper",
  historic: "Historic",
  brawl: "Brawl",
};

const PILL_BASE: React.CSSProperties = {
  fontSize: "0.6rem",
  letterSpacing: "0.16em",
  padding: "2px 8px",
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
};

export function LegalityBadge({ check, formatLabel, compact }: LegalityBadgeProps) {
  if (!check) {
    return (
      <span
        style={{
          ...PILL_BASE,
          color: "var(--ink-faint)",
          background: "var(--panel)",
          border: "1px solid var(--rule-hi)",
        }}
      >
        No Format
      </span>
    );
  }

  const label = formatLabel ?? FORMAT_LABELS[check.format] ?? check.format;
  const { legal, illegal_cards, total_checked } = check;

  if (total_checked === 0) {
    return (
      <span
        style={{
          ...PILL_BASE,
          color: "var(--ink-faint)",
          background: "var(--panel)",
          border: "1px solid var(--rule-hi)",
        }}
      >
        <span>{label}</span>
        <span aria-hidden>·</span>
        <span style={{ letterSpacing: "0.04em", textTransform: "none" }}>no data</span>
      </span>
    );
  }

  if (legal) {
    return (
      <span
        style={{
          ...PILL_BASE,
          color: "var(--teal)",
          background: "var(--teal-mute)",
          border: "1px solid rgba(94,176,155,0.4)",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--teal)",
            boxShadow: "0 0 4px var(--teal)",
          }}
        />
        <span>{label}</span>
        {!compact && <span style={{ opacity: 0.75, letterSpacing: "0.04em", textTransform: "none" }}>· legal</span>}
      </span>
    );
  }

  return (
    <span
      style={{
        ...PILL_BASE,
        color: "var(--red)",
        background: "var(--red-mute)",
        border: "1px solid rgba(214,90,90,0.4)",
      }}
      title={illegal_cards.map((c) => `${c.name} (${c.reason})`).join(", ")}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--red)",
          boxShadow: "0 0 4px var(--red)",
        }}
      />
      <span>{label}</span>
      <span style={{ opacity: 0.8, letterSpacing: "0.04em", textTransform: "none" }}>
        · {illegal_cards.length} illegal
      </span>
    </span>
  );
}
