"use client";

/**
 * Variant matrix generator. Shown from the inventory detail page when an
 * item is a candidate parent (item.parent_id is null and the user has
 * `inventory.create`).
 *
 * UX: pick 1 or 2 axes (e.g. Size + Color for apparel, Foil + Condition
 * for TCG, Edition + Language for board games). Each axis has a label and
 * a comma-separated value list. Preview the resulting grid; submit creates
 * all child variants in one transaction via /api/inventory/[id]/variants/bulk.
 *
 * Common-case presets are offered to make this fast:
 *   apparel:    Size = S,M,L,XL,XXL · Color = (free text)
 *   tcg:        Foil = Yes,No · Condition = NM,LP,MP,HP,DMG
 *   board game: Edition = Retail,Kickstarter,Deluxe · Language = (free text)
 */

import { useState } from "react";

interface Props {
  itemId: string;
  itemName: string;
  category: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

interface Axis {
  /** Attribute key (e.g. "size", "color", "foil"). Stored on each child's attributes. */
  key: string;
  /** Display label in the form. */
  label: string;
  /** Comma-or-newline-separated values. */
  valueText: string;
}

interface Preset {
  name: string;
  axes: Axis[];
}

const PRESETS_BY_CATEGORY: Record<string, Preset[]> = {
  collectible: [
    {
      name: "Apparel: size × color",
      axes: [
        { key: "size", label: "Size", valueText: "S, M, L, XL, XXL" },
        { key: "color", label: "Color", valueText: "Black, White" },
      ],
    },
    {
      name: "Edition × Color",
      axes: [
        { key: "edition_label", label: "Edition", valueText: "Standard, Limited" },
        { key: "color", label: "Color", valueText: "" },
      ],
    },
  ],
  accessory: [
    {
      name: "Color",
      axes: [{ key: "color", label: "Color", valueText: "Black, White, Red, Blue" }],
    },
  ],
  tcg_single: [
    {
      name: "Foil × Condition",
      axes: [
        { key: "foil", label: "Foil", valueText: "Yes, No" },
        { key: "condition", label: "Condition", valueText: "NM, LP, MP" },
      ],
    },
  ],
  board_game: [
    {
      name: "Edition × Language",
      axes: [
        { key: "edition", label: "Edition", valueText: "Retail, Kickstarter, Deluxe" },
        { key: "language", label: "Language", valueText: "EN" },
      ],
    },
  ],
  comic: [
    {
      name: "Variant cover × Condition",
      axes: [
        { key: "variant_cover", label: "Cover", valueText: "Cover A, Cover B" },
        { key: "condition", label: "Condition", valueText: "NM, VF" },
      ],
    },
  ],
  miniature: [
    {
      name: "State (sealed/painted)",
      axes: [{ key: "state", label: "State", valueText: "sealed, assembled, primed, painted" }],
    },
  ],
};

const DEFAULT_AXIS: Axis = { key: "", label: "", valueText: "" };

function parseValues(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function coerce(key: string, raw: string): unknown {
  // Foil / boolean-y axes — accept Yes/No
  if (key === "foil" || key === "is_signed" || key === "is_limited") {
    if (/^(yes|true|y|1)$/i.test(raw)) return true;
    if (/^(no|false|n|0)$/i.test(raw)) return false;
  }
  return raw;
}

export function VariantMatrixModal({ itemId, itemName, category, onClose, onSuccess }: Props) {
  const presets = PRESETS_BY_CATEGORY[category] ?? [];
  const [axes, setAxes] = useState<Axis[]>([DEFAULT_AXIS, DEFAULT_AXIS]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(p: Preset) {
    const next = [...p.axes, ...Array(Math.max(0, 2 - p.axes.length)).fill(DEFAULT_AXIS)].slice(0, 2);
    setAxes(next);
    setError(null);
  }

  function setAxis(idx: number, patch: Partial<Axis>) {
    setAxes((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  // Build the cartesian preview
  const axesWithValues = axes
    .filter((a) => a.key.trim() && a.label.trim())
    .map((a) => ({ ...a, values: parseValues(a.valueText) }))
    .filter((a) => a.values.length > 0);

  const preview: Array<{ label: string; attributes: Record<string, unknown> }> = (() => {
    if (axesWithValues.length === 0) return [];
    if (axesWithValues.length === 1) {
      const a = axesWithValues[0]!;
      return a.values.map((v) => ({
        label: v,
        attributes: { [a.key]: coerce(a.key, v) },
      }));
    }
    const out: Array<{ label: string; attributes: Record<string, unknown> }> = [];
    const [a1, a2] = axesWithValues;
    for (const v1 of a1!.values) {
      for (const v2 of a2!.values) {
        out.push({
          label: `${v1} / ${v2}`,
          attributes: {
            [a1!.key]: coerce(a1!.key, v1),
            [a2!.key]: coerce(a2!.key, v2),
          },
        });
      }
    }
    return out;
  })();

  async function handleSubmit() {
    if (preview.length === 0) {
      setError("Add at least one axis with values to generate variants.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/${itemId}/variants/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variants: preview.map((p) => ({
            variant_label: p.label,
            attributes: p.attributes,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      onSuccess(data.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--rule)",
          maxWidth: "44rem",
          width: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
          <div>
            <h3 className="font-display" style={{ fontSize: "1rem", fontWeight: 800, color: "var(--cream)" }}>
              Generate variants
            </h3>
            <div className="text-[10px] uppercase tracking-wider text-ink-faint mt-0.5">
              {itemName}
            </div>
          </div>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {presets.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1">Presets</div>
              <div className="flex flex-wrap gap-1">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="font-mono uppercase border border-rule px-2 py-1 hover:border-ink-soft text-ink-soft hover:text-ink transition-colors"
                    style={{ fontSize: "0.65rem", letterSpacing: "0.06em" }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {[0, 1].map((idx) => (
            <div key={idx} className="rounded border border-rule p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                  Axis {idx + 1} {idx === 1 ? "(optional)" : ""}
                </span>
                {axes[idx]?.key && (
                  <button
                    onClick={() => setAxis(idx, { ...DEFAULT_AXIS })}
                    className="text-[10px] text-ink-soft hover:text-ink"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Attribute key (size, color, foil…)"
                  value={axes[idx]?.key ?? ""}
                  onChange={(e) => setAxis(idx, { key: e.target.value.toLowerCase() })}
                  className="rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
                />
                <input
                  type="text"
                  placeholder="Display label (Size, Color…)"
                  value={axes[idx]?.label ?? ""}
                  onChange={(e) => setAxis(idx, { label: e.target.value })}
                  className="rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
                />
              </div>
              <textarea
                placeholder="Values, comma-separated (e.g. S, M, L, XL)"
                value={axes[idx]?.valueText ?? ""}
                onChange={(e) => setAxis(idx, { valueText: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
              />
            </div>
          ))}

          {/* Preview */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-[10px] uppercase tracking-wider text-ink-faint">Preview</div>
              <div className="text-xs text-ink-soft">
                {preview.length === 0
                  ? "No variants yet"
                  : `${preview.length} variant${preview.length === 1 ? "" : "s"} to create`}
              </div>
            </div>
            {preview.length > 0 && (
              <div className="rounded border border-rule max-h-48 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5 p-2">
                  {preview.map((p) => (
                    <div
                      key={p.label}
                      className="flex items-center gap-2 px-2 py-1 rounded text-xs"
                      style={{ background: "var(--panel-mute)" }}
                    >
                      <span className="text-cream font-mono">{p.label}</span>
                      <span className="text-ink-faint truncate">
                        {Object.entries(p.attributes)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs px-2 py-1.5 rounded" style={{ background: "var(--red-mute)", color: "var(--red)" }}>
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-rule" style={{ background: "var(--panel-hi)" }}>
          <button onClick={onClose} className="font-mono uppercase text-xs px-3 py-1.5 border border-rule text-ink-soft">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || preview.length === 0}
            className="font-mono uppercase text-xs px-3 py-1.5 disabled:opacity-30"
            style={{ background: "var(--orange)", color: "var(--void)", border: "1px solid var(--orange)" }}
          >
            {submitting
              ? "Creating…"
              : preview.length === 0
              ? "Configure axes"
              : `Create ${preview.length} variant${preview.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
