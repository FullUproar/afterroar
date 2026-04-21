"use client";

/* ------------------------------------------------------------------ */
/*  LegalityBadge — compact format-legality indicator                  */
/*  "Modern — legal" / "Modern — 3 illegal" / "Unknown"                */
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

export function LegalityBadge({ check, formatLabel, compact }: LegalityBadgeProps) {
  if (!check) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-card-border bg-card-hover px-2 py-0.5 text-[10px] text-muted">
        No format
      </span>
    );
  }

  const label = formatLabel ?? FORMAT_LABELS[check.format] ?? check.format;
  const { legal, illegal_cards, total_checked } = check;

  if (total_checked === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-card-border bg-card-hover px-2 py-0.5 text-[10px] text-muted">
        <span className="font-semibold">{label}</span>
        <span>·</span>
        <span>no data</span>
      </span>
    );
  }

  if (legal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        <span className="font-semibold">{label}</span>
        {!compact && <span className="text-green-300/70">· legal</span>}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400"
      title={illegal_cards.map((c) => `${c.name} (${c.reason})`).join(", ")}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      <span className="font-semibold">{label}</span>
      <span className="text-red-300/70">
        · {illegal_cards.length} illegal
      </span>
    </span>
  );
}
