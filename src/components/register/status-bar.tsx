"use client";

import { formatCents } from "@/lib/types";
import type { Customer } from "@/lib/types";

type ActivePanel = "search" | "scan" | "customer" | "quick" | "manual" | "discount" | "more" | "price_check" | "store_credit" | "returns" | "loyalty" | "gift_card" | "no_sale" | "flag_issue" | "void_last" | "order_lookup" | null;

interface StatusBarProps {
  hasCart: boolean;
  customer: Customer | null;
  parkedCount: number;
  hasLastReceipt: boolean;
  togglePanel: (panel: ActivePanel) => void;
  setActivePanel: (panel: ActivePanel) => void;
  onPark: () => void;
  onRecall: () => void;
  onShowLastReceipt: () => void;
  setCustomerQuery: (q: string) => void;
  setCustomerResults: (results: Customer[]) => void;
}

export function StatusBar({
  hasCart,
  customer,
  parkedCount,
  hasLastReceipt,
  togglePanel,
  setActivePanel,
  onPark,
  onRecall,
  onShowLastReceipt,
  setCustomerQuery,
  setCustomerResults,
}: StatusBarProps) {
  return (
    <div className="shrink-0 flex items-center justify-between px-4 h-8 border-t border-card-border bg-card/80 text-xs text-muted">
      <div className="flex items-center gap-2 min-w-0">
        {/* Park button -- only when cart has items */}
        {hasCart && (
          <button
            onClick={onPark}
            className="hover:text-foreground transition-colors shrink-0 flex items-center gap-1"
            style={{ minHeight: "auto" }}
            title="Park this cart"
          >
            <span>{"\u23F8"}</span> Park
          </button>
        )}
        {/* Recall button -- only when parked carts exist */}
        {parkedCount > 0 && (
          <button
            onClick={onRecall}
            className="hover:text-foreground transition-colors shrink-0 flex items-center gap-1"
            style={{ minHeight: "auto" }}
            title="Recall a parked cart"
          >
            <span>{"\u25B6"}</span> Recall
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold">
              {parkedCount}
            </span>
          </button>
        )}
        {(hasCart || parkedCount > 0) && <span className="text-card-border">|</span>}
        <button
          onClick={() => {
            if (customer) {
              togglePanel("customer");
            } else {
              setActivePanel("customer");
              setCustomerQuery("");
              setCustomerResults([]);
            }
          }}
          className="hover:text-foreground transition-colors truncate"
          style={{ minHeight: "auto" }}
        >
          {customer ? customer.name : "Guest"}
          {customer && customer.credit_balance_cents > 0 && (
            <span className="ml-1 text-accent">{formatCents(customer.credit_balance_cents)}</span>
          )}
        </button>
      </div>
      {hasLastReceipt && (
        <button
          onClick={onShowLastReceipt}
          className="hover:text-foreground transition-colors shrink-0"
          style={{ minHeight: "auto" }}
        >
          Last Receipt
        </button>
      )}
    </div>
  );
}
