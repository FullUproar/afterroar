"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";

/* ------------------------------------------------------------------ */
/*  Help article data                                                   */
/* ------------------------------------------------------------------ */
interface HelpArticle {
  id: string;
  title: string;
  category: string;
  body: string;
  tips?: string[];
}

const ARTICLES: HelpArticle[] = [
  // Getting Started
  {
    id: "first-sale",
    title: "Your first sale",
    category: "Getting Started",
    body: "Open the Register from the sidebar or dashboard. Search for an item by name or scan its barcode. Tap to add it to the cart. When you're ready, hit PAY, pick a payment method, and complete the transaction. The change-due screen shows you exactly what to hand back.",
    tips: ["You can also type a dollar amount and add a manual item if the product isn't in your system yet."],
  },
  {
    id: "adding-products",
    title: "Adding products",
    category: "Getting Started",
    body: "There are three ways to add products: search the Scryfall catalog for TCG singles, scan barcodes (unknown barcodes trigger a learn flow that looks up the product automatically), or bulk import via CSV from the Import page.",
    tips: ["The barcode learn flow uses UPC databases and BoardGameGeek to auto-fill product details."],
  },
  {
    id: "setting-up-tax",
    title: "Setting up tax",
    category: "Getting Started",
    body: "Go to Settings and find the Tax section. Enter your local sales tax rate as a percentage (e.g., 8.25). You can also toggle whether tax is included in your listed prices. The register calculates tax automatically on every sale.",
  },
  // Register
  {
    id: "cash-sale",
    title: "Processing a cash sale",
    category: "Register",
    body: "After adding items to the cart, tap PAY and select Cash. Enter the amount the customer handed you using the keypad. The system calculates change automatically. Tap Done to clear the screen for the next customer.",
  },
  {
    id: "barcode-scanner",
    title: "Using the barcode scanner",
    category: "Register",
    body: "Plug in a USB barcode scanner — it works like a keyboard. Just scan any barcode while the register is open and it will automatically find and add the matching item. If the barcode isn't recognized, you'll be prompted to link it to a product.",
    tips: ["Most USB scanners work out of the box. No drivers needed.", "The scanner also works on the inventory and catalog pages."],
  },
  {
    id: "discounts",
    title: "Applying discounts",
    category: "Register",
    body: "Tap the Discount button in the register action bar. Choose between a percentage or dollar amount discount, and whether it applies to a specific item or the whole cart. Add a reason (like 'loyalty customer' or 'damaged box') for your records.",
  },
  {
    id: "returns-register",
    title: "Processing returns",
    category: "Register",
    body: "From the More menu in the register, tap Returns. Look up the original transaction, select the items being returned, and choose whether to refund to the original payment method or issue store credit. The credit bonus percentage is configurable in Settings.",
  },
  {
    id: "gift-cards",
    title: "Gift card payments",
    category: "Register",
    body: "Customers can pay with gift cards at checkout. Tap PAY, then select Gift Card. Enter the card code and the system will check the balance and apply it. If the gift card doesn't cover the full amount, the remaining balance can be paid with another method.",
  },
  {
    id: "voiding",
    title: "Voiding a transaction",
    category: "Register",
    body: "From the More menu, tap Void Last. This reverses the most recent transaction, restoring inventory quantities and refunding any payment. Only managers and owners can void transactions. The voided transaction remains in your records for auditing.",
  },
  // Inventory
  {
    id: "scryfall-add",
    title: "Adding items from Scryfall",
    category: "Inventory",
    body: "Go to the Catalog page and search by card name. The system searches Scryfall's database of every Magic card ever printed. Select a card, set the condition, quantity, and your price, then add it to inventory. Card images, set info, and rarity are pulled automatically.",
  },
  {
    id: "bulk-pricing",
    title: "Bulk pricing updates",
    category: "Inventory",
    body: "The TCG Singles page has a Bulk Pricing tool. Select cards by game, set, or condition, then apply a pricing rule — like 'set all NM to 90% of market price' or 'mark down all LP by 15%'. Changes are previewed before you commit.",
  },
  {
    id: "stock-counts",
    title: "Stock counts",
    category: "Inventory",
    body: "Start a stock count from the Stock Count page. Scan or search items and enter the counted quantity. When you're done, the system highlights discrepancies between expected and actual quantities. Approve the count to update inventory levels.",
  },
  {
    id: "barcode-labels",
    title: "Printing barcode labels",
    category: "Inventory",
    body: "Go to Inventory, select items, and tap Print Labels. Labels include the product name, price, and a scannable barcode. They're formatted for standard label sheets. You can also print labels from the item detail page.",
  },
  // TCG Singles
  {
    id: "condition-guide",
    title: "Condition grading guide",
    category: "TCG Singles",
    body: "NM (Near Mint): Looks unplayed, no visible wear. LP (Lightly Played): Minor edge wear or small scratches. MP (Moderately Played): Noticeable wear, minor creases. HP (Heavily Played): Significant wear, creases, or markings. DMG (Damaged): Major damage — bends, tears, water damage.",
    tips: ["When in doubt, grade one step lower. Customers are happier getting a card in better condition than expected."],
  },
  {
    id: "buylist-prices",
    title: "Setting buylist prices",
    category: "TCG Singles",
    body: "Your buylist is the price you'll pay customers for their cards. The trade-in system uses a percentage of market price (configurable in Settings under Trade-Ins). Cash payouts use the base percentage; store credit adds a bonus on top.",
  },
  {
    id: "ebay-listings",
    title: "eBay listings",
    category: "TCG Singles",
    body: "From the TCG Singles dashboard, tap eBay Listings. Select cards to list, set your eBay price (or use the suggested price), and publish. Inventory syncs automatically — when a card sells on eBay, it's removed from your in-store stock.",
  },
  // Events
  {
    id: "creating-events",
    title: "Creating events",
    category: "Events",
    body: "Go to Events and tap Create Event. Set the name, date, time, format (like Standard, Draft, Commander Night), entry fee, and max players. Events show up on your store's public page and players can see them in the Afterroar app.",
  },
  {
    id: "checkin-flow",
    title: "Check-in flow",
    category: "Events",
    body: "When a player arrives, open the event and tap Check In. Search for the customer or create a new one on the spot. The system collects the entry fee and adds it to your daily revenue. Players earn loyalty points for checking in.",
  },
  {
    id: "tournaments",
    title: "Tournament brackets",
    category: "Events",
    body: "Tournaments build on events with bracket management. After check-in, tap Start Tournament to generate Swiss or single-elimination pairings. Report results round by round. Standings update automatically.",
  },
  // Trade-Ins
  {
    id: "bulk-buylist",
    title: "Bulk buylist walkthrough",
    category: "Trade-Ins",
    body: "Open Trade-Ins and tap Bulk Buylist. Scan cards one at a time — each one gets priced automatically based on your buylist percentage. Review the offer, adjust individual prices if needed, and complete the trade. The customer gets cash or store credit.",
  },
  {
    id: "cash-vs-credit",
    title: "Cash vs credit payouts",
    category: "Trade-Ins",
    body: "Cash payouts use your base buylist percentage. Store credit payouts add a configurable bonus (default 30%) to incentivize customers to keep their money in your store. Both options are shown side-by-side during the trade-in so the customer can choose.",
  },
  // Reports
  {
    id: "cash-flow-reports",
    title: "Understanding cash flow",
    category: "Reports",
    body: "The Cash Flow page shows money in (sales, event fees) and money out (trade-in payouts, refunds) for any date range. The daily chart helps you spot trends. This is real operational cash flow, not just revenue.",
  },
  {
    id: "event-roi",
    title: "Event ROI",
    category: "Reports",
    body: "Event ROI shows the revenue generated by each event — entry fees plus any additional sales made by event attendees during the event. This helps you figure out which events are worth running and which ones to cut.",
  },
  {
    id: "dead-stock",
    title: "Dead stock alerts",
    category: "Reports",
    body: "Items that haven't sold in a configurable window (default 90 days) show up in the dead stock report. Consider marking them down, returning them to your distributor, or bundling them in a clearance sale.",
  },
  // Settings
  {
    id: "tax-config",
    title: "Tax configuration",
    category: "Settings",
    body: "Set your tax rate as a percentage in Settings. You can choose whether prices in your system include tax or whether tax is added on top at checkout. Most US stores add tax on top. The register shows the tax breakdown on every receipt.",
  },
  {
    id: "staff-management",
    title: "Staff management",
    category: "Settings",
    body: "Go to the Staff page to add team members. Assign them a role: Cashier (register only), Manager (register + inventory + reports), or Owner (everything). Staff members sign in with their own credentials and all their actions are tracked.",
  },
  {
    id: "afterroar-integration",
    title: "Afterroar integration",
    category: "Settings",
    body: "Your store is part of the Afterroar network. Customers who link their Afterroar accounts earn reputation and loyalty points that work across all Afterroar stores. Events you create show up in the Afterroar app for players nearby.",
  },
  // Troubleshooting
  {
    id: "scanner-not-working",
    title: "Scanner not working",
    category: "Troubleshooting",
    body: "First, make sure the scanner is plugged in and the register page is open. The scanner works by typing characters rapidly — if another input is focused, the scan might go into the wrong field. Tap somewhere neutral on the register first, then scan.",
    tips: ["Try scanning a known barcode to test.", "Some scanners need a prefix/suffix configured — the system expects barcodes to end with Enter."],
  },
  {
    id: "payment-failed",
    title: "Payment failed",
    category: "Troubleshooting",
    body: "If a card payment fails, check that Stripe is connected in Settings. For simulated payments (when Stripe isn't connected), payments should always succeed — if they don't, check your network connection. Cash and store credit payments work offline.",
  },
  {
    id: "keyboard-issues",
    title: "Keyboard issues",
    category: "Troubleshooting",
    body: "The register uses keyboard shortcuts (like typing to search). If shortcuts are interfering with text input, make sure you're clicked into an input field. All input fields in the app prevent shortcut conflicts by stopping key event propagation.",
  },
];

const CATEGORIES = [
  "Getting Started",
  "Register",
  "Inventory",
  "TCG Singles",
  "Events",
  "Trade-Ins",
  "Reports",
  "Settings",
  "Troubleshooting",
];

/* ------------------------------------------------------------------ */
/*  Help Center Page                                                    */
/* ------------------------------------------------------------------ */
export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const filtered = ARTICLES.filter((a) => {
    if (selectedCategory && a.category !== selectedCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by category
  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    articles: filtered.filter((a) => a.category === cat),
  })).filter((g) => g.articles.length > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <PageHeader title="Help Center" backHref="/dashboard" />

      {/* Search */}
      <input
        type="text"
        placeholder="Search help articles..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full rounded-xl border border-input-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />

      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            !selectedCategory ? "bg-accent text-foreground" : "bg-card-hover text-muted hover:text-foreground"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat ? "bg-accent text-foreground" : "bg-card-hover text-muted hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Articles */}
      {grouped.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted text-sm">No articles match your search.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.category}>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2 px-1">
                {group.category}
              </h2>
              <div className="rounded-xl border border-card-border bg-card divide-y divide-card-border overflow-hidden">
                {group.articles.map((article) => (
                  <div key={article.id}>
                    <button
                      onClick={() => setExpandedArticle(expandedArticle === article.id ? null : article.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-card-hover transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">{article.title}</span>
                      <span className="text-muted text-xs shrink-0 ml-2">
                        {expandedArticle === article.id ? "\u25B2" : "\u25BC"}
                      </span>
                    </button>
                    {expandedArticle === article.id && (
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-sm text-muted leading-relaxed">{article.body}</p>
                        {article.tips && article.tips.length > 0 && (
                          <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 space-y-1.5">
                            <div className="text-xs font-semibold text-accent">Tips</div>
                            {article.tips.map((tip, i) => (
                              <div key={i} className="text-xs text-muted leading-relaxed flex items-start gap-2">
                                <span className="text-accent shrink-0 mt-0.5">&#8226;</span>
                                <span>{tip}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
