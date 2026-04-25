"use client";

import { formatCents } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Recommendations — upsell cards, accessories, upgrades.             */
/*  Operator Console mono labels, orange CTA, no emoji-only signals.   */
/* ------------------------------------------------------------------ */

interface Recommendation {
  type: string;
  name: string;
  reason: string;
  price_cents: number;
  inventory_item_id: string;
  image_url: string | null;
  category?: string;
}

const TYPE_TONE: Record<string, string> = {
  accessory: "var(--ink-soft)",
  upgrade: "var(--yellow)",
  sideboard: "var(--ink-soft)",
  also_bought: "var(--orange)",
};

const TYPE_LABEL: Record<string, string> = {
  accessory: "Protect Your Deck",
  upgrade: "Premium Upgrade",
  sideboard: "Sideboard",
  also_bought: "Popular Pick",
};

export function Recommendations({
  items,
  onAdd,
}: {
  items: Recommendation[];
  onAdd: (item: Recommendation) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3
        className="font-mono uppercase font-semibold text-ink-faint flex items-center gap-2"
        style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            background: "currentColor",
            clipPath:
              "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
          }}
        />
        You Might Also Need
      </h3>

      {/* Horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
        {items.map((rec, i) => {
          const tone = TYPE_TONE[rec.type] || TYPE_TONE.also_bought;
          const label = TYPE_LABEL[rec.type] || TYPE_LABEL.also_bought;

          return (
            <div
              key={`${rec.inventory_item_id}-${i}`}
              className="snap-start shrink-0 w-48 sm:w-auto flex flex-col gap-2 p-3"
              style={{
                background: "var(--panel-mute)",
                border: "1px solid var(--rule-hi)",
              }}
            >
              {/* Image */}
              <div
                className="w-full flex items-center justify-center overflow-hidden"
                style={{
                  height: 96,
                  background: "linear-gradient(180deg,var(--panel-hi),var(--panel))",
                  border: "1px solid var(--rule-hi)",
                }}
              >
                {rec.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rec.image_url}
                    alt={rec.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span
                    className="font-mono uppercase font-semibold text-ink-faint"
                    style={{ fontSize: "0.55rem", letterSpacing: "0.2em" }}
                  >
                    No Image
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div
                  className="font-display text-ink line-clamp-2"
                  style={{ fontSize: "0.86rem", lineHeight: 1.15, fontWeight: 500, letterSpacing: "0.005em" }}
                >
                  {rec.name}
                </div>
                <div
                  className="font-mono uppercase font-semibold mt-1"
                  style={{ color: tone, fontSize: "0.55rem", letterSpacing: "0.18em" }}
                  title={rec.reason}
                >
                  {label}
                </div>
                <div
                  className="font-mono text-ink-faint mt-0.5 truncate"
                  style={{ fontSize: "0.62rem", letterSpacing: "0.02em" }}
                >
                  {rec.reason}
                </div>
              </div>

              {/* Price + Add */}
              <div className="flex items-center justify-between mt-auto pt-1">
                <span
                  className="font-mono font-semibold tabular-nums text-ink"
                  style={{ fontSize: "0.86rem", letterSpacing: "0.02em" }}
                >
                  {formatCents(rec.price_cents)}
                </span>
                <button
                  onClick={() => onAdd(rec)}
                  className="font-mono uppercase font-semibold transition-colors"
                  style={{
                    padding: "0 0.7rem",
                    minHeight: 36,
                    fontSize: "0.6rem",
                    letterSpacing: "0.16em",
                    background: "var(--orange-mute)",
                    border: "1px solid var(--orange)",
                    color: "var(--orange)",
                  }}
                >
                  + Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
