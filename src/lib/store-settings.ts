"use client";

import { useStore } from "./store-context";

/* ------------------------------------------------------------------ */
/*  Store Settings — typed, with sensible defaults                      */
/*  Owner configures on Tuesday. Cashier benefits on Saturday.          */
/* ------------------------------------------------------------------ */

export interface StoreSettings {
  // Store identity
  store_display_name: string;
  receipt_header: string;
  receipt_footer: string;

  // Trade-ins
  trade_in_credit_bonus_percent: number;
  trade_in_require_customer: boolean;

  // Returns
  return_credit_bonus_percent: number;
  return_restocking_fee_percent: number;
  return_window_days: number;
  return_require_reason: boolean;

  // Checkout
  checkout_require_customer: boolean;
  checkout_auto_print_receipt: boolean;
  checkout_default_payment_method: string;

  // Tax
  tax_rate_percent: number;
  tax_included_in_price: boolean;

  // Inventory
  low_stock_threshold_default: number;

  // Promotion guardrails
  promo_max_discount_percent: number;       // Max % any single promo can take off (default: 50)
  promo_max_total_discount_percent: number; // Max % off total purchase (default: 50)
  promo_max_per_transaction: number;        // Max promos stackable per transaction (default: 1)
  promo_max_daily_uses_per_promo: number;   // Max times a single promo can be used per day (default: 0 = unlimited)
  promo_require_manager_above_percent: number; // Discounts above this % require manager override (default: 30)
  promo_allow_on_sale_items: boolean;       // Can promos stack on already-discounted items? (default: false)

  // Loyalty points
  loyalty_enabled: boolean;
  loyalty_points_per_dollar: number;       // Points earned per $1 spent
  loyalty_trade_in_bonus_points: number;   // Flat bonus points on trade-ins
  loyalty_event_checkin_points: number;    // Points for checking into an event
  loyalty_redeem_points_per_dollar: number; // Points needed for $1 off
  loyalty_min_redeem_points: number;       // Minimum points to redeem

  // Payment methods enabled
  payment_methods_enabled: string[];
}

/** Sensible defaults — a store works immediately with zero config */
export const SETTINGS_DEFAULTS: StoreSettings = {
  // Store identity
  store_display_name: "",
  receipt_header: "",
  receipt_footer: "Thank you for shopping with us!",

  // Trade-ins
  trade_in_credit_bonus_percent: 30,
  trade_in_require_customer: true,

  // Returns
  return_credit_bonus_percent: 0,
  return_restocking_fee_percent: 0,
  return_window_days: 30,
  return_require_reason: true,

  // Checkout
  checkout_require_customer: false,
  checkout_auto_print_receipt: false,
  checkout_default_payment_method: "cash",

  // Tax
  tax_rate_percent: 0,
  tax_included_in_price: false,

  // Inventory
  low_stock_threshold_default: 5,

  // Promotion guardrails
  promo_max_discount_percent: 50,
  promo_max_total_discount_percent: 50,
  promo_max_per_transaction: 1,
  promo_max_daily_uses_per_promo: 0, // 0 = unlimited
  promo_require_manager_above_percent: 30,
  promo_allow_on_sale_items: false,

  // Loyalty points
  loyalty_enabled: true,
  loyalty_points_per_dollar: 1,
  loyalty_trade_in_bonus_points: 50,
  loyalty_event_checkin_points: 25,
  loyalty_redeem_points_per_dollar: 100,
  loyalty_min_redeem_points: 500,

  // Payment methods
  payment_methods_enabled: ["cash", "card", "store_credit", "split"],
};

/** Settings section metadata for the settings UI */
export const SETTINGS_SECTIONS = [
  {
    key: "identity",
    label: "Store Identity",
    description: "How your store appears on receipts and to customers",
    fields: [
      { key: "store_display_name", label: "Display Name", type: "text" as const, placeholder: "Defaults to store name" },
      { key: "receipt_header", label: "Receipt Header", type: "text" as const, placeholder: "e.g. 123 Main St, City, ST 12345" },
      { key: "receipt_footer", label: "Receipt Footer", type: "text" as const, placeholder: "e.g. Thank you for shopping with us!" },
    ],
  },
  {
    key: "trade_ins",
    label: "Trade-Ins",
    description: "Default settings for the trade-in workflow",
    fields: [
      { key: "trade_in_credit_bonus_percent", label: "Default Credit Bonus %", type: "number" as const, min: 0, max: 100 },
      { key: "trade_in_require_customer", label: "Require customer for trade-ins", type: "toggle" as const },
    ],
  },
  {
    key: "returns",
    label: "Returns",
    description: "Default settings for processing returns",
    fields: [
      { key: "return_credit_bonus_percent", label: "Default Credit Bonus %", type: "number" as const, min: 0, max: 100 },
      { key: "return_restocking_fee_percent", label: "Default Restocking Fee %", type: "number" as const, min: 0, max: 100 },
      { key: "return_window_days", label: "Return Window (days)", type: "number" as const, min: 0, max: 365 },
      { key: "return_require_reason", label: "Require reason for returns", type: "toggle" as const },
    ],
  },
  {
    key: "checkout",
    label: "Checkout",
    description: "How the register behaves during sales",
    fields: [
      { key: "checkout_require_customer", label: "Require customer for every sale", type: "toggle" as const },
      { key: "checkout_auto_print_receipt", label: "Auto-print receipt after sale", type: "toggle" as const },
      {
        key: "checkout_default_payment_method",
        label: "Default Payment Method",
        type: "select" as const,
        options: [
          { value: "cash", label: "Cash" },
          { value: "card", label: "Card" },
          { value: "store_credit", label: "Store Credit" },
        ],
      },
    ],
  },
  {
    key: "tax",
    label: "Tax",
    description: "Sales tax configuration",
    fields: [
      { key: "tax_rate_percent", label: "Tax Rate %", type: "number" as const, min: 0, max: 30, step: 0.01 },
      { key: "tax_included_in_price", label: "Tax is included in listed prices", type: "toggle" as const },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Default inventory behavior",
    fields: [
      { key: "low_stock_threshold_default", label: "Default Low Stock Threshold", type: "number" as const, min: 0, max: 100 },
    ],
  },
  {
    key: "promo_guardrails",
    label: "Promotion Guardrails",
    description: "Safety limits to prevent accidental or excessive discounting",
    fields: [
      { key: "promo_max_discount_percent", label: "Max discount % per item", type: "number" as const, min: 1, max: 100 },
      { key: "promo_max_total_discount_percent", label: "Max discount % off total purchase", type: "number" as const, min: 1, max: 100 },
      { key: "promo_max_per_transaction", label: "Max promos per transaction", type: "number" as const, min: 1, max: 10 },
      { key: "promo_max_daily_uses_per_promo", label: "Max daily uses per promo (0 = unlimited)", type: "number" as const, min: 0, max: 10000 },
      { key: "promo_require_manager_above_percent", label: "Require manager approval above %", type: "number" as const, min: 1, max: 100 },
      { key: "promo_allow_on_sale_items", label: "Allow promos on already-discounted items", type: "toggle" as const },
    ],
  },
  {
    key: "loyalty",
    label: "Loyalty Points",
    description: "Reward customers for purchases, trade-ins, and event attendance",
    fields: [
      { key: "loyalty_enabled", label: "Enable loyalty points program", type: "toggle" as const },
      { key: "loyalty_points_per_dollar", label: "Points earned per $1 spent", type: "number" as const, min: 0, max: 100 },
      { key: "loyalty_trade_in_bonus_points", label: "Bonus points per trade-in", type: "number" as const, min: 0, max: 1000 },
      { key: "loyalty_event_checkin_points", label: "Points per event check-in", type: "number" as const, min: 0, max: 1000 },
      { key: "loyalty_redeem_points_per_dollar", label: "Points needed for $1 discount", type: "number" as const, min: 1, max: 10000 },
      { key: "loyalty_min_redeem_points", label: "Minimum points to redeem", type: "number" as const, min: 0, max: 10000 },
    ],
  },
  {
    key: "payments",
    label: "Payment Methods",
    description: "Which payment methods are available at checkout",
    fields: [
      {
        key: "payment_methods_enabled",
        label: "Enabled Methods",
        type: "multiselect" as const,
        options: [
          { value: "cash", label: "Cash" },
          { value: "card", label: "Card" },
          { value: "store_credit", label: "Store Credit" },
          { value: "split", label: "Split Payment" },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Hooks                                                               */
/* ------------------------------------------------------------------ */

/** Client-side: get typed settings merged with defaults */
export function useStoreSettings(): StoreSettings {
  const { store } = useStore();
  const raw = (store?.settings ?? {}) as Partial<StoreSettings>;
  return { ...SETTINGS_DEFAULTS, ...raw };
}

/** Get the effective store display name */
export function useStoreName(): string {
  const { store } = useStore();
  const settings = useStoreSettings();
  return settings.store_display_name || store?.name || "Store";
}

/* ------------------------------------------------------------------ */
/*  Server-side helper                                                  */
/* ------------------------------------------------------------------ */

/** Server-side: get typed settings from a store record */
export function getStoreSettings(storeSettings: Record<string, unknown> | null): StoreSettings {
  const raw = (storeSettings ?? {}) as Partial<StoreSettings>;
  return { ...SETTINGS_DEFAULTS, ...raw };
}
