# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile-overflow.spec.ts >> authenticated: mobile overflow checks >> mobile overflow - /dashboard/inventory
- Location: tests\mobile-overflow.spec.ts:32:9

# Error details

```
Error: /dashboard/inventory has 1 clipped buttons/links:
<button> "Add Item" overflows right by 1px

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - main [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e8]:
          - generic [ref=e10]: Offline
          - generic [ref=e11]: Sales will queue locally
        - button "Notifications" [ref=e13]:
          - img [ref=e14]
      - generic [ref=e17]:
        - generic [ref=e18]:
          - generic:
            - button "Go back" [ref=e19]:
              - img [ref=e20]
            - heading "Inventory" [level=1]
          - generic [ref=e23]:
            - button "Print Labels" [ref=e24]
            - button "Scanner listening Scan to Add" [ref=e25]:
              - generic "Scanner listening" [ref=e26]
              - text: Scan to Add
            - button "Add Item" [ref=e27]
        - textbox "Search by name, barcode, or SKU..." [ref=e29]
        - generic [ref=e30]:
          - paragraph [ref=e31]: Failed to load inventory. Try again.
          - button "Try again" [ref=e32]
        - generic [ref=e33]:
          - button "Name ▲" [ref=e34]
          - button "Price" [ref=e35]
          - button "Qty" [ref=e36]
          - button "Category" [ref=e37]
    - navigation [ref=e38]:
      - generic [ref=e39]:
        - link "◈ Register" [ref=e40] [cursor=pointer]:
          - /url: /dashboard/register
          - generic [ref=e41]: ◈
          - generic [ref=e42]: Register
        - link "▦ Inventory" [ref=e43] [cursor=pointer]:
          - /url: /dashboard/inventory
          - generic [ref=e45]: ▦
          - generic [ref=e46]: Inventory
        - link "♟ Customers" [ref=e47] [cursor=pointer]:
          - /url: /dashboard/customers
          - generic [ref=e48]: ♟
          - generic [ref=e49]: Customers
        - button "··· More" [ref=e50]:
          - generic [ref=e51]: ···
          - generic [ref=e52]: More
  - alert [ref=e53]
```

# Test source

```ts
  1   | /**
  2   |  * Mobile Overflow Test
  3   |  *
  4   |  * Checks every authenticated page at mobile viewport (390x844) for:
  5   |  * 1. No horizontal overflow (nothing wider than viewport)
  6   |  * 2. All buttons/links are within viewport bounds
  7   |  * 3. No elements clipped at right edge
  8   |  *
  9   |  * Run: npx playwright test tests/mobile-overflow.spec.ts --project=mobile-overflow
  10  |  */
  11  | import { test, expect } from "@playwright/test";
  12  | 
  13  | const PAGES = [
  14  |   "/dashboard",
  15  |   "/dashboard/register",
  16  |   "/dashboard/inventory",
  17  |   "/dashboard/singles",
  18  |   "/dashboard/customers",
  19  |   "/dashboard/events",
  20  |   "/dashboard/cafe",
  21  |   "/dashboard/trade-ins",
  22  |   "/dashboard/returns",
  23  |   "/dashboard/cash-flow",
  24  |   "/dashboard/staff",
  25  |   "/dashboard/settings/store",
  26  |   "/dashboard/settings/payments",
  27  |   "/dashboard/help",
  28  | ];
  29  | 
  30  | test.describe("authenticated: mobile overflow checks", () => {
  31  |   for (const pagePath of PAGES) {
  32  |     test(`mobile overflow - ${pagePath}`, async ({ page }) => {
  33  |       await page.goto(pagePath, { waitUntil: "domcontentloaded", timeout: 30_000 });
  34  |       await page.waitForTimeout(2000);
  35  | 
  36  |       const viewportWidth = 390;
  37  | 
  38  |       // Check for horizontal overflow
  39  |       const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  40  |       const hasHorizontalOverflow = bodyScrollWidth > viewportWidth + 5; // 5px tolerance
  41  | 
  42  |       if (hasHorizontalOverflow) {
  43  |         // Find the offending elements
  44  |         const overflowingElements = await page.evaluate((vw) => {
  45  |           const elements: string[] = [];
  46  |           document.querySelectorAll("*").forEach((el) => {
  47  |             const rect = el.getBoundingClientRect();
  48  |             if (rect.right > vw + 5 && rect.width > 0 && rect.height > 0) {
  49  |               const tag = el.tagName.toLowerCase();
  50  |               const cls = el.className?.toString().slice(0, 60) || "";
  51  |               const text = el.textContent?.slice(0, 30) || "";
  52  |               elements.push(`<${tag} class="${cls}"> "${text}" (right: ${Math.round(rect.right)}px)`);
  53  |             }
  54  |           });
  55  |           return elements.slice(0, 5); // First 5 offenders
  56  |         }, viewportWidth);
  57  | 
  58  |         console.log(`[${pagePath}] Horizontal overflow detected (scrollWidth: ${bodyScrollWidth}px):`);
  59  |         overflowingElements.forEach((el) => console.log(`  - ${el}`));
  60  |       }
  61  | 
  62  |       // Don't hard-fail on overflow for now — just report. Uncomment to enforce:
  63  |       // expect(hasHorizontalOverflow, `Horizontal overflow on ${pagePath}`).toBeFalsy();
  64  | 
  65  |       // Check that all interactive elements (buttons, links) are within viewport
  66  |       const clippedButtons = await page.evaluate((vw) => {
  67  |         const clipped: string[] = [];
  68  |         document.querySelectorAll("button, a, input, select").forEach((el) => {
  69  |           const rect = el.getBoundingClientRect();
  70  |           // Skip invisible/hidden elements
  71  |           if (rect.width === 0 || rect.height === 0) return;
  72  |           // Skip elements far off-screen (in scroll containers)
  73  |           if (rect.top > 2000 || rect.top < -100) return;
  74  | 
  75  |           const rightMargin = vw - rect.right;
  76  |           const leftMargin = rect.left;
  77  | 
  78  |           if (rightMargin < 0) {
  79  |             const tag = el.tagName.toLowerCase();
  80  |             const text = (el.textContent || (el as HTMLInputElement).placeholder || "").slice(0, 30);
  81  |             clipped.push(`<${tag}> "${text}" overflows right by ${Math.abs(Math.round(rightMargin))}px`);
  82  |           }
  83  |           if (leftMargin < 0) {
  84  |             const tag = el.tagName.toLowerCase();
  85  |             const text = (el.textContent || "").slice(0, 30);
  86  |             clipped.push(`<${tag}> "${text}" overflows left by ${Math.abs(Math.round(leftMargin))}px`);
  87  |           }
  88  |         });
  89  |         return clipped;
  90  |       }, viewportWidth);
  91  | 
  92  |       if (clippedButtons.length > 0) {
  93  |         console.log(`[${pagePath}] Clipped interactive elements:`);
  94  |         clippedButtons.forEach((el) => console.log(`  - ${el}`));
  95  |       }
  96  | 
  97  |       // This SHOULD pass — clipped buttons are a real usability problem
  98  |       expect(
  99  |         clippedButtons.length,
  100 |         `${pagePath} has ${clippedButtons.length} clipped buttons/links:\n${clippedButtons.join("\n")}`
> 101 |       ).toBe(0);
      |         ^ Error: /dashboard/inventory has 1 clipped buttons/links:
  102 |     });
  103 |   }
  104 | });
  105 | 
```