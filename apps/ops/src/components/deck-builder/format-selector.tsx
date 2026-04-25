"use client";

/* ------------------------------------------------------------------ */
/*  Format Selector — Operator Console mono pills, grouped by game.     */
/*  Game is shown via a labeled rule, formats are mono-cap orange-on-   */
/*  active pills with a square seal icon. Color paired with text +      */
/*  shape so colorblind users get the active state without color alone. */
/* ------------------------------------------------------------------ */

const GAME_GROUPS = [
  {
    game: "mtg",
    label: "Magic: The Gathering",
    formats: [
      { key: "standard", label: "Standard", desc: "Last 2 years" },
      { key: "modern", label: "Modern", desc: "2003+" },
      { key: "pioneer", label: "Pioneer", desc: "2012+" },
      { key: "commander", label: "Commander", desc: "100-card" },
    ],
  },
  {
    game: "pokemon",
    label: "Pokemon TCG",
    formats: [{ key: "pokemon", label: "Standard", desc: "Tournament" }],
  },
  {
    game: "yugioh",
    label: "Yu-Gi-Oh!",
    formats: [{ key: "yugioh", label: "Standard", desc: "Competitive" }],
  },
];

export function FormatSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (format: string) => void;
}) {
  return (
    <div className="space-y-3">
      {GAME_GROUPS.map((group) => (
        <div key={group.game}>
          <div
            className="flex items-center gap-2 mb-2 font-mono uppercase font-semibold text-ink-faint"
            style={{ fontSize: "0.6rem", letterSpacing: "0.28em" }}
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
            <span>{group.label}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.formats.map((f) => {
              const isActive = value === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => onChange(f.key)}
                  className="font-mono uppercase font-semibold inline-flex items-center gap-2 transition-colors"
                  style={{
                    fontSize: "0.66rem",
                    letterSpacing: "0.18em",
                    padding: "0 0.85rem",
                    minHeight: 44,
                    border: `1px solid ${isActive ? "var(--orange)" : "var(--rule-hi)"}`,
                    background: isActive ? "var(--orange-mute)" : "var(--panel-mute)",
                    color: isActive ? "var(--orange)" : "var(--ink-soft)",
                  }}
                  aria-pressed={isActive}
                >
                  <span>{f.label}</span>
                  {!isActive && (
                    <span
                      className="hidden sm:inline text-ink-faint normal-case"
                      style={{
                        letterSpacing: "0.04em",
                        fontSize: "0.66rem",
                        fontWeight: 500,
                      }}
                    >
                      {f.desc}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
