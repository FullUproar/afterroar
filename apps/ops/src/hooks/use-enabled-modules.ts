"use client";

/**
 * Reads the active store's enabled vertical modules + exposes filter
 * helpers for category dropdowns and integration availability.
 *
 *   const { enabled, filterCategories, isCategoryEnabled } = useEnabledModules();
 *   const visible = filterCategories(ALL_CATEGORIES);
 *
 * Backed by the store-context's `settings.enabled_verticals` JSON field.
 * If undefined, all modules are treated as enabled (backward-compat).
 */

import { useMemo } from "react";
import { useStore } from "@/lib/store-context";
import {
  resolveEnabledModules,
  isCategoryGatedOff,
  isIntegrationGatedOff,
  isNavHrefGatedOff,
  type VerticalModuleKey,
} from "@/lib/store-modules";
import type { ItemCategory } from "@/lib/types";

export function useEnabledModules() {
  const { store } = useStore();
  const raw = (store?.settings as Record<string, unknown> | undefined)?.enabled_verticals;
  const enabled = useMemo(
    () =>
      resolveEnabledModules(
        Array.isArray(raw) ? (raw as VerticalModuleKey[]) : undefined,
      ),
    [raw],
  );

  return useMemo(
    () => ({
      enabled,
      isCategoryEnabled: (cat: ItemCategory) => !isCategoryGatedOff(cat, enabled),
      filterCategories: <T extends { value: ItemCategory }>(list: T[]): T[] =>
        list.filter((c) => !isCategoryGatedOff(c.value, enabled)),
      isIntegrationEnabled: (id: string) => !isIntegrationGatedOff(id, enabled),
      isNavHrefEnabled: (href: string) => !isNavHrefGatedOff(href, enabled),
    }),
    [enabled],
  );
}
