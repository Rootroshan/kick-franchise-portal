import { test, expect, FIXTURE_USERS } from "./fixtures";

/**
 * E2E: franchisor has no commerce UI or commerce data access anywhere in
 * the app (spec §18, Dev Brief §12). This is the browser-level companion
 * to the vitest lockout suite (tests/lockout/) — it proves the ABSENCE of
 * commerce UI, not just that the API 403s.
 */
test.describe("Franchisor lockout (browser-level)", () => {
  test.skip(!FIXTURE_USERS.franchisor.password, "Requires E2E_FRANCHISOR_PASSWORD and a seeded Clerk test user");

  test("franchisor dashboard contains no shop/product/price/order/allowance/rebate UI", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisor.email, FIXTURE_USERS.franchisor.password);
    await page.goto("/");

    const bodyText = (await page.textContent("body"))?.toLowerCase() ?? "";
    for (const forbidden of ["add to cart", "checkout", "product price", "allowance balance", "rebate rule", "sku"]) {
      expect(bodyText).not.toContain(forbidden);
    }

    // No links/nav items should point at commerce-only routes.
    const hrefs = await page.$$eval("a[href]", (anchors) => anchors.map((a) => a.getAttribute("href") ?? ""));
    for (const href of hrefs) {
      expect(href).not.toMatch(/\/(shop|cart|checkout|orders|allowances|rebates)(\/|$)/);
    }
  });

  test("navigating directly to a commerce API route as franchisor returns 403", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisor.email, FIXTURE_USERS.franchisor.password);
    const response = await page.request.get("/api/commerce/products");
    expect(response.status()).toBe(403);
  });

  test("navigating directly to a commerce page URL redirects or 404s, never renders commerce content", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisor.email, FIXTURE_USERS.franchisor.password);
    await page.goto("/admin/commerce", { waitUntil: "domcontentloaded" });
    // Franchisor is not KICK_ADMIN, so this must not render the admin commerce page.
    const bodyText = (await page.textContent("body"))?.toLowerCase() ?? "";
    expect(bodyText).not.toContain("add product");
    expect(bodyText).not.toContain("price cents");
  });
});
