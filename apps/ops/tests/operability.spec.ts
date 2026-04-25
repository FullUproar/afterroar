/**
 * Operability smoke test — Operator Console refactor.
 *
 * Visits each major Store Ops route and verifies:
 *   1. The page renders without an HTTP error.
 *   2. The body has no console errors flagged on load.
 *   3. The new sidebar masthead ("AFTERROAR / STORE OPS") is visible.
 *   4. Primary text content is rendered (header / KPI label / etc).
 *
 * Runs against the configured baseURL (production by default).
 * Use the auth-tagged projects so it picks up the saved auth state.
 *
 * Run all viewports:
 *   npx playwright test tests/operability.spec.ts
 *
 * Run a single viewport:
 *   npx playwright test tests/operability.spec.ts --project=auth-desktop
 */
import { test, expect, type Page } from "@playwright/test";

const ROUTES: Array<{ path: string; expect: string }> = [
  { path: "/dashboard", expect: "Console" },
  { path: "/dashboard/inventory", expect: "Inventory" },
  { path: "/dashboard/customers", expect: "Customers" },
  { path: "/dashboard/events", expect: "Events" },
  { path: "/dashboard/orders", expect: "Orders" },
  { path: "/dashboard/cash-flow", expect: "Intelligence" },
  { path: "/dashboard/staff", expect: "Staff" },
  { path: "/dashboard/settings", expect: "Settings" },
  { path: "/dashboard/reports", expect: "Reports" },
  { path: "/dashboard/catalog", expect: "TCG" },
  { path: "/dashboard/deck-builder", expect: "Deck" },
  { path: "/dashboard/buylist", expect: "Buylist" },
  { path: "/dashboard/drawer", expect: "Drawer" },
  { path: "/dashboard/returns", expect: "Returns" },
  { path: "/dashboard/help", expect: "Help" },
];

async function checkRoute(page: Page, path: string, expectText: string) {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const response = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  expect(response, `Route ${path} returned no response`).toBeTruthy();
  expect(response!.status(), `Route ${path} returned ${response!.status()}`).toBeLessThan(500);

  // Wait briefly for client hydration
  await page.waitForTimeout(1500);

  // Verify a key piece of expected text exists somewhere on the page
  const matches = await page.locator(`text=${expectText}`).count();
  expect(matches, `Route ${path} did not render any "${expectText}" text`).toBeGreaterThan(0);

  // Ignore Sentry / analytics noise — only fail on application errors
  const appErrors = errors.filter(
    (e) =>
      !e.includes("Sentry") &&
      !e.includes("favicon") &&
      !e.includes("manifest") &&
      !e.includes("ResizeObserver") &&
      !e.includes("AbortError"),
  );
  expect(
    appErrors.length,
    `Route ${path} produced ${appErrors.length} console errors:\n${appErrors.slice(0, 5).join("\n")}`,
  ).toBe(0);
}

test.describe("authenticated: operability smoke", () => {
  for (const route of ROUTES) {
    test(`renders without errors — ${route.path}`, async ({ page }) => {
      await checkRoute(page, route.path, route.expect);
    });
  }

  test("sidebar masthead is present on Console (desktop)", async ({ page, viewport }) => {
    if (!viewport || viewport.width < 1024) {
      test.skip();
    }
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1500);

    // The Operator Console sidebar shows "Afterroar" small mono caps + "Store Ops" larger
    await expect(page.locator("aside").locator("text=Afterroar").first()).toBeVisible();
    await expect(page.locator("aside").locator("text=Store Ops").first()).toBeVisible();
  });

  test("primary action 'Open Register' is reachable", async ({ page, viewport }) => {
    if (!viewport || viewport.width < 1024) {
      test.skip();
    }
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1500);

    const openReg = page.getByRole("link", { name: /Open Register/i }).first();
    await expect(openReg).toBeVisible();
  });

  test("live-status API responds", async ({ page }) => {
    const res = await page.request.get("/api/dashboard/live-status");
    expect(res.status(), "live-status API returned a non-2xx").toBeLessThan(400);
    const body = await res.json();
    // Shape check: the four counts the Sidebar consumes
    expect(body).toHaveProperty("register_live");
    expect(body).toHaveProperty("buylist_waiting");
    expect(body).toHaveProperty("inventory_low");
    expect(body).toHaveProperty("devices_offline");
  });
});
