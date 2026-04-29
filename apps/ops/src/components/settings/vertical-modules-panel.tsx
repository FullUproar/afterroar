"use client";

/**
 * Vertical Modules Panel — settings UI for per-store product-line toggles.
 *
 * Each row is one module (TCG, Comics, Cafe, ...). Toggle = enabled flag.
 * Below each toggle is the impact preview: "Hides Pull Lists from sidebar.
 * Hides Comic from inventory categories. Hides ComicVine lookup."
 *
 * The empty/full-set semantics live in `lib/store-modules.ts`:
 *   undefined → all enabled
 *   array     → exactly those (empty array = nothing enabled)
 *
 * We always persist a concrete array once the operator opens this panel —
 * better to make state explicit than rely on the undefined sentinel
 * forever.
 */

import { useMemo } from "react";
import {
  VERTICAL_MODULES,
  resolveEnabledModules,
  type VerticalModuleKey,
  type VerticalModuleDef,
} from "@/lib/store-modules";

interface Props {
  /** Current `enabled_verticals` value from store settings (may be undefined). */
  value: string[] | undefined;
  /** Called whenever the operator flips a toggle. Always called with a
   *  concrete array (never undefined) so the sentinel doesn't persist. */
  onChange: (next: VerticalModuleKey[]) => void;
  saving: boolean;
}

export function VerticalModulesPanel({ value, onChange, saving }: Props) {
  const enabled = useMemo(
    () => resolveEnabledModules(value as VerticalModuleKey[] | undefined),
    [value],
  );

  function toggle(key: VerticalModuleKey, on: boolean) {
    const next = new Set(enabled);
    if (on) next.add(key);
    else next.delete(key);
    onChange(VERTICAL_MODULES.filter((m) => next.has(m.key)).map((m) => m.key));
  }

  function enableAll() {
    onChange(VERTICAL_MODULES.map((m) => m.key));
  }

  function disableAll() {
    onChange([]);
  }

  const isUndefinedSentinel = value === undefined;
  const enabledCount = enabled.size;
  const totalCount = VERTICAL_MODULES.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header band */}
      <div
        className="flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "var(--panel-mute)",
          border: "1px solid var(--rule)",
          padding: "0.6rem 0.85rem",
        }}
      >
        <div>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.22em",
              fontWeight: 600,
              color: "var(--ink-soft)",
            }}
          >
            {enabledCount}/{totalCount} active
            {isUndefinedSentinel && (
              <span className="ml-2" style={{ color: "var(--ink-faint)" }}>
                · default (all on)
              </span>
            )}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={enableAll}
            disabled={saving || enabledCount === totalCount}
            className="font-mono uppercase border px-3 disabled:opacity-30"
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.18em",
              fontWeight: 600,
              padding: "0.35rem 0.7rem",
              minHeight: 32,
              color: "var(--ink-soft)",
              borderColor: "var(--rule-hi)",
              background: "var(--panel)",
            }}
          >
            Enable all
          </button>
          <button
            type="button"
            onClick={disableAll}
            disabled={saving || enabledCount === 0}
            className="font-mono uppercase border px-3 disabled:opacity-30"
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.18em",
              fontWeight: 600,
              padding: "0.35rem 0.7rem",
              minHeight: 32,
              color: "var(--ink-soft)",
              borderColor: "var(--rule-hi)",
              background: "var(--panel)",
            }}
          >
            Disable all
          </button>
        </div>
      </div>

      {/* Always-visible reassurance — operators worry about losing data. */}
      <p
        className="text-ink-faint"
        style={{ fontSize: "0.78rem", lineHeight: 1.5 }}
      >
        Toggles only affect what shows up in the sidebar, the inventory category
        dropdowns, and the catalog-lookup integrations. No data is deleted —
        flip a module back on and every item, pull list, recipe, and hold
        reappears exactly as before.
      </p>

      {/* Module list */}
      <div
        className="flex flex-col"
        style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
      >
        {VERTICAL_MODULES.map((m) => (
          <ModuleRow
            key={m.key}
            module={m}
            enabled={enabled.has(m.key)}
            saving={saving}
            onToggle={(on) => toggle(m.key, on)}
          />
        ))}
      </div>
    </div>
  );
}

function ModuleRow({
  module,
  enabled,
  saving,
  onToggle,
}: {
  module: VerticalModuleDef;
  enabled: boolean;
  saving: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 flex-wrap"
      style={{
        background: enabled ? "var(--panel-mute)" : "var(--panel)",
        padding: "0.85rem 1rem",
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-display"
            style={{
              fontSize: "0.98rem",
              fontWeight: 600,
              letterSpacing: "0.005em",
              color: enabled ? "var(--ink)" : "var(--ink-soft)",
            }}
          >
            {module.label}
          </span>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: "0.55rem",
              letterSpacing: "0.18em",
              fontWeight: 600,
              padding: "1px 6px",
              color: enabled ? "var(--teal)" : "var(--ink-faint)",
              background: enabled ? "var(--teal-mute)" : "transparent",
              border: enabled ? "1px solid rgba(94,176,155,0.30)" : "1px solid var(--rule-hi)",
            }}
          >
            {enabled ? "On" : "Off"}
          </span>
        </div>
        <p
          className="mt-1 text-ink-soft"
          style={{ fontSize: "0.82rem", lineHeight: 1.5 }}
        >
          {module.description}
        </p>
        <ImpactPreview module={module} enabled={enabled} />
      </div>

      <Toggle
        checked={enabled}
        disabled={saving}
        onChange={onToggle}
        ariaLabel={`Toggle ${module.label}`}
      />
    </div>
  );
}

function ImpactPreview({
  module,
  enabled,
}: {
  module: VerticalModuleDef;
  enabled: boolean;
}) {
  const parts: string[] = [];
  if (module.navHrefs.length > 0) {
    parts.push(
      `${module.navHrefs.length} nav ${module.navHrefs.length === 1 ? "entry" : "entries"}`,
    );
  }
  if (module.itemCategories.length > 0) {
    parts.push(
      `${module.itemCategories.length} inventory ${
        module.itemCategories.length === 1 ? "category" : "categories"
      }`,
    );
  }
  if (module.integrationIds && module.integrationIds.length > 0) {
    parts.push(`${module.integrationIds.length} catalog lookup${module.integrationIds.length === 1 ? "" : "s"}`);
  }
  if (parts.length === 0) return null;

  return (
    <div
      className="font-mono mt-1.5"
      style={{
        fontSize: "0.66rem",
        letterSpacing: "0.04em",
        color: enabled ? "var(--ink-faint)" : "var(--ink-faint)",
      }}
    >
      {enabled ? "Surfaces:" : "Will hide:"} {parts.join(" · ")}
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      style={{
        width: 52,
        height: 28,
        borderRadius: 14,
        background: checked ? "var(--orange)" : "var(--panel-mute)",
        border: `1px solid ${checked ? "var(--orange)" : "var(--rule-hi)"}`,
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 26 : 2,
          width: 22,
          height: 22,
          borderRadius: 11,
          background: checked ? "var(--void)" : "var(--ink-soft)",
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}
