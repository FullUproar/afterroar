"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCents, parseDollars } from "@/lib/types";
import type { InventoryItem, Customer } from "@/lib/types";
import type { PaymentMethod } from "@/lib/payment";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface CartItem {
  inventory_item_id: string;
  name: string;
  category: string;
  price_cents: number;
  quantity: number;
  max_quantity: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function CheckoutPage() {
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [applyCredit, setApplyCredit] = useState(false);
  const [creditInput, setCreditInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [tenderedInput, setTenderedInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Customer search state
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);

  const searchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const supabase = createClient();

  // ---- Derived values ----
  const subtotal = cart.reduce((s, i) => s + i.price_cents * i.quantity, 0);
  const creditApplied =
    applyCredit && customer
      ? Math.min(
          creditInput ? parseDollars(creditInput) : customer.credit_balance_cents,
          customer.credit_balance_cents,
          subtotal
        )
      : 0;
  const amountDue = subtotal - creditApplied;
  const tendered = tenderedInput ? parseDollars(tenderedInput) : 0;
  const change =
    paymentMethod === "cash" || paymentMethod === "split"
      ? Math.max(0, tendered - amountDue)
      : 0;

  // ---- Inventory search ----
  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/inventory/search?q=${encodeURIComponent(q)}`
        );
        const data: InventoryItem[] = await res.json();
        if (Array.isArray(data)) {
          // Check for exact barcode match — auto-add
          const exactBarcode = data.find(
            (d) => d.barcode && d.barcode === q.trim() && d.quantity > 0
          );
          if (exactBarcode) {
            addToCart(exactBarcode);
            setSearchQuery("");
            setSearchResults([]);
            setShowResults(false);
            return;
          }
          setSearchResults(data.filter((d) => d.quantity > 0));
          setShowResults(true);
          setSelectedIndex(0);
        }
      } catch {
        // ignore
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(searchQuery), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, doSearch]);

  // ---- Customer search ----
  const doCustomerSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setCustomerResults([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/customers?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setCustomerResults(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!showCustomerSearch) return;
    const t = setTimeout(() => doCustomerSearch(customerQuery), 200);
    return () => clearTimeout(t);
  }, [customerQuery, showCustomerSearch, doCustomerSearch]);

  useEffect(() => {
    if (showCustomerSearch && customerSearchRef.current) {
      customerSearchRef.current.focus();
    }
  }, [showCustomerSearch]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        handleCompleteSale();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, paymentMethod, tendered, creditApplied, customer, processing]);

  // ---- Cart helpers ----
  function addToCart(item: InventoryItem) {
    setCart((prev) => {
      const existing = prev.find(
        (c) => c.inventory_item_id === item.id
      );
      if (existing) {
        if (existing.quantity >= item.quantity) return prev;
        return prev.map((c) =>
          c.inventory_item_id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          inventory_item_id: item.id,
          name: item.name,
          category: item.category,
          price_cents: item.price_cents,
          quantity: 1,
          max_quantity: item.quantity,
        },
      ];
    });
    setSearchQuery("");
    setShowResults(false);
    searchRef.current?.focus();
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.inventory_item_id !== id) return c;
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > c.max_quantity) return c;
          return { ...c, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function removeItem(id: string) {
    setCart((prev) => prev.filter((c) => c.inventory_item_id !== id));
  }

  // ---- Complete sale ----
  async function handleCompleteSale() {
    if (cart.length === 0 || processing) return;

    if (
      (paymentMethod === "cash" || paymentMethod === "split") &&
      tendered < amountDue
    ) {
      return; // insufficient tendered
    }

    if (
      (paymentMethod === "store_credit" || paymentMethod === "split") &&
      !customer
    ) {
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((c) => ({
            inventory_item_id: c.inventory_item_id,
            quantity: c.quantity,
            price_cents: c.price_cents,
          })),
          customer_id: customer?.id ?? null,
          payment_method: paymentMethod,
          amount_tendered_cents: tendered,
          credit_applied_cents: creditApplied,
          event_id: null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Checkout failed");
        setProcessing(false);
        return;
      }

      // Success
      const msg =
        paymentMethod === "cash" || paymentMethod === "split"
          ? `Sale complete! Change: ${formatCents(data.change_cents)}`
          : "Sale complete!";
      setSuccessMsg(msg);
      setCart([]);
      setCustomer(null);
      setApplyCredit(false);
      setCreditInput("");
      setPaymentMethod("cash");
      setTenderedInput("");

      setTimeout(() => {
        setSuccessMsg(null);
        searchRef.current?.focus();
      }, 3000);
    } catch {
      alert("Network error");
    } finally {
      setProcessing(false);
    }
  }

  // ---- Search keyboard nav ----
  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (!showResults || searchResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      addToCart(searchResults[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  }

  // ---- Can complete? ----
  const canComplete =
    cart.length > 0 &&
    !processing &&
    (paymentMethod === "card" || paymentMethod === "store_credit"
      ? true
      : tendered >= amountDue);

  return (
    <div className="relative mx-auto max-w-7xl">
      <h1 className="mb-4 text-2xl font-bold text-white">Checkout</h1>

      {/* Success flash */}
      {successMsg && (
        <div className="mb-4 rounded-lg border border-emerald-700 bg-emerald-900/60 px-4 py-3 text-center text-lg font-semibold text-emerald-200">
          {successMsg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ============ LEFT: Item Search ============ */}
        <div className="space-y-4">
          <div className="relative">
            <input
              ref={searchRef}
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder="Scan barcode or search...  (F2)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            {/* Search results dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                {searchResults.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                      idx === selectedIndex
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-zinc-500">
                        {item.category} &middot; {item.quantity} in stock
                        {item.barcode && ` \u00b7 ${item.barcode}`}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-emerald-400">
                      {formatCents(item.price_cents)}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showResults && searchQuery && searchResults.length === 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
                No items found
              </div>
            )}
          </div>

          {/* Cart items (also shown here on mobile, hidden on lg) */}
          <div className="lg:hidden">{renderCart()}</div>
        </div>

        {/* ============ RIGHT: Cart + Payment ============ */}
        <div className="space-y-4">
          <div className="hidden lg:block">{renderCart()}</div>

          {/* Customer */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            {customer ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-400">Customer</div>
                  <div className="font-medium text-white">{customer.name}</div>
                  <div className="text-xs text-zinc-500">
                    Credit: {formatCents(customer.credit_balance_cents)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCustomer(null);
                    setApplyCredit(false);
                    setCreditInput("");
                    if (paymentMethod === "store_credit")
                      setPaymentMethod("cash");
                  }}
                  className="text-xs text-zinc-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerSearch(true)}
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:border-zinc-600 hover:text-white"
              >
                + Attach Customer
              </button>
            )}

            {/* Credit toggle */}
            {customer && customer.credit_balance_cents > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={applyCredit}
                    onChange={(e) => {
                      setApplyCredit(e.target.checked);
                      if (e.target.checked) {
                        setCreditInput(
                          (
                            Math.min(
                              customer.credit_balance_cents,
                              subtotal
                            ) / 100
                          ).toFixed(2)
                        );
                      }
                    }}
                    className="rounded border-zinc-700 bg-zinc-800"
                  />
                  Apply Store Credit
                </label>
                {applyCredit && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-zinc-400">$</span>
                    <input
                      type="text"
                      value={creditInput}
                      onChange={(e) => setCreditInput(e.target.value)}
                      className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 text-sm text-zinc-400">Payment Method</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "cash", label: "Cash" },
                  { value: "card", label: "Card" },
                  {
                    value: "store_credit",
                    label: "Credit",
                    disabled:
                      !customer || customer.credit_balance_cents <= 0,
                  },
                ] as {
                  value: PaymentMethod;
                  label: string;
                  disabled?: boolean;
                }[]
              ).map((m) => (
                <button
                  key={m.value}
                  disabled={m.disabled}
                  onClick={() => {
                    setPaymentMethod(m.value);
                    if (m.value === "store_credit" && customer) {
                      setApplyCredit(true);
                      setCreditInput(
                        (
                          Math.min(
                            customer.credit_balance_cents,
                            subtotal
                          ) / 100
                        ).toFixed(2)
                      );
                    }
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === m.value
                      ? "bg-blue-600 text-white"
                      : m.disabled
                      ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Cash tendered */}
            {(paymentMethod === "cash" || paymentMethod === "split") && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-zinc-400">
                    Amount Tendered
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-400">$</span>
                    <input
                      type="text"
                      value={tenderedInput}
                      onChange={(e) => setTenderedInput(e.target.value)}
                      placeholder="0.00"
                      className="w-28 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-right text-lg font-mono text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                {tendered > 0 && tendered >= amountDue && (
                  <div className="flex items-center justify-between rounded-md bg-zinc-800 px-3 py-2">
                    <span className="text-sm text-zinc-400">Change</span>
                    <span className="text-lg font-bold text-emerald-400">
                      {formatCents(change)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Totals + Complete */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Subtotal</span>
                <span>{formatCents(subtotal)}</span>
              </div>
              {creditApplied > 0 && (
                <div className="flex justify-between text-sm text-amber-400">
                  <span>Store Credit</span>
                  <span>-{formatCents(creditApplied)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-zinc-700 pt-2 text-lg font-bold text-white">
                <span>Total Due</span>
                <span>{formatCents(amountDue)}</span>
              </div>
            </div>

            <button
              onClick={handleCompleteSale}
              disabled={!canComplete}
              className={`mt-4 w-full rounded-lg py-4 text-lg font-bold transition-colors ${
                canComplete
                  ? "bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
            >
              {processing ? "Processing..." : "Complete Sale  (F4)"}
            </button>
          </div>
        </div>
      </div>

      {/* Customer search modal */}
      {showCustomerSearch && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24"
          onClick={() => setShowCustomerSearch(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={customerSearchRef}
              type="text"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Search customers by name..."
              className="mb-3 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCustomer(c);
                    setShowCustomerSearch(false);
                    setCustomerQuery("");
                    setCustomerResults([]);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  <div>
                    <div className="font-medium text-white">{c.name}</div>
                    {c.email && (
                      <div className="text-xs text-zinc-500">{c.email}</div>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {formatCents(c.credit_balance_cents)}
                  </div>
                </button>
              ))}
              {customerQuery && customerResults.length === 0 && (
                <div className="px-3 py-2 text-sm text-zinc-500">
                  No customers found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ---- Shared cart renderer ---- */
  function renderCart() {
    if (cart.length === 0) {
      return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Cart is empty. Scan or search to add items.
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-4 py-2">
          <span className="text-sm font-medium text-zinc-400">
            Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items)
          </span>
        </div>
        <div className="max-h-72 divide-y divide-zinc-800 overflow-y-auto">
          {cart.map((item) => (
            <div
              key={item.inventory_item_id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium text-white">
                  {item.name}
                </div>
                <div className="text-xs text-zinc-500">
                  {formatCents(item.price_cents)} each
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQty(item.inventory_item_id, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-medium text-white">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQty(item.inventory_item_id, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                >
                  +
                </button>
              </div>
              <div className="w-20 text-right text-sm font-semibold text-white">
                {formatCents(item.price_cents * item.quantity)}
              </div>
              <button
                onClick={() => removeItem(item.inventory_item_id)}
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-red-900/40 hover:text-red-400"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
