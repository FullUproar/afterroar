# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-qa.spec.ts >> authenticated pages >> authenticated - /dashboard/customers
- Location: tests\visual-qa.spec.ts:85:9

# Error details

```
TimeoutError: page.goto: Timeout 30000ms exceeded.
Call log:
  - navigating to "https://www.afterroar.store/dashboard/customers", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]: Training — Not Real
    - generic [ref=e5]:
      - main [ref=e6]:
        - button "Notifications" [ref=e9]:
          - img [ref=e10]
          - generic [ref=e12]: "6"
        - generic [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]:
              - button "Go back" [ref=e17]:
                - img [ref=e18]
              - heading "Customers" [level=1] [ref=e20]
            - generic [ref=e22]:
              - link "Export CSV" [ref=e23] [cursor=pointer]:
                - /url: /api/customers/export
              - button "Add Customer" [ref=e24]
          - generic [ref=e26]:
            - button "All 44" [ref=e27]:
              - text: All
              - generic [ref=e28]: "44"
            - button "VIP 10" [ref=e29]:
              - text: VIP
              - generic [ref=e30]: "10"
            - button "Regular 21" [ref=e31]:
              - text: Regular
              - generic [ref=e32]: "21"
            - button "New 13" [ref=e33]:
              - text: New
              - generic [ref=e34]: "13"
            - button "At Risk 0" [ref=e35]:
              - text: At Risk
              - generic [ref=e36]: "0"
            - button "Dormant 0" [ref=e37]:
              - text: Dormant
              - generic [ref=e38]: "0"
          - textbox "Search customers..." [ref=e40]
          - generic [ref=e42]: 44 customers — page 1 of 5
          - table [ref=e44]:
            - rowgroup [ref=e45]:
              - row "Name Segment Email Lifetime Spend Store Credit Last Purchase" [ref=e46]:
                - columnheader "Name" [ref=e47] [cursor=pointer]
                - columnheader "Segment" [ref=e48] [cursor=pointer]
                - columnheader "Email" [ref=e49] [cursor=pointer]
                - columnheader "Lifetime Spend" [ref=e50] [cursor=pointer]
                - columnheader "Store Credit" [ref=e51] [cursor=pointer]
                - columnheader "Last Purchase" [ref=e52] [cursor=pointer]
            - rowgroup [ref=e53]:
              - link "Aiden White Regular aidenw@yahoo.com $288.01 $150.00 3/30/2026" [ref=e54] [cursor=pointer]:
                - /url: /dashboard/customers/c0yh5r6f0z58cmn722ozb
                - row "Aiden White Regular aidenw@yahoo.com $288.01 $150.00 3/30/2026" [ref=e55]:
                  - cell "Aiden White" [ref=e56]
                  - cell "Regular" [ref=e57]:
                    - generic [ref=e58]:
                      - generic [ref=e59]: 🔄
                      - text: Regular
                  - cell "aidenw@yahoo.com" [ref=e60]
                  - cell "$288.01" [ref=e61]
                  - cell "$150.00" [ref=e62]:
                    - generic [ref=e63]: $150.00
                  - cell "3/30/2026" [ref=e64]
              - link "Amelia Harris Regular ameliah@gmail.com $383.54 $285.00 3/28/2026" [ref=e65] [cursor=pointer]:
                - /url: /dashboard/customers/c8f3j411b4d9mn722ozy
                - row "Amelia Harris Regular ameliah@gmail.com $383.54 $285.00 3/28/2026" [ref=e66]:
                  - cell "Amelia Harris" [ref=e67]
                  - cell "Regular" [ref=e68]:
                    - generic [ref=e69]:
                      - generic [ref=e70]: 🔄
                      - text: Regular
                  - cell "ameliah@gmail.com" [ref=e71]
                  - cell "$383.54" [ref=e72]
                  - cell "$285.00" [ref=e73]:
                    - generic [ref=e74]: $285.00
                  - cell "3/28/2026" [ref=e75]
              - link "Ava Martinez VIP ava.m@gmail.com $1282.18 $31.00 3/30/2026" [ref=e76] [cursor=pointer]:
                - /url: /dashboard/customers/cuu6e37l9ismn722on2
                - row "Ava Martinez VIP ava.m@gmail.com $1282.18 $31.00 3/30/2026" [ref=e77]:
                  - cell "Ava Martinez" [ref=e78]
                  - cell "VIP" [ref=e79]:
                    - generic [ref=e80]:
                      - generic [ref=e81]: 🌟
                      - text: VIP
                  - cell "ava.m@gmail.com" [ref=e82]
                  - cell "$1282.18" [ref=e83]
                  - cell "$31.00" [ref=e84]:
                    - generic [ref=e85]: $31.00
                  - cell "3/30/2026" [ref=e86]
              - link "Benjamin Young VIP benyoung@outlook.com $563.65 $87.00 3/28/2026" [ref=e87] [cursor=pointer]:
                - /url: /dashboard/customers/c0mr3vzzqj7fbmn722p1s
                - row "Benjamin Young VIP benyoung@outlook.com $563.65 $87.00 3/28/2026" [ref=e88]:
                  - cell "Benjamin Young" [ref=e89]
                  - cell "VIP" [ref=e90]:
                    - generic [ref=e91]:
                      - generic [ref=e92]: 🌟
                      - text: VIP
                  - cell "benyoung@outlook.com" [ref=e93]
                  - cell "$563.65" [ref=e94]
                  - cell "$87.00" [ref=e95]:
                    - generic [ref=e96]: $87.00
                  - cell "3/28/2026" [ref=e97]
              - link "Charlotte Jackson VIP charlottej@gmail.com $692.36 $420.00 3/30/2026" [ref=e98] [cursor=pointer]:
                - /url: /dashboard/customers/cfqnpgndr98smn722oyo
                - row "Charlotte Jackson VIP charlottej@gmail.com $692.36 $420.00 3/30/2026" [ref=e99]:
                  - cell "Charlotte Jackson" [ref=e100]
                  - cell "VIP" [ref=e101]:
                    - generic [ref=e102]:
                      - generic [ref=e103]: 🌟
                      - text: VIP
                  - cell "charlottej@gmail.com" [ref=e104]
                  - cell "$692.36" [ref=e105]
                  - cell "$420.00" [ref=e106]:
                    - generic [ref=e107]: $420.00
                  - cell "3/30/2026" [ref=e108]
              - link "Chloe Adams VIP chloea@gmail.com $606.74 $27.00 3/30/2026" [ref=e109] [cursor=pointer]:
                - /url: /dashboard/customers/ck2nw3nbot3rmn722p5z
                - row "Chloe Adams VIP chloea@gmail.com $606.74 $27.00 3/30/2026" [ref=e110]:
                  - cell "Chloe Adams" [ref=e111]
                  - cell "VIP" [ref=e112]:
                    - generic [ref=e113]:
                      - generic [ref=e114]: 🌟
                      - text: VIP
                  - cell "chloea@gmail.com" [ref=e115]
                  - cell "$606.74" [ref=e116]
                  - cell "$27.00" [ref=e117]:
                    - generic [ref=e118]: $27.00
                  - cell "3/30/2026" [ref=e119]
              - link "Claude the Destroyer New claude@fulluproar.com - $0.00 Never" [ref=e120] [cursor=pointer]:
                - /url: /dashboard/customers/cmnnz1x3c000004l1vweumcol
                - row "Claude the Destroyer New claude@fulluproar.com - $0.00 Never" [ref=e121]:
                  - cell "Claude the Destroyer" [ref=e122]
                  - cell "New" [ref=e123]:
                    - generic [ref=e124]:
                      - generic [ref=e125]: 🆕
                      - text: New
                  - cell "claude@fulluproar.com" [ref=e126]
                  - cell "-" [ref=e127]
                  - cell "$0.00" [ref=e128]:
                    - generic [ref=e129]: $0.00
                  - cell "Never" [ref=e130]
              - link "Daniel Green Regular dgreen@outlook.com $408.94 $195.00 3/24/2026" [ref=e131] [cursor=pointer]:
                - /url: /dashboard/customers/c6e02f7lrce9mn722p5e
                - row "Daniel Green Regular dgreen@outlook.com $408.94 $195.00 3/24/2026" [ref=e132]:
                  - cell "Daniel Green" [ref=e133]
                  - cell "Regular" [ref=e134]:
                    - generic [ref=e135]:
                      - generic [ref=e136]: 🔄
                      - text: Regular
                  - cell "dgreen@outlook.com" [ref=e137]
                  - cell "$408.94" [ref=e138]
                  - cell "$195.00" [ref=e139]:
                    - generic [ref=e140]: $195.00
                  - cell "3/24/2026" [ref=e141]
              - link "Dylan Chen Regular dylanc@proton.me $317.98 $52.00 3/28/2026" [ref=e142] [cursor=pointer]:
                - /url: /dashboard/customers/csmejsf821pmn722ol8
                - row "Dylan Chen Regular dylanc@proton.me $317.98 $52.00 3/28/2026" [ref=e143]:
                  - cell "Dylan Chen" [ref=e144]
                  - cell "Regular" [ref=e145]:
                    - generic [ref=e146]:
                      - generic [ref=e147]: 🔄
                      - text: Regular
                  - cell "dylanc@proton.me" [ref=e148]
                  - cell "$317.98" [ref=e149]
                  - cell "$52.00" [ref=e150]:
                    - generic [ref=e151]: $52.00
                  - cell "3/28/2026" [ref=e152]
              - link "Emily Watson Regular emwatson@gmail.com $292.95 $67.00 3/30/2026" [ref=e153] [cursor=pointer]:
                - /url: /dashboard/customers/cyj1zmkmt9zmn722okm
                - row "Emily Watson Regular emwatson@gmail.com $292.95 $67.00 3/30/2026" [ref=e154]:
                  - cell "Emily Watson" [ref=e155]
                  - cell "Regular" [ref=e156]:
                    - generic [ref=e157]:
                      - generic [ref=e158]: 🔄
                      - text: Regular
                  - cell "emwatson@gmail.com" [ref=e159]
                  - cell "$292.95" [ref=e160]
                  - cell "$67.00" [ref=e161]:
                    - generic [ref=e162]: $67.00
                  - cell "3/30/2026" [ref=e163]
          - generic [ref=e164]:
            - button "Previous" [disabled] [ref=e165]
            - generic [ref=e166]:
              - button "1" [ref=e167]
              - button "2" [ref=e168]
              - button "3" [ref=e169]
              - button "4" [ref=e170]
              - button "5" [ref=e171]
            - button "Next" [ref=e172]
      - navigation [ref=e173]:
        - generic [ref=e174]:
          - link "◈ Register" [ref=e175] [cursor=pointer]:
            - /url: /dashboard/register
            - generic [ref=e176]: ◈
            - generic [ref=e177]: Register
          - link "▦ Inventory" [ref=e178] [cursor=pointer]:
            - /url: /dashboard/inventory
            - generic [ref=e179]: ▦
            - generic [ref=e180]: Inventory
          - link "♟ Customers" [ref=e181] [cursor=pointer]:
            - /url: /dashboard/customers
            - generic [ref=e183]: ♟
            - generic [ref=e184]: Customers
          - button "··· More" [ref=e185]:
            - generic [ref=e186]: ···
            - generic [ref=e187]: More
  - alert [ref=e188]
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