"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store-context";

/* ------------------------------------------------------------------ */
/*  Step definitions                                                    */
/* ------------------------------------------------------------------ */
const STEPS = [
  { key: "details", label: "Store Details" },
  { key: "products", label: "Add Products" },
  { key: "payment", label: "Set Up Payment" },
  { key: "test_sale", label: "Test Sale" },
  { key: "ready", label: "You're Ready!" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { store, effectiveRole } = useStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Store details form
  const [storeName, setStoreName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  // Products tracking
  const [itemCount, setItemCount] = useState(0);

  // Pre-fill from store
  useEffect(() => {
    if (store) {
      setStoreName(store.name || "");
      const addr = (store.settings as Record<string, unknown>)?.address as Record<string, string> | undefined;
      if (addr) {
        setStreet(addr.street || "");
        setCity(addr.city || "");
        setState(addr.state || "");
        setZip(addr.zip || "");
      }
      const settings = (store.settings ?? {}) as Record<string, unknown>;
      if (settings.tax_rate_percent) setTaxRate(String(settings.tax_rate_percent));
    }
  }, [store]);

  // Check product count when on step 2
  useEffect(() => {
    if (step === 1) {
      fetch("/api/inventory?limit=1")
        .then((r) => r.json())
        .then((d) => setItemCount(d.total ?? 0))
        .catch(() => {});
    }
  }, [step]);

  // Redirect if not owner
  useEffect(() => {
    if (effectiveRole && effectiveRole !== "owner") {
      router.push("/dashboard");
    }
  }, [effectiveRole, router]);

  // Check if onboarding already complete
  useEffect(() => {
    if (store) {
      const settings = (store.settings ?? {}) as Record<string, unknown>;
      if (settings.onboarding_complete) {
        router.push("/dashboard");
      }
    }
  }, [store, router]);

  async function saveStoreDetails() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_display_name: storeName,
          tax_rate_percent: parseFloat(taxRate) || 0,
          address: { street, city, state, zip },
          store_phone: phone,
          store_email: email,
          store_website: website,
        }),
      });
      setStep(1);
    } catch {}
    setSaving(false);
  }

  async function completeOnboarding() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_complete: true }),
      });
      router.push("/dashboard");
    } catch {}
    setSaving(false);
  }

  const inputClass = "w-full rounded-xl border border-input-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      {/* Progress bar */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted">Step {step + 1} of {STEPS.length}</span>
          <span className="text-xs text-muted">{STEPS[step].label}</span>
        </div>
        <div className="h-1.5 rounded-full bg-card-hover overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="w-full max-w-lg">
        {/* ============================================ */}
        {/* Step 1: Store Details                         */}
        {/* ============================================ */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Welcome to Afterroar Store Ops</h1>
              <p className="text-sm text-muted">Let&apos;s get your store set up. This takes about 2 minutes.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Store Name</label>
                <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Your Game Store" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Street Address</label>
                <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="123 Main St" className={inputClass} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">City</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">State</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">ZIP</label>
                  <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Tax Rate (%)</label>
                <input type="number" step="0.01" min="0" max="30" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="8.25" className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Phone <span className="text-muted">(optional)</span></label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Email <span className="text-muted">(optional)</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Website <span className="text-muted">(optional)</span></label>
                  <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className={inputClass} />
                </div>
              </div>
            </div>

            <button
              onClick={saveStoreDetails}
              disabled={saving || !storeName.trim()}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-foreground hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        )}

        {/* ============================================ */}
        {/* Step 2: Add Products                          */}
        {/* ============================================ */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Add Some Products</h1>
              <p className="text-sm text-muted">Stock your shelves. Pick whichever method works best for you.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Link
                href="/dashboard/catalog"
                className="flex items-start gap-4 rounded-xl border border-card-border bg-card p-5 hover:border-accent/50 hover:bg-card-hover transition-colors"
              >
                <span className="text-3xl mt-0.5">🔍</span>
                <div>
                  <div className="text-sm font-semibold text-foreground">Search Scryfall</div>
                  <div className="text-xs text-muted mt-1">Find Magic: The Gathering cards by name and add them directly to your inventory.</div>
                </div>
              </Link>
              <Link
                href="/dashboard/register"
                className="flex items-start gap-4 rounded-xl border border-card-border bg-card p-5 hover:border-accent/50 hover:bg-card-hover transition-colors"
              >
                <span className="text-3xl mt-0.5">📷</span>
                <div>
                  <div className="text-sm font-semibold text-foreground">Scan Barcodes</div>
                  <div className="text-xs text-muted mt-1">Use your camera or a USB scanner to scan product barcodes. Unknown barcodes get looked up automatically.</div>
                </div>
              </Link>
              <Link
                href="/dashboard/import"
                className="flex items-start gap-4 rounded-xl border border-card-border bg-card p-5 hover:border-accent/50 hover:bg-card-hover transition-colors"
              >
                <span className="text-3xl mt-0.5">📦</span>
                <div>
                  <div className="text-sm font-semibold text-foreground">Import CSV</div>
                  <div className="text-xs text-muted mt-1">Upload a spreadsheet of your existing inventory. Great for bulk imports.</div>
                </div>
              </Link>
            </div>

            {itemCount > 0 && (
              <div className="text-center text-sm text-green-400 font-medium">
                {itemCount} item{itemCount !== 1 ? "s" : ""} added so far
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="flex-1 rounded-xl border border-card-border px-4 py-3 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-foreground hover:opacity-90 transition-colors"
              >
                {itemCount > 0 ? "Continue" : "I'll add products later"}
              </button>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Step 3: Set Up Payment                        */}
        {/* ============================================ */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Payment Processing</h1>
              <p className="text-sm text-muted">Connect Stripe to accept card payments, or skip for now and use cash/simulated payments.</p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-card-border bg-card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💳</span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Connect Stripe</div>
                    <div className="text-xs text-muted">Accept credit and debit cards. Stripe Connect ensures your money goes straight to your bank.</div>
                  </div>
                </div>
                <Link
                  href="/dashboard/settings"
                  className="block w-full rounded-xl border border-accent/50 px-4 py-2.5 text-sm font-medium text-accent text-center hover:bg-accent/10 transition-colors"
                >
                  Set Up in Settings
                </Link>
              </div>

              <div className="rounded-xl border border-card-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💵</span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Cash & Simulated</div>
                    <div className="text-xs text-muted">Cash payments work immediately. Card payments are simulated until you connect Stripe.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-card-border px-4 py-3 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-foreground hover:opacity-90 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Step 4: Test Sale                              */}
        {/* ============================================ */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Make a Test Sale</h1>
              <p className="text-sm text-muted">Let&apos;s walk through your first transaction. It only takes 30 seconds.</p>
            </div>

            <div className="rounded-xl border border-card-border bg-card p-5 space-y-4">
              <div className="space-y-3">
                {[
                  { num: 1, text: "Open the Register and search for an item" },
                  { num: 2, text: "Tap it to add it to the cart" },
                  { num: 3, text: "Tap PAY at the bottom" },
                  { num: 4, text: "Choose Cash and enter an amount" },
                  { num: 5, text: "Complete the sale!" },
                ].map((s) => (
                  <div key={s.num} className="flex items-start gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                      {s.num}
                    </span>
                    <span className="text-sm text-foreground pt-0.5">{s.text}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/dashboard/register"
                className="block w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white text-center hover:bg-emerald-700 transition-colors"
              >
                Open Register
              </Link>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl border border-card-border px-4 py-3 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-foreground hover:opacity-90 transition-colors"
              >
                {itemCount > 0 ? "I did it!" : "Skip for now"}
              </button>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Step 5: You're Ready!                         */}
        {/* ============================================ */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="text-6xl">🎉</div>
              <h1 className="text-2xl font-bold text-foreground">You&apos;re all set!</h1>
              <p className="text-sm text-muted max-w-sm mx-auto">
                Your store is ready to go. You can always adjust settings, add inventory, and manage staff from the dashboard.
              </p>
            </div>

            <div className="rounded-xl border border-card-border bg-card p-4 space-y-2">
              <div className="text-xs font-medium text-muted uppercase tracking-wider">What&apos;s set up</div>
              <div className="space-y-1.5 text-sm">
                {storeName && <div className="flex items-center gap-2 text-foreground"><span className="text-green-400">&#10003;</span> Store: {storeName}</div>}
                {parseFloat(taxRate) > 0 && <div className="flex items-center gap-2 text-foreground"><span className="text-green-400">&#10003;</span> Tax rate: {taxRate}%</div>}
                {itemCount > 0 && <div className="flex items-center gap-2 text-foreground"><span className="text-green-400">&#10003;</span> {itemCount} product{itemCount !== 1 ? "s" : ""} in inventory</div>}
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={completeOnboarding}
                  disabled={saving}
                  className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-foreground hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  Go to Dashboard
                </button>
                <Link
                  href="/dashboard/register"
                  onClick={() => {
                    // Mark complete in background
                    fetch("/api/settings", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ onboarding_complete: true }),
                    }).catch(() => {});
                  }}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white text-center hover:bg-emerald-700 transition-colors"
                >
                  Open Register
                </Link>
              </div>
              <div className="text-center">
                <Link href="/dashboard/help" className="text-xs text-muted hover:text-foreground transition-colors">
                  Browse Help Articles
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
