"use client";

import { formatCents } from "@/lib/types";
import type { PaymentMethod } from "@/lib/payment";
import type { Customer } from "@/lib/types";

interface PaymentButtonsProps {
  hasCart: boolean;
  total: number;
  showPaySheet: boolean;
  showCashInput: boolean;
  showGiftCardPayment: boolean;
  processing: boolean;
  customer: Customer | null;
  creditAvailable: number;
  giftCardPayCode: string;
  giftCardPayLoading: boolean;
  giftCardPayError: string | null;
  onSetShowPaySheet: (v: boolean) => void;
  onSetShowCashInput: (v: boolean) => void;
  onSetShowCreditConfirm: (v: boolean) => void;
  onSetShowGiftCardPayment: (v: boolean) => void;
  onSetGiftCardPayCode: (v: string) => void;
  onSetGiftCardPayError: (v: string | null) => void;
  onCompleteSale: (method: PaymentMethod) => void;
  onGiftCardPayment: () => void;
}

export function PaymentButtons({
  hasCart,
  total,
  showPaySheet,
  showCashInput,
  showGiftCardPayment,
  processing,
  customer,
  creditAvailable,
  giftCardPayCode,
  giftCardPayLoading,
  giftCardPayError,
  onSetShowPaySheet,
  onSetShowCashInput,
  onSetShowCreditConfirm,
  onSetShowGiftCardPayment,
  onSetGiftCardPayCode,
  onSetGiftCardPayError,
  onCompleteSale,
  onGiftCardPayment,
}: PaymentButtonsProps) {
  return (
    <div className="px-4 pb-3 pt-1">
      {showGiftCardPayment ? (
        /* Gift card payment input */
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={giftCardPayCode}
              onChange={(e) => onSetGiftCardPayCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") onGiftCardPayment();
                if (e.key === "Escape") { onSetShowGiftCardPayment(false); onSetGiftCardPayCode(""); onSetGiftCardPayError(null); }
              }}
              placeholder="Enter gift card code"
              autoFocus
              className="flex-1 rounded-xl border border-input-border bg-input-bg px-4 text-foreground placeholder:text-muted focus:border-accent focus:outline-none font-mono uppercase"
              style={{ height: 56, fontSize: 16 }}
            />
            <button
              onClick={onGiftCardPayment}
              disabled={giftCardPayLoading || !giftCardPayCode.trim()}
              className="shrink-0 rounded-xl px-6 font-semibold text-white disabled:opacity-30 active:scale-[0.97] transition-transform"
              style={{ height: 56, backgroundColor: "#16a34a" }}
            >
              {giftCardPayLoading ? "..." : "Pay"}
            </button>
            <button
              onClick={() => { onSetShowGiftCardPayment(false); onSetGiftCardPayCode(""); onSetGiftCardPayError(null); }}
              className="shrink-0 rounded-xl text-muted hover:text-foreground border border-card-border bg-card-hover active:scale-[0.97] transition-transform"
              style={{ height: 56, width: 56 }}
            >
              {"\u2715"}
            </button>
          </div>
          {giftCardPayError && <div className="text-xs text-red-400 px-1">{giftCardPayError}</div>}
        </div>
      ) : showPaySheet && !showCashInput ? (
        /* Inline payment method buttons */
        <div className="flex gap-2">
          <button
            onClick={() => onSetShowCashInput(true)}
            className="flex-1 rounded-xl font-semibold text-foreground border border-card-border bg-card-hover active:scale-[0.97] transition-transform"
            style={{ height: 56 }}
          >
            Cash
          </button>
          <button
            onClick={() => onCompleteSale("card")}
            disabled={processing}
            className="flex-1 rounded-xl font-semibold text-white active:scale-[0.97] transition-transform disabled:opacity-50"
            style={{ height: 56, backgroundColor: "#2563eb" }}
          >
            {processing ? "..." : "Card"}
          </button>
          <button
            onClick={() => onSetShowGiftCardPayment(true)}
            className="flex-1 rounded-xl font-semibold text-foreground border border-amber-500/30 bg-amber-500/5 active:scale-[0.97] transition-transform"
            style={{ height: 56 }}
          >
            Gift Card
          </button>
          {customer && creditAvailable > 0 ? (
            <button
              onClick={() => onCompleteSale("store_credit")}
              disabled={processing}
              className="flex-1 rounded-xl font-semibold text-foreground border border-accent bg-accent/10 active:scale-[0.97] transition-transform disabled:opacity-50"
              style={{ height: 56 }}
            >
              Credit
            </button>
          ) : (
            <button
              onClick={() => onCompleteSale("external")}
              disabled={processing}
              className="flex-1 rounded-xl font-semibold text-foreground border border-card-border bg-card-hover active:scale-[0.97] transition-transform disabled:opacity-50"
              style={{ height: 56 }}
            >
              Other
            </button>
          )}
          <button
            onClick={() => { onSetShowPaySheet(false); onSetShowCashInput(false); onSetShowCreditConfirm(false); onSetShowGiftCardPayment(false); }}
            className="shrink-0 rounded-xl text-muted hover:text-foreground border border-card-border bg-card-hover active:scale-[0.97] transition-transform"
            style={{ height: 56, width: 56 }}
          >
            {"\u2715"}
          </button>
        </div>
      ) : !showPaySheet ? (
        /* PAY button -- normal state */
        <button
          onClick={() => {
            if (hasCart) onSetShowPaySheet(true);
          }}
          disabled={!hasCart}
          className="w-full rounded-xl font-bold text-white transition-colors disabled:opacity-30 active:scale-[0.98]"
          style={{
            height: 56,
            fontSize: 18,
            backgroundColor: hasCart ? "#16a34a" : undefined,
            minHeight: 56,
          }}
        >
          {hasCart ? `PAY ${formatCents(total)}` : "PAY"}
        </button>
      ) : null}
    </div>
  );
}
