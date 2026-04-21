/* ------------------------------------------------------------------ */
/*  ManaCost — parse a Scryfall mana_cost string into rendered pips    */
/*  Example input: "{1}{U}{U}" → [1] [U] [U] pip icons                 */
/* ------------------------------------------------------------------ */

import { ManaSymbol } from "./mana-symbol";

interface ManaCostProps {
  cost: string | null | undefined;
  size?: number;
  className?: string;
}

export function ManaCost({ cost, size = 14, className }: ManaCostProps) {
  if (!cost) return null;
  const tokens = cost.match(/\{[^}]+\}/g) ?? [];
  if (tokens.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-[1px] ${className ?? ""}`}>
      {tokens.map((t, i) => (
        <ManaSymbol key={`${t}-${i}`} token={t} size={size} />
      ))}
    </span>
  );
}
