/* ------------------------------------------------------------------ */
/*  ManaSymbol — single Scryfall mana-cost pip                         */
/*  Uses Scryfall's public symbol SVG CDN.                             */
/*  Accepts a token INCLUDING or excluding braces: "{U}" or "U".       */
/* ------------------------------------------------------------------ */

interface ManaSymbolProps {
  token: string;
  size?: number; // pixel height — width matches. default 16.
  className?: string;
}

/** Convert a token like "{U}", "{B/R}", "{2}", "U/R" to a Scryfall SVG URL. */
function tokenToSvgUrl(token: string): string | null {
  let inner = token.trim();
  if (inner.startsWith("{") && inner.endsWith("}")) {
    inner = inner.slice(1, -1);
  }
  // Scryfall uses no slash in filename for hybrids — {B/R} → BR.svg.
  // Numeric tokens stay as-is: {2} → 2.svg.
  const clean = inner.replace(/\//g, "").toUpperCase();
  if (!clean) return null;
  // Guard against weird tokens — allow only alphanumerics.
  if (!/^[A-Z0-9]+$/.test(clean)) return null;
  return `https://svgs.scryfall.io/card-symbols/${clean}.svg`;
}

export function ManaSymbol({ token, size = 16, className }: ManaSymbolProps) {
  const url = tokenToSvgUrl(token);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={token}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`inline-block align-middle ${className ?? ""}`}
      loading="lazy"
      draggable={false}
    />
  );
}
