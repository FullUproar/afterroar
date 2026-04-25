"use client";

/* ------------------------------------------------------------------ */
/*  Meta Archetypes — Operator Console mono pills with meta share.     */
/*  Tap to build the archetype's reference list.                       */
/* ------------------------------------------------------------------ */

interface LiveMetaResult {
  name: string;
  metaShare: number;
  format: string;
  deckUrl?: string;
}

export function MetaArchetypes({
  decks,
  loading,
  onSelect,
}: {
  decks: LiveMetaResult[];
  loading: boolean;
  onSelect: (archetype: string) => void;
}) {
  if (loading) {
    return (
      <div
        className="flex items-center gap-2 font-mono uppercase text-ink-soft py-3"
        style={{ fontSize: "0.66rem", letterSpacing: "0.18em" }}
      >
        <span
          className="inline-block animate-spin"
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: "2px solid var(--orange)",
            borderTopColor: "transparent",
          }}
        />
        Loading live meta…
      </div>
    );
  }

  if (decks.length === 0) return null;

  return (
    <div className="space-y-2">
      <div
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
        Popular Archetypes — tap to build
      </div>
      <div className="flex flex-wrap gap-1.5">
        {decks.slice(0, 12).map((deck) => (
          <button
            key={deck.name}
            onClick={() => onSelect(deck.name)}
            className="group font-mono uppercase font-semibold inline-flex items-center gap-2 transition-colors"
            style={{
              fontSize: "0.66rem",
              letterSpacing: "0.16em",
              padding: "0 0.85rem",
              minHeight: 44,
              background: "var(--panel-mute)",
              border: "1px solid var(--rule-hi)",
              color: "var(--ink-soft)",
            }}
          >
            <span>{deck.name}</span>
            {deck.metaShare > 0 && (
              <span
                className="font-mono tabular-nums opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--orange)", fontSize: "0.6rem", letterSpacing: "0.04em" }}
              >
                {deck.metaShare.toFixed(1)}%
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
