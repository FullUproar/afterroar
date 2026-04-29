/**
 * Generic renderer for category-specific inventory fields.
 *
 * The shape of the form is declared by the registry in
 * `lib/category-attributes.ts`. This component reads the schema for a
 * given category and renders the right inputs (string, number, boolean,
 * enum, date), preserving the existing UI/styling conventions.
 *
 * Two surfaces:
 *   - <CategoryAttributeFields /> — full form for the inventory edit page
 *   - <CategoryAttributeBadges /> — compact badges for list / detail views
 *
 * Adding a category is "add an entry to CATEGORY_SCHEMAS"; both renderers
 * pick it up automatically. No bespoke `if (category === '...') ...` per
 * call site.
 */

"use client";

import { schemaFor, type AttributeField } from "@/lib/category-attributes";
import type { ItemCategory } from "@/lib/types";

interface FieldsProps {
  category: ItemCategory | string;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function CategoryAttributeFields({ category, values, onChange }: FieldsProps) {
  const schema = schemaFor(category);
  if (schema.attributes.length === 0) return null;

  function setField(key: string, value: unknown) {
    const next = { ...values };
    if (value === "" || value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  }

  return (
    <div className="mt-4 rounded-xl border border-card-border bg-card/40 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
          {schema.label} details
        </h3>
        <span className="text-[0.65rem] uppercase tracking-wider text-ink-faint">
          category-specific
        </span>
      </div>
      {schema.description && (
        <p className="mb-3 text-xs text-muted leading-relaxed">{schema.description}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {schema.attributes.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(v) => setField(field.key, v)}
          />
        ))}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: AttributeField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const labelEl = (
    <label className="block text-xs font-medium text-muted mb-1">
      {field.label}
      {field.required ? <span className="text-red-400 ml-0.5">*</span> : null}
    </label>
  );

  const baseClass =
    "w-full rounded-xl border border-input-border bg-input-bg px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none text-sm";

  if (field.type === "boolean") {
    return (
      <div className={field.hint ? "" : "self-start"}>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer pt-5">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-card-border bg-input-bg accent-orange"
          />
          {field.label}
        </label>
        {field.hint ? <p className="mt-1 text-[0.65rem] text-ink-faint">{field.hint}</p> : null}
      </div>
    );
  }

  if (field.type === "enum") {
    return (
      <div>
        {labelEl}
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        >
          <option value="">—</option>
          {(field.enumValues ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.hint ? <p className="mt-1 text-[0.65rem] text-ink-faint">{field.hint}</p> : null}
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        {labelEl}
        <input
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              onChange("");
              return;
            }
            const n = Number(v);
            onChange(Number.isFinite(n) ? n : "");
          }}
          className={baseClass}
          placeholder={field.hint}
        />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        {labelEl}
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      </div>
    );
  }

  // string default
  return (
    <div>
      {labelEl}
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
        placeholder={field.hint}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter bar — used at the top of the inventory list page.           */
/*                                                                      */
/*  When a category is selected, surfaces the searchable fields from    */
/*  that category's schema as filter inputs. Pass `attrFilters` and an  */
/*  `onAttrChange` to control them. The list page applies the filters  */
/*  client-side against `attributes` JSON.                              */
/* ------------------------------------------------------------------ */

import { CATEGORY_SCHEMAS } from "@/lib/category-attributes";
import { useEnabledModules } from "@/hooks/use-enabled-modules";

interface FilterBarProps {
  category: ItemCategory | "";
  attrFilters: Record<string, string>;
  onCategoryChange: (next: ItemCategory | "") => void;
  onAttrChange: (next: Record<string, string>) => void;
}

const CATEGORY_OPTIONS: { value: ItemCategory | ""; label: string }[] = [
  { value: "", label: "All categories" },
  ...Object.values(CATEGORY_SCHEMAS).map((s) => ({ value: s.category, label: s.label })),
];

export function CategoryFilterBar({
  category,
  attrFilters,
  onCategoryChange,
  onAttrChange,
}: FilterBarProps) {
  const schema = category ? CATEGORY_SCHEMAS[category] : null;
  const filterableFields = schema?.attributes.filter((a) => a.searchable) ?? [];
  const { isCategoryEnabled } = useEnabledModules();
  // Honor the per-store vertical toggles. The "All categories" entry is
  // always shown; specific categories owned by a disabled module drop out.
  const visibleOptions = CATEGORY_OPTIONS.filter(
    (c) => c.value === "" || isCategoryEnabled(c.value as ItemCategory),
  );

  function setAttr(key: string, value: string) {
    const next = { ...attrFilters };
    if (value === "") delete next[key];
    else next[key] = value;
    onAttrChange(next);
  }

  const baseInputClass =
    "rounded-md border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-[0.65rem] uppercase tracking-wider text-ink-faint">Category</span>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as ItemCategory | "")}
          className={baseInputClass}
        >
          {visibleOptions.map((c) => (
            <option key={c.value || "all"} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {filterableFields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <span className="text-[0.65rem] uppercase tracking-wider text-ink-faint">{f.label}</span>
          {f.type === "enum" ? (
            <select
              value={attrFilters[f.key] ?? ""}
              onChange={(e) => setAttr(f.key, e.target.value)}
              className={baseInputClass}
            >
              <option value="">Any</option>
              {(f.enumValues ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : f.type === "boolean" ? (
            <select
              value={attrFilters[f.key] ?? ""}
              onChange={(e) => setAttr(f.key, e.target.value)}
              className={baseInputClass}
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : (
            <input
              type="text"
              value={attrFilters[f.key] ?? ""}
              onChange={(e) => setAttr(f.key, e.target.value)}
              placeholder={f.hint ?? "Filter…"}
              className={`${baseInputClass} w-40`}
            />
          )}
        </div>
      ))}

      {(category || Object.keys(attrFilters).length > 0) && (
        <button
          type="button"
          onClick={() => {
            onCategoryChange("");
            onAttrChange({});
          }}
          className="self-end rounded-md border border-rule px-2 py-1.5 text-xs text-ink-soft hover:text-ink hover:border-ink-soft transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Badges — compact pills shown next to the item name in list views   */
/*  and the inventory detail header.                                   */
/* ------------------------------------------------------------------ */

interface BadgesProps {
  category: ItemCategory | string;
  attributes: Record<string, unknown> | null | undefined;
  className?: string;
}

export function CategoryAttributeBadges({ category, attributes, className }: BadgesProps) {
  const schema = schemaFor(category);
  const fields = schema.attributes.filter((a) => a.displayInRow);
  if (fields.length === 0 || !attributes) return null;

  const pills: { label: string; value: string }[] = [];
  for (const f of fields) {
    const v = attributes[f.key];
    if (v == null || v === "") continue;
    if (f.type === "boolean") {
      if (v === true) pills.push({ label: "", value: f.label });
      continue;
    }
    if (f.type === "enum") {
      const enumLabel = f.enumValues?.find((e) => e.value === v)?.label;
      pills.push({ label: f.label, value: enumLabel ?? String(v) });
      continue;
    }
    pills.push({ label: f.label, value: String(v) });
  }
  if (pills.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {pills.map((p, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-card-border bg-card/60 px-2 py-0.5 text-[0.65rem] text-muted"
        >
          {p.label && <span className="text-ink-faint uppercase tracking-wider">{p.label}</span>}
          <span className="font-medium text-foreground">{p.value}</span>
        </span>
      ))}
    </div>
  );
}
