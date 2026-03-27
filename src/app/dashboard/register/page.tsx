"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatCents, parseDollars } from "@/lib/types";
import type { InventoryItem, Customer } from "@/lib/types";
import type { PaymentMethod } from "@/lib/payment";
import {
  searchInventoryLocal,
  searchCustomersLocal,
  enqueueTx,
  decrementLocalInventory,
  updateLocalCustomerCredit,
} from "@/lib/offline-db";
import { useStoreName, useStoreSettings } from "@/lib/store-settings";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useScanner } from "@/hooks/use-scanner";
import type { ScannerError } from "@/lib/scanner-manager";

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
/*  Register Page — speed-optimized checkout for touchscreen POS       */
/* ------------------------------------------------------------------ */
export default function RegisterPage() {
  const storeName = useStoreName();
  const storeSettings = useStoreSettings();

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Quick add favorites
  const [favorites, setFavorites] = useState<InventoryItem[]>([]);

  // Barcode scanner (camera)
  const [showScanner, setShowScanner] = useState(false);

  // USB scanner status
  const [scannerFlash, setScannerFlash] = useState<"none" | "success" | "error">("none");
  const [scannerErrorText, setScannerErrorText] = useState<string | null>(null);
  const [lastScannedItemId, setLastScannedItemId] = useState<string | null>(null);
  const scannerErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanItemFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Customer search
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);

  // Payment
  const [showPaySheet, setShowPaySheet] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [tenderedInput, setTenderedInput] = useState("");
  const [showCashInput, setShowCashInput] = useState(false);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Quantity edit
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState("");

  // Success flash
  const [showSuccess, setShowSuccess] = useState(false);
  const [showReceiptLink, setShowReceiptLink] = useState(false);

  // Search results cache
  const searchCache = useRef<Map<string, InventoryItem[]>>(new Map());

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const customerDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tenderedRef = useRef<HTMLInputElement>(null);

  // ---- Beep sound helper ----
  const playBeep = useCallback((freq = 1200, duration = 0.08, vol = 0.08) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = vol;
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, []);

  // ---- USB barcode scanner integration ----
  const scannerEnabled = !showPaySheet && !showCustomerSearch && !showScanner;

  const {
    hiddenInputRef: scannerInputRef,
    isListening: scannerListening,
    lastScan,
    lastError: scannerLastError,
    pause: pauseScanner,
    resume: resumeScanner,
    status: scannerStatus,
  } = useScanner({
    onScan: useCallback(async (barcode: string) => {
      // Play success beep
      playBeep(1200, 0.08, 0.08);

      // Clear any previous error
      setScannerErrorText(null);
      if (scannerErrorTimerRef.current) clearTimeout(scannerErrorTimerRef.current);

      // Flash the scanner indicator green
      setScannerFlash("success");
      if (scannerFlashTimerRef.current) clearTimeout(scannerFlashTimerRef.current);
      scannerFlashTimerRef.current = setTimeout(() => setScannerFlash("none"), 600);

      // Search for the barcode in inventory
      let found: InventoryItem | null = null;

      // Try local/IndexedDB first
      try {
        const localResults = await searchInventoryLocal(barcode);
        const match = localResults.find(
          (r) => r.barcode === barcode && r.quantity > 0
        );
        if (match) {
          found = {
            ...match,
            low_stock_threshold: 5,
            image_url: null,
            external_id: null,
            catalog_product_id: null,
            shared_to_catalog: false,
            created_at: "",
            updated_at: "",
          } as InventoryItem;
        }
      } catch {}

      // Try network if not found locally
      if (!found) {
        try {
          const res = await fetch(
            `/api/inventory/search?q=${encodeURIComponent(barcode)}`
          );
          const data: InventoryItem[] = await res.json();
          if (Array.isArray(data)) {
            found =
              data.find((d) => d.barcode === barcode && d.quantity > 0) ?? null;
          }
        } catch {}
      }

      if (found) {
        // Add to cart and flash the item
        addToCart(found);
        setLastScannedItemId(found.id);
        if (scanItemFlashTimerRef.current) clearTimeout(scanItemFlashTimerRef.current);
        scanItemFlashTimerRef.current = setTimeout(
          () => setLastScannedItemId(null),
          300
        );
      } else {
        // No match — show error, populate search bar
        playBeep(400, 0.15, 0.06); // low tone for error
        setScannerFlash("error");
        if (scannerFlashTimerRef.current) clearTimeout(scannerFlashTimerRef.current);
        scannerFlashTimerRef.current = setTimeout(() => setScannerFlash("none"), 1000);

        const errorMsg = `No match for barcode: ${barcode}`;
        setScannerErrorText(errorMsg);
        if (scannerErrorTimerRef.current) clearTimeout(scannerErrorTimerRef.current);
        scannerErrorTimerRef.current = setTimeout(
          () => setScannerErrorText(null),
          5000
        );

        // Transfer barcode to visible search bar for manual handling
        setSearchQuery(barcode);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playBeep]),
    onHumanTyping: useCallback((text: string) => {
      // Transfer to visible search bar
      setSearchQuery((prev) => prev + text);
      searchRef.current?.focus();
    }, []),
    onError: useCallback((error: ScannerError) => {
      // Flash red
      setScannerFlash("error");
      if (scannerFlashTimerRef.current) clearTimeout(scannerFlashTimerRef.current);
      scannerFlashTimerRef.current = setTimeout(() => setScannerFlash("none"), 1000);

      const errorMsg =
        error.type === "partial_scan"
          ? `Partial scan: ${error.rawInput}`
          : error.type === "garbled"
            ? `Garbled input: ${error.rawInput}`
            : `Scanner error: ${error.message}`;

      setScannerErrorText(errorMsg);
      if (scannerErrorTimerRef.current) clearTimeout(scannerErrorTimerRef.current);
      scannerErrorTimerRef.current = setTimeout(
        () => setScannerErrorText(null),
        5000
      );

      // Transfer raw input to search bar for manual recovery
      if (error.rawInput && error.type !== "garbled") {
        setSearchQuery(error.rawInput);
      }
    }, []),
    enabled: scannerEnabled,
  });

  // Pause/resume scanner when overlays open/close
  useEffect(() => {
    if (showPaySheet || showCustomerSearch || showScanner) {
      pauseScanner();
    } else {
      resumeScanner();
    }
  }, [showPaySheet, showCustomerSearch, showScanner, pauseScanner, resumeScanner]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (scannerErrorTimerRef.current) clearTimeout(scannerErrorTimerRef.current);
      if (scannerFlashTimerRef.current) clearTimeout(scannerFlashTimerRef.current);
      if (scanItemFlashTimerRef.current) clearTimeout(scanItemFlashTimerRef.current);
    };
  }, []);

  // ---- Derived values (synchronous, never fetched) ----
  const subtotal = cart.reduce((s, i) => s + i.price_cents * i.quantity, 0);
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const taxRate = storeSettings.tax_rate_percent;
  const taxCents = storeSettings.tax_included_in_price
    ? 0
    : Math.round(subtotal * taxRate / 100);
  const total = subtotal + taxCents;

  // Credit available
  const creditAvailable = customer?.credit_balance_cents ?? 0;
  const creditToApply = showCreditConfirm
    ? Math.min(creditAvailable, total)
    : 0;
  const amountDue = total - creditToApply;

  const tendered = tenderedInput ? parseDollars(tenderedInput) : 0;
  const change = paymentMethod === "cash" ? Math.max(0, tendered - amountDue) : 0;

  // ---- Load favorites on mount ----
  useEffect(() => {
    fetch("/api/inventory/favorites?limit=8")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setFavorites(data);
      })
      .catch(() => {});
  }, []);

  // ---- Auto-focus search on mount ----
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // ---- Listen for register-scan event from nav ----
  useEffect(() => {
    function handleScanEvent() {
      setShowScanner(true);
    }
    window.addEventListener("register-scan", handleScanEvent);
    return () => window.removeEventListener("register-scan", handleScanEvent);
  }, []);

  // ---- Inventory search ----
  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      const trimmed = q.trim();

      // Check cache first
      const cached = searchCache.current.get(trimmed.toLowerCase());
      if (cached) {
        // Still check for barcode auto-add
        const exactBarcode = cached.find(
          (d) => d.barcode && d.barcode === trimmed && d.quantity > 0
        );
        if (exactBarcode) {
          addToCart(exactBarcode);
          setSearchQuery("");
          setSearchResults([]);
          setShowResults(false);
          return;
        }
        setSearchResults(cached.filter((d) => d.quantity > 0));
        setShowResults(true);
      }

      // Try IndexedDB
      try {
        const localResults = await searchInventoryLocal(trimmed);
        if (localResults.length > 0) {
          const asInventory = localResults.map((r) => ({
            ...r,
            low_stock_threshold: 5,
            image_url: null,
            external_id: null,
            catalog_product_id: null,
            shared_to_catalog: false,
            created_at: "",
            updated_at: "",
          })) as InventoryItem[];

          const exactBarcode = asInventory.find(
            (d) => d.barcode && d.barcode === trimmed && d.quantity > 0
          );
          if (exactBarcode) {
            addToCart(exactBarcode);
            setSearchQuery("");
            setSearchResults([]);
            setShowResults(false);
            return;
          }
          const filtered = asInventory.filter((d) => d.quantity > 0);
          searchCache.current.set(trimmed.toLowerCase(), filtered);
          setSearchResults(filtered);
          setShowResults(true);
        }
      } catch {}

      // Network fetch
      try {
        const res = await fetch(
          `/api/inventory/search?q=${encodeURIComponent(trimmed)}`
        );
        const data: InventoryItem[] = await res.json();
        if (Array.isArray(data)) {
          const exactBarcode = data.find(
            (d) => d.barcode && d.barcode === trimmed && d.quantity > 0
          );
          if (exactBarcode) {
            addToCart(exactBarcode);
            setSearchQuery("");
            setSearchResults([]);
            setShowResults(false);
            return;
          }
          const filtered = data.filter((d) => d.quantity > 0);
          searchCache.current.set(trimmed.toLowerCase(), filtered);
          setSearchResults(filtered);
          setShowResults(true);
        }
      } catch {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(searchQuery), 150);
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
      const localResults = await searchCustomersLocal(q.trim());
      if (localResults.length > 0) {
        setCustomerResults(
          localResults.map((c) => ({
            ...c,
            store_id: "",
            notes: null,
            afterroar_id: null,
            loyalty_points: 0,
            created_at: "",
            updated_at: "",
          })) as Customer[]
        );
      }
    } catch {}
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (Array.isArray(data)) setCustomerResults(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!showCustomerSearch) return;
    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
    customerDebounceRef.current = setTimeout(
      () => doCustomerSearch(customerQuery),
      200
    );
    return () => {
      if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
    };
  }, [customerQuery, showCustomerSearch, doCustomerSearch]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Enter on empty search → focus PAY
      if (e.key === "Enter" && !searchQuery.trim() && cart.length > 0 && !showPaySheet) {
        e.preventDefault();
        setShowPaySheet(true);
      }
      if (e.key === "Escape") {
        if (showPaySheet) setShowPaySheet(false);
        if (showCustomerSearch) setShowCustomerSearch(false);
        if (showScanner) setShowScanner(false);
      }
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [searchQuery, cart, showPaySheet, showCustomerSearch, showScanner]);

  // ---- Cart helpers ----
  function addToCart(item: InventoryItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.inventory_item_id === item.id);
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

  function removeItem(id: string) {
    setCart((prev) => prev.filter((c) => c.inventory_item_id !== id));
  }

  function commitQtyEdit(id: string) {
    const newQty = parseInt(editQtyValue, 10);
    if (!newQty || newQty <= 0) {
      removeItem(id);
    } else {
      setCart((prev) =>
        prev.map((c) =>
          c.inventory_item_id === id
            ? { ...c, quantity: Math.min(newQty, c.max_quantity) }
            : c
        )
      );
    }
    setEditingQty(null);
    setEditQtyValue("");
  }

  // ---- Barcode scan handler (camera scanner) ----
  function handleBarcodeScan(code: string) {
    setShowScanner(false);
    setSearchQuery(code);
    playBeep();
  }

  // ---- Complete sale ----
  async function handleCompleteSale(method: PaymentMethod) {
    if (cart.length === 0 || processing) return;
    if (method === "cash" && tendered < amountDue && amountDue > 0) return;

    setProcessing(true);
    const clientTxId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payload = {
      items: cart.map((c) => ({
        inventory_item_id: c.inventory_item_id,
        quantity: c.quantity,
        price_cents: c.price_cents,
      })),
      customer_id: customer?.id ?? null,
      payment_method: method,
      amount_tendered_cents: method === "cash" ? tendered : amountDue,
      credit_applied_cents: creditToApply,
      event_id: null,
      client_tx_id: clientTxId,
      tax_cents: taxCents,
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Checkout failed");
        setProcessing(false);
        return;
      }

      saleComplete();
    } catch {
      // Offline fallback
      try {
        await enqueueTx({
          clientTxId,
          type: "checkout",
          createdAt: new Date().toISOString(),
          status: "pending",
          retryCount: 0,
          lastError: null,
          payload,
          receipt: {} as Record<string, unknown>,
        });
        for (const item of cart) {
          await decrementLocalInventory(item.inventory_item_id, item.quantity);
        }
        if (creditToApply > 0 && customer) {
          await updateLocalCustomerCredit(customer.id, -creditToApply);
        }
        saleComplete();
      } catch {
        alert("Failed to save transaction. Please try again.");
      }
    } finally {
      setProcessing(false);
    }
  }

  function saleComplete() {
    // Flash success
    setShowSuccess(true);
    setShowReceiptLink(true);

    // Clear everything
    setCart([]);
    setCustomer(null);
    setShowPaySheet(false);
    setShowCashInput(false);
    setShowCreditConfirm(false);
    setTenderedInput("");
    setPaymentMethod("cash");

    // Hide success after 1s
    setTimeout(() => setShowSuccess(false), 1000);

    // Hide receipt link after 3s
    setTimeout(() => setShowReceiptLink(false), 3000);

    // Refocus search
    setTimeout(() => searchRef.current?.focus(), 100);
  }

  // ---- Render ----
  const hasCart = cart.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] overflow-hidden relative">
      {/* ====== HIDDEN SCANNER INPUT ====== */}
      <input
        ref={scannerInputRef}
        className="fixed opacity-0 pointer-events-none"
        style={{ position: "fixed", top: -9999, left: -9999, width: 0, height: 0 }}
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-hidden="true"
        data-scanner-input="true"
      />

      {/* ====== SUCCESS FLASH ====== */}
      {showSuccess && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-green-600/90 pointer-events-none">
          <div className="text-center text-white">
            <div className="text-6xl mb-2">{"\u2713"}</div>
            <div className="text-xl font-bold">Sale Complete</div>
          </div>
        </div>
      )}

      {/* ====== TOP BAR: Search + Camera + Customer ====== */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-card-border bg-card">
        <div className="flex-1 relative">
          {/* Scanner status dot */}
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center"
            title={
              scannerStatus === "listening"
                ? `Scanner ready${lastScan ? ` — Last: ${lastScan.code}` : ""}`
                : scannerStatus === "paused"
                  ? "Scanner paused"
                  : "Processing scan..."
            }
          >
            <span
              className={`inline-block w-2 h-2 rounded-full transition-colors duration-150 ${
                scannerFlash === "success"
                  ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]"
                  : scannerFlash === "error"
                    ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]"
                    : scannerStatus === "listening"
                      ? "bg-green-500 animate-pulse"
                      : scannerStatus === "paused"
                        ? "bg-gray-500"
                        : "bg-amber-400 animate-pulse"
              }`}
            />
          </div>

          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products or scan barcode..."
            className="w-full rounded-xl border border-input-border bg-input-bg pl-8 pr-4 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            style={{ height: 52, fontSize: 18 }}
            autoComplete="off"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowResults(false);
                setScannerErrorText(null);
                searchRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xl leading-none"
              style={{ minHeight: "auto" }}
            >
              &times;
            </button>
          )}

          {/* Scanner error text below search bar */}
          {scannerErrorText && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {scannerErrorText}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowScanner(true)}
          className="shrink-0 flex items-center justify-center rounded-xl border border-input-border bg-card text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          style={{ width: 52, height: 52, minHeight: 56 }}
          title="Scan Barcode"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75H16.5v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75H16.5v-.75z" />
          </svg>
        </button>

        <button
          onClick={() => {
            if (customer) {
              setCustomer(null);
            } else {
              setShowCustomerSearch(true);
              setCustomerQuery("");
              setCustomerResults([]);
            }
          }}
          className={`shrink-0 flex items-center justify-center rounded-xl border transition-colors ${
            customer
              ? "border-accent bg-accent-light text-accent"
              : "border-input-border bg-card text-muted hover:text-foreground hover:bg-card-hover"
          }`}
          style={{ height: 52, minWidth: 52, minHeight: 56, padding: customer ? "0 12px" : "0" }}
          title={customer ? `${customer.name} - tap to remove` : "Attach Customer"}
        >
          {customer ? (
            <span className="truncate max-w-[100px] text-sm">
              {customer.name}
              {customer.credit_balance_cents > 0 && (
                <span className="ml-1 text-xs opacity-70">
                  {formatCents(customer.credit_balance_cents)}
                </span>
              )}
            </span>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          )}
        </button>
      </div>

      {/* ====== MAIN CONTENT: Quick Add / Search Results + Cart ====== */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left panel: Quick Add grid or Search results */}
        <div className="lg:flex-1 overflow-y-auto border-b lg:border-b-0 lg:border-r border-card-border p-3"
          style={{ minHeight: hasCart ? 120 : undefined }}
        >
          {showResults && searchResults.length > 0 ? (
            <div className="space-y-1">
              {searchResults.slice(0, 20).map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left bg-card hover:bg-card-hover active:bg-accent-light transition-colors border border-card-border"
                  style={{ minHeight: 56 }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-muted">{item.category} &middot; qty {item.quantity}</div>
                  </div>
                  <div className="text-sm font-bold text-foreground ml-3 tabular-nums">
                    {formatCents(item.price_cents)}
                  </div>
                </button>
              ))}
            </div>
          ) : showResults && searchResults.length === 0 && searchQuery.trim() ? (
            <div className="flex items-center justify-center h-32 text-muted text-sm">
              No products found
            </div>
          ) : (
            /* Quick Add Grid */
            <div>
              {favorites.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                    Quick Add
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {favorites.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="flex flex-col items-center justify-center rounded-xl border border-card-border bg-card hover:bg-card-hover active:bg-accent-light px-3 py-4 transition-colors text-center"
                        style={{ minHeight: 80 }}
                      >
                        <div className="text-sm font-medium text-foreground leading-tight truncate w-full">
                          {item.name}
                        </div>
                        <div className="text-xs font-bold text-accent mt-1 tabular-nums">
                          {formatCents(item.price_cents)}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {showReceiptLink && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => window.print()}
                    className="text-sm text-accent underline hover:text-foreground"
                    style={{ minHeight: "auto" }}
                  >
                    Print last receipt
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel: Cart */}
        <div className="lg:w-[380px] xl:w-[420px] flex flex-col bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-card-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              Cart {cartItemCount > 0 && `(${cartItemCount})`}
            </span>
            {hasCart && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-muted hover:text-red-400 transition-colors"
                style={{ minHeight: "auto" }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted text-sm">
                Cart is empty
              </div>
            ) : (
              <div className="divide-y divide-card-border">
                {cart.map((item) => (
                  <div
                    key={item.inventory_item_id}
                    className={`flex items-center gap-2 px-3 py-2 transition-colors duration-200 ${
                      lastScannedItemId === item.inventory_item_id
                        ? "bg-green-500/15"
                        : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted">
                        {formatCents(item.price_cents)} each
                      </div>
                    </div>

                    {/* Quantity — tap to edit */}
                    {editingQty === item.inventory_item_id ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editQtyValue}
                        onChange={(e) => setEditQtyValue(e.target.value)}
                        onBlur={() => commitQtyEdit(item.inventory_item_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitQtyEdit(item.inventory_item_id);
                        }}
                        autoFocus
                        className="w-14 rounded-lg border border-input-border bg-input-bg px-2 py-1 text-center text-sm text-foreground focus:border-accent focus:outline-none"
                        style={{ minHeight: "auto" }}
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingQty(item.inventory_item_id);
                          setEditQtyValue(String(item.quantity));
                        }}
                        className="flex items-center justify-center rounded-lg border border-card-border bg-card-hover px-3 py-1 text-sm font-medium text-foreground hover:border-accent transition-colors"
                        style={{ minHeight: 36, minWidth: 44 }}
                        title="Tap to edit quantity"
                      >
                        x{item.quantity}
                      </button>
                    )}

                    {/* Line total */}
                    <div className="text-sm font-medium text-foreground tabular-nums w-16 text-right">
                      {formatCents(item.price_cents * item.quantity)}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.inventory_item_id)}
                      className="text-muted hover:text-red-400 text-lg leading-none transition-colors"
                      style={{ minHeight: 36, minWidth: 36 }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total bar + PAY button — always visible */}
          <div className="shrink-0 border-t border-card-border bg-card">
            {hasCart && (
              <div className="px-3 py-2 space-y-0.5">
                <div className="flex justify-between text-xs text-muted">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCents(subtotal)}</span>
                </div>
                {taxCents > 0 && (
                  <div className="flex justify-between text-xs text-muted">
                    <span>Tax ({taxRate}%)</span>
                    <span className="tabular-nums">{formatCents(taxCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-foreground">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCents(total)}</span>
                </div>
              </div>
            )}

            <div className="p-3 pt-0">
              <button
                onClick={() => {
                  if (hasCart) setShowPaySheet(true);
                }}
                disabled={!hasCart}
                className="w-full rounded-xl font-bold text-white transition-colors disabled:opacity-30"
                style={{
                  height: 56,
                  fontSize: 18,
                  backgroundColor: "#16a34a",
                  minHeight: 56,
                }}
              >
                {hasCart ? `PAY ${formatCents(total)}` : "PAY"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ====== PAYMENT SHEET ====== */}
      {showPaySheet && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              if (!processing) {
                setShowPaySheet(false);
                setShowCashInput(false);
                setShowCreditConfirm(false);
              }
            }}
          />

          {/* Sheet */}
          <div className="relative bg-card rounded-t-2xl border-t border-card-border animate-slide-up"
            style={{ maxHeight: "60vh" }}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-foreground">
                  Total: {formatCents(amountDue)}
                </span>
                <button
                  onClick={() => {
                    if (!processing) {
                      setShowPaySheet(false);
                      setShowCashInput(false);
                      setShowCreditConfirm(false);
                    }
                  }}
                  className="text-muted hover:text-foreground text-sm"
                  style={{ minHeight: "auto" }}
                >
                  Cancel
                </button>
              </div>

              {/* Cash input */}
              {showCashInput ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted">Amount tendered:</div>
                  <input
                    ref={tenderedRef}
                    type="text"
                    inputMode="decimal"
                    value={tenderedInput}
                    onChange={(e) => setTenderedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tendered >= amountDue) {
                        handleCompleteSale("cash");
                      }
                    }}
                    placeholder={formatCents(amountDue)}
                    autoFocus
                    className="w-full rounded-xl border border-input-border bg-input-bg px-4 text-foreground placeholder:text-muted focus:border-accent focus:outline-none text-center font-bold"
                    style={{ height: 56, fontSize: 24 }}
                  />
                  {tendered > 0 && tendered >= amountDue && (
                    <div className="text-center text-lg font-bold text-green-400">
                      Change: {formatCents(change)}
                    </div>
                  )}
                  <button
                    onClick={() => handleCompleteSale("cash")}
                    disabled={processing || (amountDue > 0 && tendered < amountDue)}
                    className="w-full rounded-xl font-bold text-white disabled:opacity-30 transition-colors"
                    style={{
                      height: 56,
                      fontSize: 18,
                      backgroundColor: "#16a34a",
                      minHeight: 56,
                    }}
                  >
                    {processing ? "Processing..." : "Done"}
                  </button>
                </div>
              ) : showCreditConfirm ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted">
                    Apply {formatCents(creditToApply)} store credit from {customer?.name}?
                  </div>
                  {amountDue > creditToApply && (
                    <div className="text-sm text-muted">
                      Remaining {formatCents(total - creditToApply)} will need another payment method.
                    </div>
                  )}
                  <button
                    onClick={() => handleCompleteSale("store_credit")}
                    disabled={processing}
                    className="w-full rounded-xl font-bold text-white disabled:opacity-30 transition-colors"
                    style={{
                      height: 56,
                      fontSize: 18,
                      backgroundColor: "#16a34a",
                      minHeight: 56,
                    }}
                  >
                    {processing ? "Processing..." : "Apply Credit"}
                  </button>
                </div>
              ) : (
                /* Payment method buttons */
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setShowCashInput(true);
                      setTimeout(() => tenderedRef.current?.focus(), 50);
                    }}
                    className="w-full flex items-center gap-3 rounded-xl border border-card-border bg-card-hover px-5 text-foreground hover:bg-accent-light active:bg-accent-light transition-colors"
                    style={{ height: 64, fontSize: 18, minHeight: 56 }}
                  >
                    <span className="text-2xl">{"\uD83D\uDCB5"}</span>
                    <span className="font-medium">Cash</span>
                  </button>

                  <button
                    onClick={() => handleCompleteSale("card")}
                    disabled={processing}
                    className="w-full flex items-center gap-3 rounded-xl border border-card-border bg-card-hover px-5 text-foreground hover:bg-accent-light active:bg-accent-light transition-colors disabled:opacity-50"
                    style={{ height: 64, fontSize: 18, minHeight: 56 }}
                  >
                    <span className="text-2xl">{"\uD83D\uDCB3"}</span>
                    <span className="font-medium">
                      {processing ? "Processing..." : "Card"}
                    </span>
                  </button>

                  {customer && creditAvailable > 0 && (
                    <button
                      onClick={() => setShowCreditConfirm(true)}
                      className="w-full flex items-center gap-3 rounded-xl border border-card-border bg-card-hover px-5 text-foreground hover:bg-accent-light active:bg-accent-light transition-colors"
                      style={{ height: 64, fontSize: 18, minHeight: 56 }}
                    >
                      <span className="text-2xl">{"\uD83D\uDCB0"}</span>
                      <span className="font-medium">
                        Store Credit ({formatCents(creditAvailable)})
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== CUSTOMER SEARCH OVERLAY ====== */}
      {showCustomerSearch && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowCustomerSearch(false)}
          />
          <div className="relative bg-card rounded-t-2xl border-t border-card-border animate-slide-up"
            style={{ maxHeight: "50vh" }}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-foreground">Find Customer</span>
                <button
                  onClick={() => setShowCustomerSearch(false)}
                  className="text-muted hover:text-foreground text-sm"
                  style={{ minHeight: "auto" }}
                >
                  Cancel
                </button>
              </div>
              <input
                type="text"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search by name, email, or phone..."
                autoFocus
                className="w-full rounded-xl border border-input-border bg-input-bg px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                style={{ fontSize: 16, minHeight: 52 }}
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCustomer(c);
                      setShowCustomerSearch(false);
                    }}
                    className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left bg-card-hover hover:bg-accent-light active:bg-accent-light transition-colors"
                    style={{ minHeight: 56 }}
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">{c.name}</div>
                      {c.email && (
                        <div className="text-xs text-muted">{c.email}</div>
                      )}
                    </div>
                    {c.credit_balance_cents > 0 && (
                      <div className="text-xs font-medium text-accent">
                        {formatCents(c.credit_balance_cents)} credit
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== BARCODE SCANNER ====== */}
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => handleBarcodeScan(code)}
          onClose={() => setShowScanner(false)}
          title="Scan Barcode"
        />
      )}
    </div>
  );
}
