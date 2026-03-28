/**
 * Shared store settings — safe to import from BOTH client and server.
 * No React hooks, no "use client" directive.
 */

export interface StoreSettings {
  store_display_name: string;
  tax_rate_percent: number;
  tax_included_in_price: boolean;
  default_credit_bonus_percent: number;
  low_stock_threshold: number;
  receipt_footer_message: string;
  loyalty_enabled: boolean;
  loyalty_points_per_dollar: number;
  loyalty_redemption_rate: number;
  currency: string;
  [key: string]: unknown;
}

export const SETTINGS_DEFAULTS: StoreSettings = {
  store_display_name: "",
  tax_rate_percent: 0,
  tax_included_in_price: false,
  default_credit_bonus_percent: 30,
  low_stock_threshold: 5,
  receipt_footer_message: "Thank you for shopping with us!",
  loyalty_enabled: false,
  loyalty_points_per_dollar: 1,
  loyalty_redemption_rate: 100, // 100 points = $1
  currency: "USD",
};

/** Server-safe: get typed settings from a store record */
export function getStoreSettings(
  storeSettings: Record<string, unknown> | null
): StoreSettings {
  const raw = (storeSettings ?? {}) as Partial<StoreSettings>;
  return { ...SETTINGS_DEFAULTS, ...raw };
}
