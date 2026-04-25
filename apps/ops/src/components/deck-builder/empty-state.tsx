"use client";

/* ------------------------------------------------------------------ */
/*  Deck Builder Empty State — Operator Console panel, game-aware.     */
/* ------------------------------------------------------------------ */

export function DeckBuilderEmptyState({
  format,
}: {
  format: string;
}) {
  const isCommander = format === "commander";
  const isPokemon = format === "pokemon";
  const isYugioh = format === "yugioh";

  const message = isCommander
    ? "Search for a commander to see synergy cards matched against your inventory."
    : isPokemon
      ? "Browse tournament decks or paste a decklist to check your store's stock."
      : isYugioh
        ? "Search for cards or paste a decklist to see what your store has available."
        : "Pick an archetype above, search for cards, or paste a decklist. We'll show what's in stock and suggest substitutes.";

  const subtitle = isCommander
    ? "Commander · EDHREC synergy"
    : isPokemon
      ? "Pokemon TCG · Tournament data"
      : isYugioh
        ? "Yu-Gi-Oh! · Search by name"
        : "MTG · Standard / Modern / Pioneer";

  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6 py-16"
      style={{
        background: "var(--panel-mute)",
        border: "1px solid var(--rule)",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 32,
          height: 32,
          background: "var(--orange-mute)",
          border: "1px solid var(--orange)",
          marginBottom: "1rem",
          clipPath: "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
        }}
      />
      <div
        className="font-mono uppercase font-semibold text-ink-faint"
        style={{ fontSize: "0.6rem", letterSpacing: "0.28em" }}
      >
        {subtitle}
      </div>
      <h2
        className="font-display text-ink mt-2"
        style={{ fontSize: "1.4rem", fontWeight: 600, letterSpacing: "0.005em" }}
      >
        Build a deck from your shelves
      </h2>
      <p
        className="text-ink-soft max-w-sm mt-2"
        style={{ fontSize: "0.86rem", lineHeight: 1.5 }}
      >
        {message}
      </p>
    </div>
  );
}
