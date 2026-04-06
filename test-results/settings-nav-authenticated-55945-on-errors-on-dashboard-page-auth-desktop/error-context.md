# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-nav.spec.ts >> authenticated: settings navigation >> no hydration errors on dashboard page
- Location: tests\settings-nav.spec.ts:70:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "PAGE_ERROR: Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]: Training Mode — Transactions are not real
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic [ref=e6]:
        - heading "Afterroar" [level=1] [ref=e7]
        - paragraph [ref=e8]: Full Uproar Games & Café
      - navigation [ref=e9]:
        - generic [ref=e10]:
          - button "POS ▸" [ref=e11]:
            - generic [ref=e12]: POS
            - generic [ref=e13]: ▸
          - generic:
            - link "◈ Register":
              - /url: /dashboard/register
              - generic: ◈
              - generic: Register
            - link "▣ Drawer":
              - /url: /dashboard/drawer
              - generic: ▣
              - generic: Drawer
            - link "⊟ Orders":
              - /url: /dashboard/orders
              - generic: ⊟
              - generic: Orders
            - link "▶ Fulfillment":
              - /url: /dashboard/fulfillment
              - generic: ▶
              - generic: Fulfillment
        - generic [ref=e14]:
          - button "Inventory ▸" [ref=e15]:
            - generic [ref=e16]: Inventory
            - generic [ref=e17]: ▸
          - generic:
            - link "▦ Inventory":
              - /url: /dashboard/inventory
              - generic: ▦
              - generic: Inventory
            - link "♠ TCG Singles":
              - /url: /dashboard/singles
              - generic: ♠
              - generic: TCG Singles
            - link "♦ Deck Builder":
              - /url: /dashboard/deck-builder
              - generic: ♦
              - generic: Deck Builder
            - link "♜ Game Library":
              - /url: /dashboard/game-library
              - generic: ♜
              - generic: Game Library
            - link "◇ Consignment":
              - /url: /dashboard/consignment
              - generic: ◇
              - generic: Consignment
            - link "▤ Stock Count":
              - /url: /dashboard/stock-counts
              - generic: ▤
              - generic: Stock Count
            - link "⊡ Locations":
              - /url: /dashboard/locations
              - generic: ⊡
              - generic: Locations
            - link "⇆ Transfers":
              - /url: /dashboard/transfers
              - generic: ⇆
              - generic: Transfers
        - generic [ref=e18]:
          - button "Customers ▸" [ref=e19]:
            - generic [ref=e20]: Customers
            - generic [ref=e21]: ▸
          - generic:
            - link "♟ Customers":
              - /url: /dashboard/customers
              - generic: ♟
              - generic: Customers
            - link "◎ Customer Insights":
              - /url: /dashboard/customers/insights
              - generic: ◎
              - generic: Customer Insights
            - link "◆ Gift Cards":
              - /url: /dashboard/gift-cards
              - generic: ◆
              - generic: Gift Cards
        - generic [ref=e22]:
          - button "Events ▸" [ref=e23]:
            - generic [ref=e24]: Events
            - generic [ref=e25]: ▸
          - generic:
            - link "★ Events":
              - /url: /dashboard/events
              - generic: ★
              - generic: Events
            - link "⊕ Tournaments":
              - /url: /dashboard/tournaments
              - generic: ⊕
              - generic: Tournaments
        - generic [ref=e26]:
          - button "Trade & Returns ▸" [ref=e27]:
            - generic [ref=e28]: Trade & Returns
            - generic [ref=e29]: ▸
          - generic:
            - link "⇄ Trade-Ins":
              - /url: /dashboard/trade-ins
              - generic: ⇄
              - generic: Trade-Ins
            - link "↩ Returns":
              - /url: /dashboard/returns
              - generic: ↩
              - generic: Returns
        - generic [ref=e30]:
          - button "Reports ▾" [ref=e31]:
            - generic [ref=e32]: Reports
            - generic [ref=e33]: ▾
          - generic [ref=e34]:
            - link "⌂ Dashboard" [ref=e35] [cursor=pointer]:
              - /url: /dashboard
              - generic [ref=e36]: ⌂
              - generic [ref=e37]: Dashboard
            - link "◩ Reports" [ref=e38] [cursor=pointer]:
              - /url: /dashboard/reports
              - generic [ref=e39]: ◩
              - generic [ref=e40]: Reports
            - link "▣ Inventory Health" [ref=e41] [cursor=pointer]:
              - /url: /dashboard/reports/inventory-health
              - generic [ref=e42]: ▣
              - generic [ref=e43]: Inventory Health
            - link "◆ Sales Analysis" [ref=e44] [cursor=pointer]:
              - /url: /dashboard/reports/sales
              - generic [ref=e45]: ◆
              - generic [ref=e46]: Sales Analysis
            - link "△ Margins" [ref=e47] [cursor=pointer]:
              - /url: /dashboard/reports/margins
              - generic [ref=e48]: △
              - generic [ref=e49]: Margins
            - link "⊞ Staff Performance" [ref=e50] [cursor=pointer]:
              - /url: /dashboard/reports/staff
              - generic [ref=e51]: ⊞
              - generic [ref=e52]: Staff Performance
            - link "◎ Channels" [ref=e53] [cursor=pointer]:
              - /url: /dashboard/reports/channels
              - generic [ref=e54]: ◎
              - generic [ref=e55]: Channels
            - link "◎ Cash Flow" [ref=e56] [cursor=pointer]:
              - /url: /dashboard/cash-flow
              - generic [ref=e57]: ◎
              - generic [ref=e58]: Cash Flow
        - generic [ref=e59]:
          - button "Afterroar Network ▸" [ref=e60]:
            - generic [ref=e61]: Afterroar Network
            - generic [ref=e62]: ▸
          - generic:
            - link "◉ Network":
              - /url: /dashboard/network
              - generic: ◉
              - generic: Network
        - generic [ref=e63]:
          - button "Admin ▸" [ref=e64]:
            - generic [ref=e65]: Admin
            - generic [ref=e66]: ▸
          - generic:
            - link "⊞ Staff":
              - /url: /dashboard/staff
              - generic: ⊞
              - generic: Staff
            - link "◈ Subscription":
              - /url: /dashboard/billing
              - generic: ◈
              - generic: Subscription
            - link "⚙ Settings":
              - /url: /dashboard/settings
              - generic: ⚙
              - generic: Settings
            - link "⤓ Import":
              - /url: /dashboard/import
              - generic: ⤓
              - generic: Import
            - link "◷ Time Clock":
              - /url: /dashboard/timeclock
              - generic: ◷
              - generic: Time Clock
            - link "✦ Promotions":
              - /url: /dashboard/promotions
              - generic: ✦
              - generic: Promotions
            - link "◌ Preorders":
              - /url: /dashboard/preorders
              - generic: ◌
              - generic: Preorders
            - link "⚑ Issues":
              - /url: /dashboard/issues
              - generic: ⚑
              - generic: Issues
            - link "◉ Ops Log":
              - /url: /dashboard/ops-log
              - generic: ◉
              - generic: Ops Log
            - link "? Help":
              - /url: /dashboard/help
              - generic: "?"
              - generic: Help
        - link "▤ Cafe" [ref=e67] [cursor=pointer]:
          - /url: /dashboard/cafe
          - generic [ref=e68]: ▤
          - text: Cafe
      - generic [ref=e69]:
        - paragraph [ref=e70]: Bot Owner · owner
        - button "Sign out" [ref=e71]
        - button "Register Mode" [ref=e72]
    - main [ref=e73]:
      - generic [ref=e74]:
        - generic [ref=e76]:
          - generic [ref=e78]: Online
          - generic [ref=e79]: Building offline cache...
        - button "Notifications" [ref=e81]:
          - img [ref=e82]
          - generic [ref=e84]: "5"
      - generic [ref=e86]:
        - generic [ref=e87]:
          - generic [ref=e88]:
            - generic [ref=e89]:
              - heading "Good evening, Bot" [level=2] [ref=e90]
              - paragraph [ref=e91]: Updated 6:13 PM
            - button "Refresh" [ref=e92]:
              - generic [ref=e93]: ↻
              - generic [ref=e94]: Refresh
          - generic [ref=e95]:
            - generic [ref=e97]:
              - generic [ref=e98]: 🚨
              - generic [ref=e99]:
                - heading "32 items running low" [level=3] [ref=e100]
                - paragraph [ref=e101]: Stitch - Rock Star (Enchanted) is most urgent — 1 left, selling 2.3/week. Order by Tuesday or you'll be out. 31 more also need attention.
                - link "Create Purchase Order" [ref=e102] [cursor=pointer]:
                  - /url: /dashboard/purchase-orders
                  - text: Create Purchase Order
                  - generic [ref=e103]: →
              - generic [ref=e104]: "32"
            - generic [ref=e106]:
              - generic [ref=e107]: 📦
              - generic [ref=e108]:
                - heading "$120.00 sitting on the bench" [level=3] [ref=e109]
                - paragraph [ref=e110]: 1 item with zero sales in 30+ days. That's cash trapped on your shelves doing nothing. Mark these down, bundle them, or run a clearance event to free up buying power.
                - link "Run a Promotion" [ref=e111] [cursor=pointer]:
                  - /url: /dashboard/promotions
                  - text: Run a Promotion
                  - generic [ref=e112]: →
              - generic [ref=e113]: $120.00
            - generic [ref=e115]:
              - generic [ref=e116]: 👁️
              - generic [ref=e117]:
                - heading "Noah Williams hasn't been in for 2 weeks" [level=3] [ref=e118]
                - paragraph [ref=e119]: Noah Williams has spent $283.95 lifetime but hasn't been around in 14 days. A text or shout-out at the next event could bring them back.
                - link "View Customers" [ref=e120] [cursor=pointer]:
                  - /url: /dashboard/customers
                  - text: View Customers
                  - generic [ref=e121]: →
              - generic [ref=e122]: "1"
            - generic [ref=e124]:
              - generic [ref=e125]: 💰
              - generic [ref=e126]:
                - heading "$2415.00 in credit collecting dust" [level=3] [ref=e127]
                - paragraph [ref=e128]: 8 customers have credit sitting for 30+ days. That's potential revenue just waiting for a nudge. "Hey, you've got $2415 in credit — new set drops Friday!"
                - link "View Customers" [ref=e129] [cursor=pointer]:
                  - /url: /dashboard/customers
                  - text: View Customers
                  - generic [ref=e130]: →
              - generic [ref=e131]: $2415.00
          - link "View all 15 insights →" [ref=e133] [cursor=pointer]:
            - /url: /dashboard/cash-flow
        - button "🧠 Store Advisor Ask anything about your business" [ref=e135]:
          - generic [ref=e136]:
            - generic [ref=e137]: 🧠
            - generic [ref=e138]:
              - heading "Store Advisor" [level=3] [ref=e139]
              - paragraph [ref=e140]: Ask anything about your business
          - generic [ref=e141]: ▼
        - generic [ref=e142]:
          - generic [ref=e143]:
            - heading "Today" [level=3] [ref=e144]
            - generic [ref=e145]:
              - generic [ref=e146]:
                - generic [ref=e147]: Sales
                - generic [ref=e148]: "0"
              - generic [ref=e149]:
                - generic [ref=e150]: Revenue
                - generic [ref=e151]: $0.00
              - generic [ref=e152]:
                - generic [ref=e153]: Upcoming Events
                - generic [ref=e154]: "1"
            - link "View full cash flow →" [ref=e155] [cursor=pointer]:
              - /url: /dashboard/cash-flow
          - generic [ref=e156]:
            - heading "Recent Activity" [level=3] [ref=e157]
            - table [ref=e159]:
              - rowgroup [ref=e160]:
                - row "Date Type Description Amount" [ref=e161]:
                  - columnheader "Date" [ref=e162]
                  - columnheader "Type" [ref=e163]
                  - columnheader "Description" [ref=e164]
                  - columnheader "Amount" [ref=e165]
              - rowgroup [ref=e166]:
                - 'row "4/4/2026 sale Sale: Catan x1 $44.99" [ref=e167]':
                  - cell "4/4/2026" [ref=e168]
                  - cell "sale" [ref=e169]
                  - 'cell "Sale: Catan x1" [ref=e170]'
                  - cell "$44.99" [ref=e171]
                - 'row "4/3/2026 gift_card_sale Gift card sold: 4EET-T3QN-JF8G-3TD2 $2500.00" [ref=e172]':
                  - cell "4/3/2026" [ref=e173]
                  - cell "gift_card_sale" [ref=e174]
                  - 'cell "Gift card sold: 4EET-T3QN-JF8G-3TD2" [ref=e175]'
                  - cell "$2500.00" [ref=e176]
                - 'row "4/3/2026 sale Sale: Ragavan, Nimble Pilferer x1 $71.50" [ref=e177]':
                  - cell "4/3/2026" [ref=e178]
                  - cell "sale" [ref=e179]
                  - 'cell "Sale: Ragavan, Nimble Pilferer x1" [ref=e180]'
                  - cell "$71.50" [ref=e181]
                - 'row "4/3/2026 sale Sale: Ticket to Ride x1 $44.99" [ref=e182]':
                  - cell "4/3/2026" [ref=e183]
                  - cell "sale" [ref=e184]
                  - 'cell "Sale: Ticket to Ride x1" [ref=e185]'
                  - cell "$44.99" [ref=e186]
                - 'row "4/3/2026 sale Sale: Ticket to Ride x1 $44.99" [ref=e187]':
                  - cell "4/3/2026" [ref=e188]
                  - cell "sale" [ref=e189]
                  - 'cell "Sale: Ticket to Ride x1" [ref=e190]'
                  - cell "$44.99" [ref=e191]
                - 'row "4/3/2026 sale Sale: Drip Coffee (12oz) x1 $3.00" [ref=e192]':
                  - cell "4/3/2026" [ref=e193]
                  - cell "sale" [ref=e194]
                  - 'cell "Sale: Drip Coffee (12oz) x1" [ref=e195]'
                  - cell "$3.00" [ref=e196]
                - 'row "4/3/2026 sale Sale: Drip Coffee (12oz) x2, Monster Energy x1 $9.50" [ref=e197]':
                  - cell "4/3/2026" [ref=e198]
                  - cell "sale" [ref=e199]
                  - 'cell "Sale: Drip Coffee (12oz) x2, Monster Energy x1" [ref=e200]'
                  - cell "$9.50" [ref=e201]
                - 'row "4/3/2026 sale Sale: Wingspan x1 $64.99" [ref=e202]':
                  - cell "4/3/2026" [ref=e203]
                  - cell "sale" [ref=e204]
                  - 'cell "Sale: Wingspan x1" [ref=e205]'
                  - cell "$64.99" [ref=e206]
        - button "🌙 End of Day Summary" [ref=e207]:
          - generic [ref=e208]: 🌙
          - generic [ref=e209]: End of Day Summary
  - alert [ref=e210]
```

# Test source

```ts
  1   | /**
  2   |  * Settings Navigation Test
  3   |  *
  4   |  * Reproduces the hydration bug where navigating TO settings works,
  5   |  * but navigating AWAY is impossible (React tree dies).
  6   |  *
  7   |  * Run: npx playwright test tests/settings-nav.spec.ts --project=auth-desktop
  8   |  */
  9   | import { test, expect } from "@playwright/test";
  10  | 
  11  | test.describe("authenticated: settings navigation", () => {
  12  |   test("can navigate to settings and back to dashboard", async ({ page }) => {
  13  |     // Start at dashboard
  14  |     await page.goto("/dashboard", { waitUntil: "networkidle" });
  15  |     await expect(page).toHaveURL(/dashboard/);
  16  | 
  17  |     // Navigate to settings — use direct navigation since sidebar scrolling
  18  |     // can have overlapping group headers at certain viewport sizes
  19  |     await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  20  | 
  21  |     // Wait for settings page to fully render (not just "Loading settings...")
  22  |     await expect(page.locator("text=Changes save automatically")).toBeVisible({ timeout: 10_000 });
  23  | 
  24  |     // Now try to navigate away — this is what breaks
  25  |     // Use JS navigation to avoid sidebar overlap issues at test viewport size
  26  |     await page.evaluate(() => {
  27  |       const link = document.querySelector('a[href="/dashboard"]') as HTMLAnchorElement;
  28  |       if (link) link.click();
  29  |     });
  30  | 
  31  |     // If we can reach dashboard URL, navigation works
  32  |     await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });
  33  |     await expect(page).toHaveURL(/\/dashboard$/);
  34  |   });
  35  | 
  36  |   test("can navigate to settings and to inventory", async ({ page }) => {
  37  |     await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  38  | 
  39  |     // Wait for settings to load
  40  |     await expect(page.locator("text=Changes save automatically")).toBeVisible({ timeout: 10_000 });
  41  | 
  42  |     // Navigate to inventory via JS click (avoids sidebar overlap at test viewport)
  43  |     await page.evaluate(() => {
  44  |       const link = document.querySelector('a[href="/dashboard/inventory"]') as HTMLAnchorElement;
  45  |       if (link) link.click();
  46  |     });
  47  |     await page.waitForURL("**/dashboard/inventory**", { timeout: 10_000 });
  48  |     await expect(page).toHaveURL(/inventory/);
  49  |   });
  50  | 
  51  |   test("can switch settings tabs without breaking navigation", async ({ page }) => {
  52  |     await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  53  |     await expect(page.locator("text=Changes save automatically")).toBeVisible({ timeout: 10_000 });
  54  | 
  55  |     // Click through each tab
  56  |     for (const tab of ["Payments", "Staff", "Integrations", "Intelligence", "Operations", "Store"]) {
  57  |       await page.getByRole("button", { name: tab }).click();
  58  |       await page.waitForTimeout(500);
  59  |     }
  60  | 
  61  |     // Now navigate away via JS click
  62  |     await page.evaluate(() => {
  63  |       const link = document.querySelector('a[href="/dashboard"]') as HTMLAnchorElement;
  64  |       if (link) link.click();
  65  |     });
  66  |     await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });
  67  |     await expect(page).toHaveURL(/\/dashboard$/);
  68  |   });
  69  | 
  70  |   test("no hydration errors on dashboard page", async ({ page }) => {
  71  |     const errors: string[] = [];
  72  |     page.on("pageerror", (err) => errors.push(`PAGE_ERROR: ${err.message}`));
  73  | 
  74  |     await page.goto("/dashboard", { waitUntil: "networkidle" });
  75  |     await page.waitForTimeout(3000);
  76  | 
  77  |     const critical = errors.filter((e) => e.includes("418") || e.includes("Hydration"));
  78  |     console.log("=== DASHBOARD ERRORS ===");
  79  |     errors.forEach((e) => console.log("  ", e.slice(0, 200)));
> 80  |     expect(critical).toEqual([]);
      |                      ^ Error: expect(received).toEqual(expected) // deep equality
  81  |   });
  82  | 
  83  |   test("no console errors on settings page", async ({ page }) => {
  84  |     const errors: string[] = [];
  85  |     const warnings: string[] = [];
  86  |     page.on("console", (msg) => {
  87  |       if (msg.type() === "error") errors.push(msg.text());
  88  |       if (msg.type() === "warning") warnings.push(msg.text());
  89  |     });
  90  |     page.on("pageerror", (err) => errors.push(`PAGE_ERROR: ${err.message}`));
  91  | 
  92  |     await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  93  |     await expect(page.locator("text=Changes save automatically")).toBeVisible({ timeout: 10_000 });
  94  | 
  95  |     // Wait a bit for any delayed errors
  96  |     await page.waitForTimeout(3000);
  97  | 
  98  |     // Log ALL errors and warnings for debugging
  99  |     console.log("=== CONSOLE ERRORS ===");
  100 |     errors.forEach((e) => console.log("  ERROR:", e.slice(0, 200)));
  101 |     console.log("=== CONSOLE WARNINGS ===");
  102 |     warnings.forEach((w) => console.log("  WARN:", w.slice(0, 200)));
  103 | 
  104 |     // Check for hydration or React errors
  105 |     const criticalErrors = errors.filter(
  106 |       (e) => e.includes("Hydration") || e.includes("hydration") || e.includes("did not match")
  107 |         || e.includes("mismatch") || e.includes("Minified React") || e.includes("PAGE_ERROR")
  108 |         || e.includes("Cannot read") || e.includes("is not a function")
  109 |     );
  110 | 
  111 |     expect(criticalErrors).toEqual([]);
  112 |   });
  113 | });
  114 | 
```