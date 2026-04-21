/* ------------------------------------------------------------------ */
/*  ColorPips — render deck color identity as Scryfall mana SVGs       */
/*  Replaces the old inline letter-badge implementation.               */
/* ------------------------------------------------------------------ */

import { ManaSymbol } from "./mana-symbol";

const ORDER: Array<"W" | "U" | "B" | "R" | "G"> = ["W", "U", "B", "R", "G"];

interface ColorPipsProps {
  colors: string[];
  size?: number;
  className?: string;
}

export function ColorPips({ colors, size = 16, className }: ColorPipsProps) {
  if (!colors || colors.length === 0) {
    // Colorless / no data — show generic "C" pip
    return (
      <span className={`inline-flex items-center gap-0.5 ${className ?? ""}`}>
        <ManaSymbol token="C" size={size} />
      </span>
    );
  }

  // Sort to canonical WUBRG order
  const ordered = ORDER.filter((c) => colors.includes(c));

  return (
    <span className={`inline-flex items-center gap-0.5 ${className ?? ""}`}>
      {ordered.map((c) => (
        <ManaSymbol key={c} token={c} size={size} />
      ))}
    </span>
  );
}
