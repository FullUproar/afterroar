# UX Audit — Afterroar Store Ops
**Date:** April 2, 2026
**Method:** Playwright desktop screenshots (1440x900), logged in as manager
**Reviewer:** Claude (without intent bias — observing what the UX communicates, not what was intended)

---

## Executive Summary

The product has deep functionality but suffers from **navigation overload** and **unclear user journeys**. There are 48 pages behind 7 sidebar groups with ~30 nav items. A new user would be overwhelmed. The core problem: **the UX treats every feature as equally important**, so nothing feels important.

### Top 5 Issues
1. **No clear primary action** — Dashboard shows data but doesn't tell you what to DO
2. **Sidebar is too deep** — 30 items across 7 groups, many empty/placeholder pages
3. **Duplicate/overlapping pages** — Catalog vs Singles, Reports vs Cash Flow, Timeclock vs Clock
4. **Permission walls shown as navigation** — Manager sees Staff, Settings in nav but gets "no permission" walls
5. **Empty states don't guide** — Many pages show "nothing here" without telling you how to get started

---

## Page-by-Page Analysis

### LOGIN
**What it drives:** Sign in (clear, single-purpose)
**What's good:** Clean, focused, two auth methods, "Create account" link
**Issues:** "Forgot password?" link — does this actually work? Needs verification. No branding/value prop — if this is someone's first time, they see nothing about what the product does.

### OPS LANDING (/ops)
**What it drives:** Nothing — "Future home of the best friendly local POS..." with a countdown
**Issue:** Dead page. Either build a proper landing or redirect to /login.

### DASHBOARD
**What it drives:** Reading — 4 insight cards, stats tiles, Store Advisor (collapsed)
**What's good:** Intelligence feed with actionable language, time-of-day greeting, "View all" link
**Issues:**
- No primary CTA. After reading insights, what should the owner DO? There's no "Open Register" or "View What Needs Reordering" button.
- Store Advisor is the most powerful feature but it's collapsed and visually recessed
- Stats tiles (65 sales, 33 this month, 0 today, 3 events) are raw numbers with no context. "0 today" is alarming if it's 2am but fine. No time context.
- "Recent Activity" section below the fold — who is this for?
- The green "Online · Building offline cache" banner takes prime real estate at the top

### REGISTER
**What it drives:** Scanning/searching items (correct)
**What's good:** Clean empty state "Scan or search to add items", clear header with store name, staff name, role
**Issues:**
- Icon-only action bar (magnifying glass, clipboard, person, lightning, pencil, %, ...) — not obvious what each does without trial-and-error
- No quick-access to common items (favorites/quick keys visible only after tapping)
- "PAY" button at bottom is disabled/grey when cart is empty — correct but could guide: "Add items to start a sale"
- "Guest" in bottom left is subtle — new cashier wouldn't know this is where customer association happens
- TEST MODE badge is orange/prominent — good for dev, needs to be off in prod

### INVENTORY
**What it drives:** Browsing/searching inventory
**What's good:** Clean table layout, search bar, "Print Labels" and "Scan to Add" buttons
**Issues:**
- Table columns are dense — Name, Category, Price, Cost, Qty, Margin, Barcode on one row
- No quick filters visible (by category, by stock status)
- "Scan to Add" as a small button — this is a primary workflow, should be more prominent
- Can't tell at a glance which items need attention (low stock, dead stock)

### TCG SINGLES
**What it drives:** Browsing TCG inventory with inline editing
**What's good:** Game filter tabs (MTG, Pokemon, etc.), sort options, inline price editing
**Issues:** Redundant with Inventory page for TCG items. User has to know to come here vs Inventory.

### CATALOG (Scryfall)
**What it drives:** Searching for MTG cards to add to inventory
**What's good:** Scryfall integration is powerful when you know to use it
**Issues:** "Catalog" is a terrible name for "Add Cards from Scryfall." Should be merged into TCG Singles as an "Add Cards" button.

### GAME LIBRARY
**What it drives:** Managing lendable board games
**What's good:** Clear empty state with instructions
**Issues:** Very niche feature taking a full sidebar slot. Most stores won't use this.

### PURCHASE ORDERS / STOCK COUNTS / LOCATIONS / TRANSFERS
**What they drive:** Various inventory operations
**Issues:** All shown in sidebar even when empty/unused. These are secondary workflows that clutter the nav. Only ~20% of stores will use multi-location.

### CUSTOMERS
**What it drives:** Browsing customer list with segment filters
**What's good:** Segment pills (All, VIP, Regular, New, At Risk, Dormant), search, "Add Customer" CTA
**Issues:**
- Segment badges on each row (colored pills) are visually noisy
- No quick action from the list (send message, view credit, view history) — have to click into detail
- Sort by "Lifetime Spend" or "Last Purchase" would surface who matters

### EVENTS
**What it drives:** Viewing event list
**What's good:** Clean table with dates, types, entry fees, player counts, status indicators
**Issues:**
- "Create Event" button is orange (good) but small (top right)
- Past and future events mixed — no clear separation
- Status indicators (red/green dots) are small and unclear without hover
- No "what should I schedule next" guidance

### TRADE-INS (New)
**What it drives:** Step-by-step trade-in workflow
**What's good:** Clear 3-step wizard (Customer → Items → Complete), clean form
**Issues:** No back button visible in step 1. What if I picked the wrong customer?

### CASH FLOW INTELLIGENCE
**What it drives:** Understanding financial health
**What's good:** KPI cards at top (Capital, Revenue, Payouts, Net), Revenue Flow chart, period selector
**Issues:**
- Title "Cash Flow Intelligence" is vague — "Your Store's Financial Health" would be clearer
- Period selector (Today/Week/Month/Payouts) has inconsistent button styles
- Revenue Flow chart and Intelligence Feed both compete for the same attention
- Page is very long — requires 4-5 scrolls to see everything
- Inventory by Category + Fast Movers + Dead Stock + Margin Analysis + Trade-In ROI + Returns + Credit — too much for one page

### REPORTS (Event ROI)
**What it drives:** Viewing event performance table
**Issues:** Just a table. No insights, no charts, no guidance. This feels like a placeholder.

### SETTINGS
**What it drives:** Nothing — "You don't have permission to view settings."
**Issue:** The manager account SEES Settings in the nav but CAN'T access it. The nav item should be hidden for roles that can't access it. Showing it and then blocking is frustrating.

### STAFF
**What it drives:** Nothing — "You don't have permission to manage staff."
**Issue:** Same as Settings. Nav item visible but blocked.

### HELP CENTER
**What it drives:** Self-service learning
**What's good:** Searchable, categorized, 27+ articles, accordion format
**Issues:** This is actually really well done. One of the strongest pages in the app.

### CLOCK-IN PAGE (/clock/[slug])
**What it drives:** Employee time clock (correct)
**What's good:** Clean messaging — store name, "No staff PINs have been set up yet"
**Issues:** No way to get to this page from the main app. Owner needs to know the URL exists.

### MOBILE REGISTER (/mobile/[slug])
**What it drives:** Mobile POS pairing (correct)
**What's good:** Clear messaging — "Mobile register is not enabled for this store"
**Issues:** Same as clock — no discovery path from the main app.

---

## Structural Problems

### 1. Navigation Overload
**30 nav items** across 7 groups. A new store owner opening this for the first time sees:
POS (3), Inventory (9!), Customers (2), Events (2), Trade & Returns (2), Reports (2), Admin (10)

That's overwhelming. Most POS systems show 5-7 top-level items.

### 2. Features Shown Before They're Needed
- Locations, Transfers → only useful for multi-store (2% of users)
- Purchase Orders → only useful after inventory is set up
- Stock Counts → only useful for established stores
- Tournaments → only useful for competitive play stores
- eBay Listings → only useful for online sellers

These should be hidden until activated or behind the feature gate system.

### 3. Duplicate Paths
- **Inventory + TCG Singles + Catalog** = 3 pages for "manage your stuff"
- **Reports + Cash Flow** = 2 pages for "see your numbers"
- **Timeclock (dashboard) + Clock (mobile)** = 2 timeclock UIs
- **Trade-Ins list + New Trade-In + Bulk Trade-In** = 3 pages for one workflow

### 4. Permission Walls in Navigation
Manager sees Settings, Staff, Ops Log, Onboarding in the nav but gets "no permission" walls. These items should be hidden from roles that can't access them.

### 5. No Guided Onboarding
A new store with zero data sees empty states everywhere but no connected setup flow. The onboarding wizard exists but redirected to the dashboard in this test (possibly because the store has data already).

---

## What the UX Actually Drives (vs. What It Should)

| Journey | Current UX Drives | Should Drive |
|---------|------------------|--------------|
| Morning open | Read insights → ??? | Read insights → Open register → Clock in |
| Process a sale | Find register in sidebar → scan/search | One tap to register from anywhere |
| Check stock | Go to Inventory → search | Search from any page (global search) |
| Trade-in walk-up | Find Trade-Ins in sidebar → New | "Trade-In" button in register more menu (exists!) |
| End of day | ??? | Dashboard summary → review sales → clock out |
| "Am I ok?" | Go to Cash Flow → scroll | Dashboard shows one-number health score |
| Reorder stock | Intelligence says "X needs reordering" → ??? | Click insight → goes to PO pre-filled |
| Schedule event | Go to Events → Create Event | Intelligence says "no events this week" → Create Event |
| New employee | ??? | Settings → Staff → Add → Set PIN → Share clock link |

---

## Action Plan (Priority Order)

### P0: Fix Now (blocks basic usage)
1. **Hide nav items user can't access** — don't show Settings/Staff/Ops Log to managers/cashiers
2. **Fix /ops landing** — either build real landing page or redirect to /login
3. **Add "Open Register" CTA to dashboard** — biggest button, most obvious action

### P1: Simplify Navigation (next sprint)
4. **Collapse sidebar to group headers only** — sub-items show in main content area when group is clicked
5. **Hide features behind feature gates** — Locations, Transfers, Tournaments, eBay only show when enabled
6. **Merge Catalog into TCG Singles** — one page for all singles work
7. **Merge Reports into Cash Flow** — Event ROI becomes a tab/section in Cash Flow

### P2: Improve User Journeys (following sprint)
8. **Global search bar** — search inventory, customers, events from any page
9. **Connect insights to actions** — "X items need reordering" links to pre-filled PO, not just inventory list
10. **Dashboard health score** — single number/color that says "your store is fine" or "needs attention"
11. **End-of-day summary** — one-click daily close flow
12. **New employee setup wizard** — creates user, sets PIN, generates clock-in QR

### P3: Polish (ongoing)
13. **Register action bar labels** — tooltips at minimum, labels on tablet
14. **Empty states with CTAs** — every empty state should guide to the action that fills it
15. **Mobile clock/register discovery** — link in Settings and Staff pages to the `/clock` and `/mobile` URLs
16. **Consistent period selectors** — same component across Cash Flow, Reports, Dashboard
