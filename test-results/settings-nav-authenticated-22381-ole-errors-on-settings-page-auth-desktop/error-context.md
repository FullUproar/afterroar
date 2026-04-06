# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-nav.spec.ts >> authenticated: settings navigation >> no console errors on settings page
- Location: tests\settings-nav.spec.ts:83:7

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
          - button "Reports ▸" [ref=e31]:
            - generic [ref=e32]: Reports
            - generic [ref=e33]: ▸
          - generic:
            - link "⌂ Dashboard":
              - /url: /dashboard
              - generic: ⌂
              - generic: Dashboard
            - link "◩ Reports":
              - /url: /dashboard/reports
              - generic: ◩
              - generic: Reports
            - link "▣ Inventory Health":
              - /url: /dashboard/reports/inventory-health
              - generic: ▣
              - generic: Inventory Health
            - link "◆ Sales Analysis":
              - /url: /dashboard/reports/sales
              - generic: ◆
              - generic: Sales Analysis
            - link "△ Margins":
              - /url: /dashboard/reports/margins
              - generic: △
              - generic: Margins
            - link "⊞ Staff Performance":
              - /url: /dashboard/reports/staff
              - generic: ⊞
              - generic: Staff Performance
            - link "◎ Channels":
              - /url: /dashboard/reports/channels
              - generic: ◎
              - generic: Channels
            - link "◎ Cash Flow":
              - /url: /dashboard/cash-flow
              - generic: ◎
              - generic: Cash Flow
        - generic [ref=e34]:
          - button "Afterroar Network ▸" [ref=e35]:
            - generic [ref=e36]: Afterroar Network
            - generic [ref=e37]: ▸
          - generic:
            - link "◉ Network":
              - /url: /dashboard/network
              - generic: ◉
              - generic: Network
        - generic [ref=e38]:
          - button "Admin ▾" [ref=e39]:
            - generic [ref=e40]: Admin
            - generic [ref=e41]: ▾
          - generic [ref=e42]:
            - link "⊞ Staff" [ref=e43] [cursor=pointer]:
              - /url: /dashboard/staff
              - generic [ref=e44]: ⊞
              - generic [ref=e45]: Staff
            - link "◈ Subscription" [ref=e46] [cursor=pointer]:
              - /url: /dashboard/billing
              - generic [ref=e47]: ◈
              - generic [ref=e48]: Subscription
            - link "⚙ Settings" [ref=e49] [cursor=pointer]:
              - /url: /dashboard/settings
              - generic [ref=e50]: ⚙
              - generic [ref=e51]: Settings
            - link "⤓ Import" [ref=e52] [cursor=pointer]:
              - /url: /dashboard/import
              - generic [ref=e53]: ⤓
              - generic [ref=e54]: Import
            - link "◷ Time Clock" [ref=e55] [cursor=pointer]:
              - /url: /dashboard/timeclock
              - generic [ref=e56]: ◷
              - generic [ref=e57]: Time Clock
            - link "✦ Promotions" [ref=e58] [cursor=pointer]:
              - /url: /dashboard/promotions
              - generic [ref=e59]: ✦
              - generic [ref=e60]: Promotions
            - link "◌ Preorders" [ref=e61] [cursor=pointer]:
              - /url: /dashboard/preorders
              - generic [ref=e62]: ◌
              - generic [ref=e63]: Preorders
            - link "⚑ Issues" [ref=e64] [cursor=pointer]:
              - /url: /dashboard/issues
              - generic [ref=e65]: ⚑
              - generic [ref=e66]: Issues
            - link "◉ Ops Log" [ref=e67] [cursor=pointer]:
              - /url: /dashboard/ops-log
              - generic [ref=e68]: ◉
              - generic [ref=e69]: Ops Log
            - link "? Help" [ref=e70] [cursor=pointer]:
              - /url: /dashboard/help
              - generic [ref=e71]: "?"
              - generic [ref=e72]: Help
        - link "▤ Cafe" [ref=e73] [cursor=pointer]:
          - /url: /dashboard/cafe
          - generic [ref=e74]: ▤
          - text: Cafe
      - generic [ref=e75]:
        - paragraph [ref=e76]: Bot Owner · owner
        - button "Sign out" [ref=e77]
        - button "Register Mode" [ref=e78]
    - main [ref=e79]:
      - generic [ref=e80]:
        - generic [ref=e82]:
          - generic [ref=e84]: Online
          - generic [ref=e85]: Building offline cache...
        - button "Notifications" [ref=e87]:
          - img [ref=e88]
          - generic [ref=e90]: "5"
      - generic [ref=e92]:
        - heading "Settings" [level=1] [ref=e95]
        - paragraph [ref=e96]: Full Uproar Games & Café· Changes save automatically
        - navigation [ref=e98]:
          - button "⌂ Store" [ref=e99]:
            - generic [ref=e100]: ⌂
            - text: Store
          - button "◈ Payments" [ref=e101]:
            - generic [ref=e102]: ◈
            - text: Payments
          - button "⊞ Staff" [ref=e103]:
            - generic [ref=e104]: ⊞
            - text: Staff
          - button "◎ Integrations" [ref=e105]:
            - generic [ref=e106]: ◎
            - text: Integrations
          - button "◉ Intelligence" [ref=e107]:
            - generic [ref=e108]: ◉
            - text: Intelligence
          - button "⚙ Operations" [ref=e109]:
            - generic [ref=e110]: ⚙
            - text: Operations
        - paragraph [ref=e111]: Your store identity, tax, checkout, and receipt settings
        - generic [ref=e112]:
          - generic [ref=e113]:
            - generic [ref=e114]:
              - generic [ref=e115]:
                - heading "Store Identity" [level=2] [ref=e116]
                - paragraph [ref=e117]: How your store appears on receipts and to customers
              - button "Reset to defaults" [ref=e118]
            - generic [ref=e119]:
              - generic [ref=e120]:
                - generic [ref=e121]: Display Name
                - textbox "Defaults to store name" [ref=e123]
              - generic [ref=e124]:
                - generic [ref=e125]: Store Phone
                - textbox "e.g. (503) 555-0100" [ref=e127]
              - generic [ref=e128]:
                - generic [ref=e129]: Website
                - textbox "e.g. www.yourstore.com" [ref=e131]
              - generic [ref=e132]:
                - generic [ref=e133]:
                  - text: Receipt Address
                  - button "Help" [ref=e135]: "?"
                - textbox "e.g. 123 Main St, City, ST 12345" [ref=e137]
              - generic [ref=e138]:
                - generic [ref=e139]: Receipt Footer
                - textbox "e.g. Thank you for shopping with us!" [ref=e141]: Thank you for shopping with us!
              - generic [ref=e142]:
                - generic [ref=e143]: Show barcode on printed receipts
                - button [ref=e145]
              - generic [ref=e147]:
                - generic [ref=e148]: Show 'You saved $X' on receipts
                - button [ref=e150]
              - generic [ref=e152]:
                - generic [ref=e153]: Show return policy on receipts
                - button [ref=e155]
              - generic [ref=e157]:
                - generic [ref=e158]: Return Policy Text
                - textbox "Returns accepted within 30 days with receipt." [ref=e160]
          - generic [ref=e161]:
            - generic [ref=e162]:
              - generic [ref=e163]:
                - heading "Trade-Ins" [level=2] [ref=e164]
                - paragraph [ref=e165]: Default settings for the trade-in workflow
              - button "Reset to defaults" [ref=e166]
            - generic [ref=e167]:
              - generic [ref=e168]:
                - generic [ref=e169]:
                  - text: Default Credit Bonus %
                  - button "Help" [ref=e171]: "?"
                - spinbutton [ref=e173]: "30"
              - generic [ref=e174]:
                - generic [ref=e175]: Require customer for trade-ins
                - button [ref=e177]
          - generic [ref=e179]:
            - generic [ref=e180]:
              - generic [ref=e181]:
                - heading "Returns" [level=2] [ref=e182]
                - paragraph [ref=e183]: Default settings for processing returns
              - button "Reset to defaults" [ref=e184]
            - generic [ref=e185]:
              - generic [ref=e186]:
                - generic [ref=e187]: Default Credit Bonus %
                - spinbutton [ref=e189]: "0"
              - generic [ref=e190]:
                - generic [ref=e191]: Default Restocking Fee %
                - spinbutton [ref=e193]: "0"
              - generic [ref=e194]:
                - generic [ref=e195]: Return Window (days)
                - spinbutton [ref=e197]: "30"
              - generic [ref=e198]:
                - generic [ref=e199]: Require reason for returns
                - button [ref=e201]
          - generic [ref=e203]:
            - generic [ref=e204]:
              - generic [ref=e205]:
                - heading "Checkout" [level=2] [ref=e206]
                - paragraph [ref=e207]: How the register behaves during sales
              - button "Reset to defaults" [ref=e208]
            - generic [ref=e209]:
              - generic [ref=e210]:
                - generic [ref=e211]: Require customer for every sale
                - button [ref=e213]
              - generic [ref=e215]:
                - generic [ref=e216]: Auto-print receipt after sale
                - button [ref=e218]
              - generic [ref=e220]:
                - generic [ref=e221]: Default Payment Method
                - combobox [ref=e223]:
                  - option "Cash" [selected]
                  - option "Card"
                  - option "Store Credit"
          - generic [ref=e224]:
            - generic [ref=e225]:
              - generic [ref=e226]:
                - heading "Tax" [level=2] [ref=e227]
                - paragraph [ref=e228]: Sales tax configuration
              - button "Reset to defaults" [ref=e229]
            - generic [ref=e230]:
              - generic [ref=e231]:
                - generic [ref=e232]:
                  - text: Tax Rate %
                  - button "Help" [ref=e234]: "?"
                - spinbutton [ref=e236]: "7"
              - generic [ref=e237]:
                - generic [ref=e238]:
                  - text: Tax is included in listed prices
                  - button "Help" [ref=e240]: "?"
                - button [ref=e242]
          - generic [ref=e244]:
            - generic [ref=e245]:
              - generic [ref=e246]:
                - heading "Inventory" [level=2] [ref=e247]
                - paragraph [ref=e248]: Default inventory behavior
              - button "Reset to defaults" [ref=e249]
            - generic [ref=e251]:
              - generic [ref=e252]: Default Low Stock Threshold
              - spinbutton [ref=e254]: "5"
  - alert [ref=e255]
```

# Test source

```ts
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
  80  |     expect(critical).toEqual([]);
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
> 111 |     expect(criticalErrors).toEqual([]);
      |                            ^ Error: expect(received).toEqual(expected) // deep equality
  112 |   });
  113 | });
  114 | 
```