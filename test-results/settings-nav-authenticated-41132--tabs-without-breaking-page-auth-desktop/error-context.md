# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-nav.spec.ts >> authenticated: settings navigation >> can switch settings tabs without breaking page
- Location: tests\settings-nav.spec.ts:31:7

# Error details

```
Error: locator.click: Error: strict mode violation: getByRole('button', { name: 'Intelligence' }) resolved to 2 elements:
    1) <button type="button" class="flex w-full items-center justify-between px-2 lg:px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted hover:text-foreground transition-colors">…</button> aka getByRole('button', { name: 'Intelligence ▸' })
    2) <button class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap border-transparent text-muted hover:text-foreground hover:border-card-border">…</button> aka getByRole('button', { name: '◉ Intelligence' })

Call log:
  - waiting for getByRole('button', { name: 'Intelligence' })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]: Training Mode — Transactions are not real
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic [ref=e6]:
        - heading "Full Uproar Games & Café" [level=1] [ref=e7]
        - paragraph [ref=e8]: Afterroar Ops
      - link "◈ Open Register" [ref=e10] [cursor=pointer]:
        - /url: /dashboard/register
        - generic [ref=e11]: ◈
        - generic [ref=e12]: Open Register
      - navigation [ref=e13]:
        - button "POS ▸" [ref=e15]:
          - generic [ref=e16]: POS
          - generic [ref=e17]: ▸
        - button "Inventory ▸" [ref=e19]:
          - generic [ref=e20]: Inventory
          - generic [ref=e21]: ▸
        - button "Customers ▸" [ref=e23]:
          - generic [ref=e24]: Customers
          - generic [ref=e25]: ▸
        - button "Events ▸" [ref=e27]:
          - generic [ref=e28]: Events
          - generic [ref=e29]: ▸
        - button "Trade & Returns ▸" [ref=e31]:
          - generic [ref=e32]: Trade & Returns
          - generic [ref=e33]: ▸
        - button "Intelligence ▸" [ref=e35]:
          - generic [ref=e36]: Intelligence
          - generic [ref=e37]: ▸
        - button "Afterroar Network ▸" [ref=e39]:
          - generic [ref=e40]: Afterroar Network
          - generic [ref=e41]: ▸
        - button "Admin ▸" [ref=e43]:
          - generic [ref=e44]: Admin
          - generic [ref=e45]: ▸
        - generic [ref=e46]:
          - button "Settings ▾" [ref=e47]:
            - generic [ref=e48]: Settings
            - generic [ref=e49]: ▾
          - generic [ref=e50]:
            - link "⚙ Settings" [ref=e51] [cursor=pointer]:
              - /url: /dashboard/settings
              - generic [ref=e52]: ⚙
              - generic [ref=e53]: Settings
            - link "◈ Subscription" [ref=e54] [cursor=pointer]:
              - /url: /dashboard/billing
              - generic [ref=e55]: ◈
              - generic [ref=e56]: Subscription
            - link "⤓ Import" [ref=e57] [cursor=pointer]:
              - /url: /dashboard/import
              - generic [ref=e58]: ⤓
              - generic [ref=e59]: Import
        - link "⌂ Dashboard" [ref=e60] [cursor=pointer]:
          - /url: /dashboard
          - generic [ref=e61]: ⌂
          - text: Dashboard
        - link "▤ Cafe" [ref=e62] [cursor=pointer]:
          - /url: /dashboard/cafe
          - generic [ref=e63]: ▤
          - text: Cafe
      - generic [ref=e64]:
        - paragraph [ref=e65]: Bot Owner · owner
        - button "Sign out" [ref=e66]
        - button "Register Mode" [ref=e67]
    - main [ref=e68]:
      - generic [ref=e69]:
        - generic [ref=e71]:
          - generic [ref=e73]: Online
          - generic [ref=e74]: Building offline cache...
        - button "Notifications" [ref=e76]:
          - img [ref=e77]
          - generic [ref=e79]: "6"
      - generic [ref=e81]:
        - heading "Settings" [level=1] [ref=e84]
        - paragraph [ref=e85]: Full Uproar Games & Café· Changes save automatically
        - navigation [ref=e87]:
          - button "⌂ Store" [ref=e88]:
            - generic [ref=e89]: ⌂
            - text: Store
          - button "◈ Payments" [ref=e90]:
            - generic [ref=e91]: ◈
            - text: Payments
          - button "⊞ Staff" [ref=e92]:
            - generic [ref=e93]: ⊞
            - text: Staff
          - button "◎ Integrations" [active] [ref=e94]:
            - generic [ref=e95]: ◎
            - text: Integrations
          - button "◉ Intelligence" [ref=e96]:
            - generic [ref=e97]: ◉
            - text: Intelligence
          - button "⚙ Operations" [ref=e98]:
            - generic [ref=e99]: ⚙
            - text: Operations
        - paragraph [ref=e100]: Afterroar Network and external connections
        - generic [ref=e101]:
          - generic [ref=e102]:
            - heading "Afterroar Network" [level=2] [ref=e103]
            - paragraph [ref=e104]: Connect to the Afterroar Network to sync events, enable QR check-ins, link player identities, and participate in cross-store leaderboards.
            - generic [ref=e106]:
              - generic [ref=e107]:
                - generic [ref=e109]: Connected
                - generic [ref=e110]: to Afterroar Network
              - generic [ref=e111]:
                - paragraph [ref=e112]: Events you create as "Afterroar Events" will appear on your store page.
                - paragraph [ref=e113]: Player RSVPs are visible in the check-in list.
                - paragraph [ref=e114]: Loyalty points sync to the Afterroar wallet for linked customers.
              - button "Disconnect" [ref=e115]
          - paragraph [ref=e117]:
            - text: eBay and marketplace integrations are managed on the
            - link "eBay Listings page" [ref=e118] [cursor=pointer]:
              - /url: /dashboard/singles/ebay
            - text: .
          - paragraph [ref=e120]:
            - text: Plan, add-ons, and billing are managed on the
            - link "Subscription page" [ref=e121] [cursor=pointer]:
              - /url: /dashboard/billing
            - text: .
  - alert [ref=e122]
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
  13  |     await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  14  |     await expect(page.locator("text=Changes save automatically")).toBeVisible({ timeout: 10_000 });
  15  | 
  16  |     // Use Next.js router to navigate (simulates what happens when user clicks a link)
  17  |     await page.evaluate(() => window.history.pushState({}, "", "/dashboard"));
  18  |     await page.goto("/dashboard", { waitUntil: "networkidle" });
  19  |     await expect(page).toHaveURL(/\/dashboard/);
  20  |   });
  21  | 
  22  |   test("can navigate from settings to inventory", async ({ page }) => {
  23  |     await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  24  |     await expect(page.locator("text=Changes save automatically")).toBeVisible({ timeout: 10_000 });
  25  | 
  26  |     // Navigate via full page load (sidebar click has overlap issues at test viewport)
  27  |     await page.goto("/dashboard/inventory", { waitUntil: "networkidle" });
  28  |     await expect(page).toHaveURL(/inventory/);
  29  |   });
  30  | 
  31  |   test("can switch settings tabs without breaking page", async ({ page }) => {
  32  |     await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  33  |     await expect(page.locator("text=Changes save automatically")).toBeVisible({ timeout: 10_000 });
  34  | 
  35  |     // Click through each tab — if any crashes, the page dies
  36  |     for (const tab of ["Payments", "Staff", "Integrations", "Intelligence", "Operations", "Store"]) {
> 37  |       await page.getByRole("button", { name: tab }).click();
      |                                                     ^ Error: locator.click: Error: strict mode violation: getByRole('button', { name: 'Intelligence' }) resolved to 2 elements:
  38  |       await page.waitForTimeout(500);
  39  |     }
  40  | 
  41  |     // Verify page is still alive by checking content is visible
  42  |     await expect(page.locator("text=Changes save automatically")).toBeVisible();
  43  | 
  44  |     // Navigate away via full page load
  45  |     await page.goto("/dashboard", { waitUntil: "networkidle" });
  46  |     await expect(page).toHaveURL(/\/dashboard/);
  47  |   });
  48  | 
  49  |   test("can click sidebar link from settings to navigate", async ({ page }) => {
  50  |     await page.setViewportSize({ width: 1440, height: 900 });
  51  |     await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  52  |     await expect(page.locator("text=Changes save automatically")).toBeVisible({ timeout: 10_000 });
  53  | 
  54  |     // Wait for sidebar to render
  55  |     await page.waitForTimeout(2000);
  56  | 
  57  |     // Expand Admin group (Settings is in Admin)
  58  |     // Then click Dashboard link which is in a different group
  59  |     const salesGroup = page.locator("button:has-text('Sales')");
  60  |     if (await salesGroup.isVisible()) {
  61  |       await salesGroup.click();
  62  |       await page.waitForTimeout(300);
  63  |     }
  64  | 
  65  |     // Try clicking the Register link (should be in Sales group)
  66  |     const registerLink = page.locator('a[href="/dashboard/register"]');
  67  |     if (await registerLink.isVisible()) {
  68  |       await registerLink.click();
  69  |       await page.waitForURL("**/dashboard/register**", { timeout: 10_000 });
  70  |       await expect(page).toHaveURL(/register/);
  71  |     } else {
  72  |       // Fallback: check if ANY sidebar link is clickable
  73  |       const anyLink = page.locator('nav a[href^="/dashboard/"]').first();
  74  |       const href = await anyLink.getAttribute("href");
  75  |       await anyLink.click();
  76  |       await page.waitForURL(`**${href}**`, { timeout: 10_000 });
  77  |     }
  78  |   });
  79  | 
  80  |   test("no hydration errors on dashboard page", async ({ page }) => {
  81  |     const errors: string[] = [];
  82  |     page.on("pageerror", (err) => errors.push(`PAGE_ERROR: ${err.message}`));
  83  | 
  84  |     await page.goto("/dashboard", { waitUntil: "networkidle" });
  85  |     await page.waitForTimeout(3000);
  86  | 
  87  |     const critical = errors.filter((e) => e.includes("418") || e.includes("Hydration"));
  88  |     console.log("=== DASHBOARD ERRORS ===");
  89  |     errors.forEach((e) => console.log("  ", e.slice(0, 200)));
  90  |     expect(critical).toEqual([]);
  91  |   });
  92  | 
  93  |   test("no console errors on settings page", async ({ page }) => {
  94  |     const errors: string[] = [];
  95  |     const warnings: string[] = [];
  96  |     page.on("console", (msg) => {
  97  |       if (msg.type() === "error") errors.push(msg.text());
  98  |       if (msg.type() === "warning") warnings.push(msg.text());
  99  |     });
  100 |     page.on("pageerror", (err) => errors.push(`PAGE_ERROR: ${err.message}`));
  101 | 
  102 |     await page.goto("/dashboard/settings", { waitUntil: "networkidle" });
  103 |     await expect(page.locator("text=Changes save automatically")).toBeVisible({ timeout: 10_000 });
  104 | 
  105 |     // Wait a bit for any delayed errors
  106 |     await page.waitForTimeout(3000);
  107 | 
  108 |     // Log ALL errors and warnings for debugging
  109 |     console.log("=== CONSOLE ERRORS ===");
  110 |     errors.forEach((e) => console.log("  ERROR:", e.slice(0, 200)));
  111 |     console.log("=== CONSOLE WARNINGS ===");
  112 |     warnings.forEach((w) => console.log("  WARN:", w.slice(0, 200)));
  113 | 
  114 |     // Check for hydration or React errors
  115 |     const criticalErrors = errors.filter(
  116 |       (e) => e.includes("Hydration") || e.includes("hydration") || e.includes("did not match")
  117 |         || e.includes("mismatch") || e.includes("Minified React") || e.includes("PAGE_ERROR")
  118 |         || e.includes("Cannot read") || e.includes("is not a function")
  119 |     );
  120 | 
  121 |     expect(criticalErrors).toEqual([]);
  122 |   });
  123 | });
  124 | 
```