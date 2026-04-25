"use client";

import { formatCents } from "@/lib/types";
import { CardHoverPreview } from "@/components/tcg/card-hover-preview";

/* ------------------------------------------------------------------ */
/*  Inventory Match Card — Operator Console rich row showing a card's  */
/*  availability in-store.                                             */
/*  Status is communicated via shape (seal/dot) + color + text.        */
/* ------------------------------------------------------------------ */

interface InventoryMatch {
  name: string;
  needed: number;
  in_stock: number;
  price_cents: number;
  inventory_item_id: string | null;
  image_url: string | null;
  status: "available" | "partial" | "unavailable";
  substitute?: {
    name: string;
    price_cents: number;
    inventory_item_id: string;
    image_url: string | null;
    reason: string;
  };
  network?: Array<{
    store_name: string;
    store_slug: string;
    city: string | null;
    state: string | null;
    quantity: number;
  }>;
}

const STATUS_STYLES = {
  available: {
    border: "var(--teal)",
    accent: "var(--teal)",
    accentBg: "var(--teal-mute)",
    label: "In Stock",
  },
  partial: {
    border: "rgba(251,219,101,0.45)",
    accent: "var(--yellow)",
    accentBg: "var(--yellow-mute)",
    label: "Partial",
  },
  unavailable: {
    border: "rgba(214,90,90,0.4)",
    accent: "var(--red)",
    accentBg: "var(--red-mute)",
    label: "Unavailable",
  },
};

export function InventoryCard({
  match,
  onAddToCart,
  onAddSubstitute,
}: {
  match: InventoryMatch;
  onAddToCart: () => void;
  onAddSubstitute?: () => void;
}) {
  const style = STATUS_STYLES[match.status];

  const stockColor =
    match.in_stock >= match.needed
      ? "var(--teal)"
      : match.in_stock > 0
      ? "var(--yellow)"
      : "var(--red)";

  return (
    <div
      style={{
        background: "var(--panel-mute)",
        border: `1px solid ${style.border}`,
        overflow: "hidden",
      }}
    >
      <div className="flex gap-3 p-3">
        {/* Card thumbnail */}
        <div
          className="shrink-0"
          style={{
            width: 56,
            height: 78,
            background:
              "linear-gradient(180deg,var(--panel-hi),var(--panel))",
            border: "1px solid var(--rule-hi)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {match.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={match.image_url}
              alt={match.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-mono text-ink-faint" style={{ fontSize: "0.55rem", letterSpacing: "0.1em" }}>
              TCG
            </div>
          )}
        </div>

        {/* Card details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3
                className="font-display text-ink truncate"
                style={{ fontSize: "0.96rem", fontWeight: 500, lineHeight: 1.1, letterSpacing: "0.005em" }}
              >
                <CardHoverPreview
                  imageUrl={match.image_url}
                  name={match.name}
                  className="hover:underline decoration-dotted underline-offset-2 cursor-help"
                >
                  {match.name}
                </CardHoverPreview>
              </h3>
              {/* Status badge — shape + color + text */}
              <span
                className="shrink-0 font-mono uppercase font-semibold inline-flex items-center gap-1"
                style={{
                  padding: "2px 6px",
                  fontSize: "0.55rem",
                  letterSpacing: "0.14em",
                  color: style.accent,
                  background: style.accentBg,
                  border: `1px solid ${style.border}`,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    background: "currentColor",
                    clipPath:
                      "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
                  }}
                />
                {style.label}
              </span>
            </div>

            <div
              className="font-mono text-ink-faint mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5"
              style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
            >
              <span>
                Need <span className="text-ink font-semibold">{match.needed}</span>
              </span>
              <span style={{ color: "var(--rule-hi)" }}>·</span>
              <span>
                Have{" "}
                <span style={{ color: stockColor, fontWeight: 600 }}>
                  {match.in_stock}
                </span>
              </span>
              {match.price_cents > 0 && (
                <>
                  <span style={{ color: "var(--rule-hi)" }}>·</span>
                  <span className="text-ink font-semibold">
                    {formatCents(match.price_cents)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action button */}
          {match.status !== "unavailable" && match.inventory_item_id && (
            <button
              onClick={onAddToCart}
              className="mt-2 self-start font-mono uppercase font-semibold inline-flex items-center gap-1.5 transition-colors"
              style={{
                padding: "0 0.75rem",
                minHeight: 36,
                fontSize: "0.62rem",
                letterSpacing: "0.16em",
                background: "var(--teal-mute)",
                border: "1px solid var(--teal)",
                color: "var(--teal)",
              }}
            >
              <span aria-hidden>+</span> Add to Cart
            </button>
          )}
        </div>
      </div>

      {/* Substitute suggestion */}
      {match.substitute && (match.status === "unavailable" || match.status === "partial") && (
        <div
          className="px-3 py-2 flex items-center gap-2"
          style={{
            background: "var(--yellow-mute)",
            borderTop: "1px solid rgba(251,219,101,0.3)",
          }}
        >
          <span
            className="shrink-0 font-mono uppercase font-semibold"
            style={{ color: "var(--yellow)", fontSize: "0.6rem", letterSpacing: "0.14em" }}
          >
            Try instead
          </span>
          {match.substitute.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={match.substitute.image_url}
              alt=""
              className="shrink-0 object-cover"
              style={{ width: 24, height: 32, border: "1px solid var(--rule-hi)" }}
            />
          )}
          <CardHoverPreview
            imageUrl={match.substitute.image_url}
            name={match.substitute.name}
            className="text-sm font-medium text-ink truncate hover:underline decoration-dotted underline-offset-2 cursor-help"
          >
            {match.substitute.name}
          </CardHoverPreview>
          <span
            className="font-mono text-ink-faint hidden sm:inline shrink-0"
            style={{ fontSize: "0.62rem" }}
          >
            {match.substitute.reason}
          </span>
          <span
            className="font-mono text-ink shrink-0"
            style={{ fontSize: "0.7rem", fontWeight: 600 }}
          >
            {formatCents(match.substitute.price_cents)}
          </span>
          {onAddSubstitute && (
            <button
              onClick={onAddSubstitute}
              className="shrink-0 font-mono uppercase font-semibold transition-colors"
              style={{
                padding: "2px 8px",
                fontSize: "0.6rem",
                letterSpacing: "0.14em",
                background: "rgba(251,219,101,0.16)",
                border: "1px solid var(--yellow)",
                color: "var(--yellow)",
              }}
            >
              + Sub
            </button>
          )}
        </div>
      )}

      {/* Network availability */}
      {match.network && match.network.length > 0 && (
        <div
          className="px-3 py-2 flex items-start gap-2"
          style={{
            background: "var(--orange-mute)",
            borderTop: "1px solid rgba(255,122,0,0.25)",
          }}
        >
          <span
            className="shrink-0 font-mono uppercase font-semibold"
            style={{ color: "var(--orange)", fontSize: "0.6rem", letterSpacing: "0.14em" }}
          >
            Nearby
          </span>
          <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ fontSize: "0.7rem" }}>
            {match.network.map((ns, i) => (
              <span key={i} className="text-ink">
                <span className="font-medium">{ns.store_name}</span>
                {ns.city && (
                  <span className="text-ink-faint"> ({ns.city}{ns.state ? `, ${ns.state}` : ""})</span>
                )}
                <span className="ml-1 font-mono" style={{ color: "var(--orange)" }}>
                  ×{ns.quantity}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
