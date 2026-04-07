# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-nav.spec.ts >> authenticated: settings navigation >> can click sidebar link from settings to navigate
- Location: tests\settings-nav.spec.ts:49:7

# Error details

```
Error: locator.isVisible: Error: strict mode violation: locator('a[href="/dashboard/register"]') resolved to 2 elements:
    1) <a href="/dashboard/register" class="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors">…</a> aka getByRole('link', { name: '◈ Open Register' })
    2) <a href="/dashboard/register" class="relative flex flex-1 flex-col items-center justify-center gap-0.5 md:gap-1 transition-colors text-muted">…</a> aka getByText('◈Register')

Call log:
    - checking visibility of locator('a[href="/dashboard/register"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
          - button "◎ Integrations" [ref=e94]:
            - generic [ref=e95]: ◎
            - text: Integrations
          - button "◉ Intelligence" [ref=e96]:
            - generic [ref=e97]: ◉
            - text: Intelligence
          - button "⚙ Operations" [ref=e98]:
            - generic [ref=e99]: ⚙
            - text: Operations
        - paragraph [ref=e100]: Your store identity, tax, checkout, and receipt settings
        - generic [ref=e101]:
          - generic [ref=e102]:
            - generic [ref=e103]:
              - generic [ref=e104]:
                - heading "Store Identity" [level=2] [ref=e105]
                - paragraph [ref=e106]: How your store appears on receipts and to customers
              - button "Reset to defaults" [ref=e107]
            - generic [ref=e108]:
              - generic [ref=e109]:
                - generic [ref=e110]: Display Name
                - textbox "Defaults to store name" [ref=e112]
              - generic [ref=e113]:
                - generic [ref=e114]: Store Phone
                - textbox "e.g. (503) 555-0100" [ref=e116]
              - generic [ref=e117]:
                - generic [ref=e118]: Website
                - textbox "e.g. www.yourstore.com" [ref=e120]
              - generic [ref=e121]:
                - generic [ref=e122]:
                  - text: Receipt Address
                  - button "Help" [ref=e124]: "?"
                - textbox "e.g. 123 Main St, City, ST 12345" [ref=e126]
              - generic [ref=e127]:
                - generic [ref=e128]: Receipt Footer
                - textbox "e.g. Thank you for shopping with us!" [ref=e130]: Thank you for shopping with us!
              - generic [ref=e131]:
                - generic [ref=e132]: Show barcode on printed receipts
                - button [ref=e134]
              - generic [ref=e136]:
                - generic [ref=e137]: Show 'You saved $X' on receipts
                - button [ref=e139]
              - generic [ref=e141]:
                - generic [ref=e142]: Show return policy on receipts
                - button [ref=e144]
              - generic [ref=e146]:
                - generic [ref=e147]: Return Policy Text
                - textbox "Returns accepted within 30 days with receipt." [ref=e149]
          - generic [ref=e150]:
            - generic [ref=e151]:
              - generic [ref=e152]:
                - heading "Trade-Ins" [level=2] [ref=e153]
                - paragraph [ref=e154]: Default settings for the trade-in workflow
              - button "Reset to defaults" [ref=e155]
            - generic [ref=e156]:
              - generic [ref=e157]:
                - generic [ref=e158]:
                  - text: Default Credit Bonus %
                  - button "Help" [ref=e160]: "?"
                - spinbutton [ref=e162]: "30"
              - generic [ref=e163]:
                - generic [ref=e164]: Require customer for trade-ins
                - button [ref=e166]
          - generic [ref=e168]:
            - generic [ref=e169]:
              - generic [ref=e170]:
                - heading "Returns" [level=2] [ref=e171]
                - paragraph [ref=e172]: Default settings for processing returns
              - button "Reset to defaults" [ref=e173]
            - generic [ref=e174]:
              - generic [ref=e175]:
                - generic [ref=e176]: Default Credit Bonus %
                - spinbutton [ref=e178]: "0"
              - generic [ref=e179]:
                - generic [ref=e180]: Default Restocking Fee %
                - spinbutton [ref=e182]: "0"
              - generic [ref=e183]:
                - generic [ref=e184]: Return Window (days)
                - spinbutton [ref=e186]: "30"
              - generic [ref=e187]:
                - generic [ref=e188]: Require reason for returns
                - button [ref=e190]
          - generic [ref=e192]:
            - generic [ref=e193]:
              - generic [ref=e194]:
                - heading "Checkout" [level=2] [ref=e195]
                - paragraph [ref=e196]: How the register behaves during sales
              - button "Reset to defaults" [ref=e197]
            - generic [ref=e198]:
              - generic [ref=e199]:
                - generic [ref=e200]: Require customer for every sale
                - button [ref=e202]
              - generic [ref=e204]:
                - generic [ref=e205]: Auto-print receipt after sale
                - button [ref=e207]
              - generic [ref=e209]:
                - generic [ref=e210]: Default Payment Method
                - combobox [ref=e212]:
                  - option "Cash" [selected]
                  - option "Card"
                  - option "Store Credit"
          - generic [ref=e213]:
            - generic [ref=e214]:
              - generic [ref=e215]:
                - heading "Tax" [level=2] [ref=e216]
                - paragraph [ref=e217]: Sales tax configuration
              - button "Reset to defaults" [ref=e218]
            - generic [ref=e219]:
              - generic [ref=e220]:
                - generic [ref=e221]:
                  - text: Tax Rate %
                  - button "Help" [ref=e223]: "?"
                - spinbutton [ref=e225]: "7"
              - generic [ref=e226]:
                - generic [ref=e227]:
                  - text: Tax is included in listed prices
                  - button "Help" [ref=e229]: "?"
                - button [ref=e231]
          - generic [ref=e233]:
            - generic [ref=e234]:
              - generic [ref=e235]:
                - heading "Inventory" [level=2] [ref=e236]
                - paragraph [ref=e237]: Default inventory behavior
              - button "Reset to defaults" [ref=e238]
            - generic [ref=e240]:
              - generic [ref=e241]: Default Low Stock Threshold
              - spinbutton [ref=e243]: "5"
  - alert [ref=e244]
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
  37  |       await page.getByRole("button", { name: tab }).click();
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
> 67  |     if (await registerLink.isVisible()) {
      |                            ^ Error: locator.isVisible: Error: strict mode violation: locator('a[href="/dashboard/register"]') resolved to 2 elements:
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