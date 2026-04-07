# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-qa.spec.ts >> authenticated pages >> authenticated - /dashboard/register
- Location: tests\visual-qa.spec.ts:85:9

# Error details

```
TimeoutError: page.goto: Timeout 30000ms exceeded.
Call log:
  - navigating to "https://www.afterroar.store/dashboard/register", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]: Training — Not Real
    - generic [ref=e5]:
      - banner [ref=e6]:
        - generic [ref=e7]:
          - generic "Scanner ready" [ref=e8]
          - button "Full Uproar Games & Café" [ref=e9]
          - generic [ref=e10]: Test
          - generic [ref=e11]: Training
        - generic [ref=e12]:
          - generic [ref=e13]: Bot · Owner
          - button "Enter fullscreen" [ref=e14]:
            - img [ref=e15]
          - button "Exit register" [ref=e17]:
            - img [ref=e18]
      - generic [ref=e21]:
        - button "Search (F2)" [ref=e22]:
          - img [ref=e23]
        - button "Camera scan" [ref=e25]:
          - img [ref=e26]
        - button "Attach customer" [ref=e28]:
          - img [ref=e29]
        - button "Quick add" [ref=e31]:
          - img [ref=e32]
        - button "Manual item" [ref=e34]:
          - img [ref=e35]
        - button "%" [ref=e37]:
          - generic [ref=e38]: "%"
        - button "More actions" [ref=e39]:
          - img [ref=e40]
      - generic [ref=e44]: Scan or search to add items
      - button "PAY" [disabled] [ref=e47]
      - generic [ref=e48]:
        - generic [ref=e49]: Tue, Apr 7
        - generic [ref=e52]: 11:26:50 AM
  - alert [ref=e53]
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