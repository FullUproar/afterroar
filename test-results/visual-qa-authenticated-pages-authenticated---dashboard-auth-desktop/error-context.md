# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-qa.spec.ts >> authenticated pages >> authenticated - /dashboard
- Location: tests\visual-qa.spec.ts:85:9

# Error details

```
TimeoutError: page.goto: Timeout 30000ms exceeded.
Call log:
  - navigating to "https://www.afterroar.store/dashboard", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]: Training — Not Real
    - generic [ref=e5]:
      - complementary [ref=e6]:
        - generic [ref=e8]:
          - heading "Full Uproar Games & Café" [level=1] [ref=e9]
          - paragraph [ref=e10]: Afterroar Ops
        - link "◈ Open Register" [ref=e12] [cursor=pointer]:
          - /url: /dashboard/register
          - generic [ref=e13]: ◈
          - generic [ref=e14]: Open Register
        - navigation [ref=e15]:
          - generic [ref=e16]:
            - button "POS ▾" [ref=e17]:
              - generic [ref=e18]: POS
              - generic [ref=e19]: ▾
            - generic [ref=e20]:
              - link "⌂ Dashboard" [ref=e21] [cursor=pointer]:
                - /url: /dashboard
                - generic [ref=e22]: ⌂
                - generic [ref=e23]: Dashboard
              - link "◈ Register" [ref=e24] [cursor=pointer]:
                - /url: /dashboard/register
                - generic [ref=e25]: ◈
                - generic [ref=e26]: Register
              - link "▤ Cafe" [ref=e27] [cursor=pointer]:
                - /url: /dashboard/cafe
                - generic [ref=e28]: ▤
                - generic [ref=e29]: Cafe
              - link "▣ Drawer" [ref=e30] [cursor=pointer]:
                - /url: /dashboard/drawer
                - generic [ref=e31]: ▣
                - generic [ref=e32]: Drawer
              - link "⊟ Orders" [ref=e33] [cursor=pointer]:
                - /url: /dashboard/orders
                - generic [ref=e34]: ⊟
                - generic [ref=e35]: Orders
              - link "▶ Fulfillment" [ref=e36] [cursor=pointer]:
                - /url: /dashboard/fulfillment
                - generic [ref=e37]: ▶
                - generic [ref=e38]: Fulfillment
          - button "Inventory ▸" [ref=e40]:
            - generic [ref=e41]: Inventory
            - generic [ref=e42]: ▸
          - button "Customers ▸" [ref=e44]:
            - generic [ref=e45]: Customers
            - generic [ref=e46]: ▸
          - button "Events ▸" [ref=e48]:
            - generic [ref=e49]: Events
            - generic [ref=e50]: ▸
          - button "Trade & Returns ▸" [ref=e52]:
            - generic [ref=e53]: Trade & Returns
            - generic [ref=e54]: ▸
          - button "Intelligence ▸" [ref=e56]:
            - generic [ref=e57]: Intelligence
            - generic [ref=e58]: ▸
          - button "Afterroar Network ▸" [ref=e60]:
            - generic [ref=e61]: Afterroar Network
            - generic [ref=e62]: ▸
          - button "Admin ▸" [ref=e64]:
            - generic [ref=e65]: Admin
            - generic [ref=e66]: ▸
          - button "Settings ▸" [ref=e68]:
            - generic [ref=e69]: Settings
            - generic [ref=e70]: ▸
        - generic [ref=e71]:
          - paragraph [ref=e72]: Bot Owner · owner
          - button "Sign out" [ref=e73]
      - main [ref=e74]:
        - button "Notifications" [ref=e77]:
          - img [ref=e78]
          - generic [ref=e80]: "6"
        - generic [ref=e82]:
          - generic [ref=e83]:
            - generic [ref=e84]:
              - heading "Good morning, Bot" [level=2] [ref=e86]
              - button "Refresh" [ref=e87]:
                - generic [ref=e88]: ↻
                - generic [ref=e89]: Refresh
            - generic [ref=e90]:
              - paragraph [ref=e91]: ✨
              - paragraph [ref=e92]: Everything looks good
              - paragraph [ref=e93]: No urgent actions right now. Check back later for fresh insights.
          - button "🧠 Store Advisor Ask anything about your business" [ref=e95]:
            - generic [ref=e96]:
              - generic [ref=e97]: 🧠
              - generic [ref=e98]:
                - heading "Store Advisor" [level=3] [ref=e99]
                - paragraph [ref=e100]: Ask anything about your business
            - generic [ref=e101]: ▼
          - generic [ref=e102]:
            - generic [ref=e103]:
              - heading "Today" [level=3] [ref=e104]
              - generic [ref=e105]:
                - generic [ref=e106]:
                  - generic [ref=e107]: Sales
                  - generic [ref=e108]: "2"
                - generic [ref=e109]:
                  - generic [ref=e110]: Revenue
                  - generic [ref=e111]: $7.98
                - generic [ref=e112]:
                  - generic [ref=e113]: Upcoming Events
                  - generic [ref=e114]: "1"
              - link "View full cash flow →" [ref=e115] [cursor=pointer]:
                - /url: /dashboard/cash-flow
            - generic [ref=e116]:
              - heading "Recent Activity" [level=3] [ref=e117]
              - table [ref=e119]:
                - rowgroup [ref=e120]:
                  - row "Date Type Description Amount" [ref=e121]:
                    - columnheader "Date" [ref=e122]
                    - columnheader "Type" [ref=e123]
                    - columnheader "Description" [ref=e124]
                    - columnheader "Amount" [ref=e125]
                - rowgroup [ref=e126]:
                  - 'row "4/7/2026 adjustment Inventory adjustment: Ice Mountain 24oz Sport Bottle +108 — Received shipment $0.00" [ref=e127]':
                    - cell "4/7/2026" [ref=e128]
                    - cell "adjustment" [ref=e129]
                    - 'cell "Inventory adjustment: Ice Mountain 24oz Sport Bottle +108 — Received shipment" [ref=e130]'
                    - cell "$0.00" [ref=e131]
                  - 'row "4/7/2026 sale Sale: Ice Mountain 24oz Sport Bottle x1 $3.99" [ref=e132]':
                    - cell "4/7/2026" [ref=e133]
                    - cell "sale" [ref=e134]
                    - 'cell "Sale: Ice Mountain 24oz Sport Bottle x1" [ref=e135]'
                    - cell "$3.99" [ref=e136]
                  - 'row "4/7/2026 sale Sale: Ice Mountain 24oz Sport Bottle x1 $3.99" [ref=e137]':
                    - cell "4/7/2026" [ref=e138]
                    - cell "sale" [ref=e139]
                    - 'cell "Sale: Ice Mountain 24oz Sport Bottle x1" [ref=e140]'
                    - cell "$3.99" [ref=e141]
                  - 'row "4/4/2026 sale Sale: Catan x1 $44.99" [ref=e142]':
                    - cell "4/4/2026" [ref=e143]
                    - cell "sale" [ref=e144]
                    - 'cell "Sale: Catan x1" [ref=e145]'
                    - cell "$44.99" [ref=e146]
                  - 'row "4/3/2026 gift_card_sale Gift card sold: 4EET-T3QN-JF8G-3TD2 $2500.00" [ref=e147]':
                    - cell "4/3/2026" [ref=e148]
                    - cell "gift_card_sale" [ref=e149]
                    - 'cell "Gift card sold: 4EET-T3QN-JF8G-3TD2" [ref=e150]'
                    - cell "$2500.00" [ref=e151]
                  - 'row "4/3/2026 sale Sale: Ragavan, Nimble Pilferer x1 $71.50" [ref=e152]':
                    - cell "4/3/2026" [ref=e153]
                    - cell "sale" [ref=e154]
                    - 'cell "Sale: Ragavan, Nimble Pilferer x1" [ref=e155]'
                    - cell "$71.50" [ref=e156]
                  - 'row "4/3/2026 sale Sale: Ticket to Ride x1 $44.99" [ref=e157]':
                    - cell "4/3/2026" [ref=e158]
                    - cell "sale" [ref=e159]
                    - 'cell "Sale: Ticket to Ride x1" [ref=e160]'
                    - cell "$44.99" [ref=e161]
                  - 'row "4/3/2026 sale Sale: Ticket to Ride x1 $44.99" [ref=e162]':
                    - cell "4/3/2026" [ref=e163]
                    - cell "sale" [ref=e164]
                    - 'cell "Sale: Ticket to Ride x1" [ref=e165]'
                    - cell "$44.99" [ref=e166]
          - button "🌙 End of Day Summary" [ref=e167]:
            - generic [ref=e168]: 🌙
            - generic [ref=e169]: End of Day Summary
  - alert [ref=e170]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import path from "path";
  3  | 
  4  | const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
  5  | 
  6  | /**
  7  |  * Helper: derive a filename-safe slug from viewport + page path.
  8  |  */
  9  | function screenshotName(
  10 |   pagePath: string,
  11 |   viewport: { width: number; height: number }
  12 | ): string {
  13 |   const slug = pagePath.replace(/^\//, "").replace(/\//g, "--") || "home";
  14 |   const device = viewport.width >= 1024 ? "desktop" : "tablet";
  15 |   return `${slug}_${device}.png`;
  16 | }
  17 | 
  18 | async function captureScreenshot(
  19 |   page: import("@playwright/test").Page,
  20 |   urlPath: string,
  21 |   viewportSize: { width: number; height: number }
  22 | ) {
> 23 |   await page.goto(urlPath, { waitUntil: "networkidle", timeout: 30_000 });
     |              ^ TimeoutError: page.goto: Timeout 30000ms exceeded.
  24 |   // Extra settle time for client hydration / lazy images
  25 |   await page.waitForTimeout(2000);
  26 |   const name = screenshotName(urlPath, viewportSize);
  27 |   await page.screenshot({
  28 |     path: path.join(SCREENSHOT_DIR, name),
  29 |     fullPage: true,
  30 |   });
  31 | }
  32 | 
  33 | // ---------------------------------------------------------------------------
  34 | // PUBLIC PAGES (no auth required)
  35 | // ---------------------------------------------------------------------------
  36 | 
  37 | const PUBLIC_PAGES = [
  38 |   "/login",
  39 |   "/buylist/full-uproar-games",
  40 |   "/connect/full-uproar-games",
  41 |   "/embed/deck-builder/full-uproar-games",
  42 |   "/clock/full-uproar-games",
  43 |   "/order/full-uproar-games",
  44 | ];
  45 | 
  46 | test.describe("public pages", () => {
  47 |   for (const pagePath of PUBLIC_PAGES) {
  48 |     test(`public - ${pagePath}`, async ({ page }) => {
  49 |       const vp = page.viewportSize()!;
  50 |       await captureScreenshot(page, pagePath, vp);
  51 |     });
  52 |   }
  53 | });
  54 | 
  55 | // ---------------------------------------------------------------------------
  56 | // AUTHENTICATED PAGES (require storageState from manual login)
  57 | // ---------------------------------------------------------------------------
  58 | 
  59 | const AUTH_PAGES = [
  60 |   "/dashboard",
  61 |   "/dashboard/register",
  62 |   "/dashboard/inventory",
  63 |   "/dashboard/singles",
  64 |   "/dashboard/customers",
  65 |   "/dashboard/events",
  66 |   "/dashboard/fulfillment",
  67 |   "/dashboard/orders",
  68 |   "/dashboard/deck-builder",
  69 |   "/dashboard/reports",
  70 |   "/dashboard/reports/margins",
  71 |   "/dashboard/cash-flow",
  72 |   "/dashboard/staff",
  73 |   "/dashboard/settings",
  74 |   "/dashboard/help",
  75 |   "/dashboard/trade-ins",
  76 |   "/dashboard/trade-ins/new",
  77 |   "/dashboard/tournaments",
  78 |   "/dashboard/consignment",
  79 |   "/dashboard/cafe",
  80 |   "/dashboard/timeclock",
  81 | ];
  82 | 
  83 | test.describe("authenticated pages", () => {
  84 |   for (const pagePath of AUTH_PAGES) {
  85 |     test(`authenticated - ${pagePath}`, async ({ page }) => {
  86 |       const vp = page.viewportSize()!;
  87 |       await captureScreenshot(page, pagePath, vp);
  88 |     });
  89 |   }
  90 | });
  91 | 
```