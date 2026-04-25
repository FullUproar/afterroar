"use client";

/* ------------------------------------------------------------------ */
/*  Code 39 barcode renderer                                           */
/*  Code 39 supports A-Z, 0-9, and "-.$/+% ", which covers the gift   */
/*  card code character set (uppercase alphanumeric + hyphen) without  */
/*  needing a runtime dependency. Code 39 is verbose vs. Code 128 but */
/*  every cheap handheld scanner reads it without configuration, which*/
/*  is the right tradeoff for receipt-printed gift cards.              */
/* ------------------------------------------------------------------ */

// Code 39 character set, ordered to match PATTERNS index
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";

// Each character is 5 bars + 4 spaces. The 9-bit string below encodes
// width: '1' = wide, '0' = narrow. Element order is bar, space, bar,
// space, bar, space, bar, space, bar.
const PATTERNS: Record<string, string> = {
  "0": "000110100",
  "1": "100100001",
  "2": "001100001",
  "3": "101100000",
  "4": "000110001",
  "5": "100110000",
  "6": "001110000",
  "7": "000100101",
  "8": "100100100",
  "9": "001100100",
  A: "100001001",
  B: "001001001",
  C: "101001000",
  D: "000011001",
  E: "100011000",
  F: "001011000",
  G: "000001101",
  H: "100001100",
  I: "001001100",
  J: "000011100",
  K: "100000011",
  L: "001000011",
  M: "101000010",
  N: "000010011",
  O: "100010010",
  P: "001010010",
  Q: "000000111",
  R: "100000110",
  S: "001000110",
  T: "000010110",
  U: "110000001",
  V: "011000001",
  W: "111000000",
  X: "010010001",
  Y: "110010000",
  Z: "011010000",
  "-": "010000101",
  ".": "110000100",
  " ": "011000100",
  $: "010101000",
  "/": "010100010",
  "+": "010001010",
  "%": "000101010",
  "*": "010010100", // start/stop only
};

interface BarcodeSvgProps {
  value: string;
  /** Height of the bars in pixels. Default 60. */
  height?: number;
  /** Width of a narrow element in pixels. Default 2. */
  narrow?: number;
  /** Wide:narrow ratio. Spec allows 2.0–3.0; default 2.5. */
  ratio?: number;
  /** Show the human-readable text below the bars. Default true. */
  showText?: boolean;
  /** Foreground color. Default black. */
  color?: string;
  /** Background color. Default white. */
  background?: string;
  className?: string;
}

export function BarcodeSvg({
  value,
  height = 60,
  narrow = 2,
  ratio = 2.5,
  showText = true,
  color = "#000",
  background = "#fff",
  className,
}: BarcodeSvgProps) {
  const wide = narrow * ratio;
  // Code 39 wraps content with start/stop char "*"
  const sanitized = (value || "")
    .toUpperCase()
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("");
  const sequence = `*${sanitized}*`;

  // Build the bar/space rectangles
  const rects: { x: number; w: number }[] = [];
  let x = 0;
  for (let charIdx = 0; charIdx < sequence.length; charIdx++) {
    const ch = sequence[charIdx];
    const pattern = PATTERNS[ch];
    if (!pattern) continue;
    for (let i = 0; i < 9; i++) {
      const w = pattern[i] === "1" ? wide : narrow;
      const isBar = i % 2 === 0;
      if (isBar) {
        rects.push({ x, w });
      }
      x += w;
    }
    if (charIdx < sequence.length - 1) {
      // inter-character gap = one narrow space
      x += narrow;
    }
  }
  const totalWidth = x;
  const textHeight = showText ? 14 : 0;
  const textGap = showText ? 4 : 0;
  const svgHeight = height + textGap + textHeight;

  return (
    <svg
      role="img"
      aria-label={`Barcode: ${sanitized}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalWidth} ${svgHeight}`}
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMin meet"
      style={{ display: "block", maxWidth: "100%" }}
      className={className}
    >
      <rect x={0} y={0} width={totalWidth} height={svgHeight} fill={background} />
      {rects.map((r, idx) => (
        <rect key={idx} x={r.x} y={0} width={r.w} height={height} fill={color} />
      ))}
      {showText && (
        <text
          x={totalWidth / 2}
          y={height + textGap + textHeight - 2}
          textAnchor="middle"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize={12}
          fontWeight={600}
          letterSpacing="0.15em"
          fill={color}
        >
          {sanitized}
        </text>
      )}
    </svg>
  );
}
