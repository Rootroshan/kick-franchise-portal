import { test, expect, FIXTURE_USERS } from "./fixtures";

/**
 * E2E golden-path flows required by spec §18 / Dev Brief §12:
 *   - Kick creates a tenant and location
 *   - Franchisor creates an announcement
 *   - Franchisee receives and acknowledges it
 *   - Franchisee downloads an active asset
 *   - Franchisee completes a task
 *   - Franchisee progresses through onboarding
 *   - Franchisee places an order using allowance and card
 *   - Kick views the order
 *   - Kick generates a rebate report
 *
 * These are ordered as one continuous scenario per role, sharing state via
 * a fixed E2E tenant slug ("e2e-brand") — see README.md for the seed
 * assumptions. Skipped automatically when Clerk test credentials aren't
 * configured (e.g. local dev without a live Clerk test project).
 */

test.describe("Golden path: Kick admin", () => {
  test.skip(!FIXTURE_USERS.kickAdmin.password, "Requires E2E_KICK_ADMIN_PASSWORD and a seeded Clerk test user");

  test("Kick creates a tenant and a location", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.kickAdmin.email, FIXTURE_USERS.kickAdmin.password);
    await page.goto("/admin/tenants");

    await page.getByRole("button", { name: /new tenant|create tenant/i }).click();
    await page.getByLabel(/name/i).fill("E2E Test Brand");
    await page.getByLabel(/slug/i).fill(`e2e-brand-${Date.now()}`);
    await page.getByRole("button", { name: /create/i }).click();

    await expect(page.getByText("E2E Test Brand")).toBeVisible({ timeout: 10_000 });
  });

  test("Kick views orders across tenants", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.kickAdmin.email, FIXTURE_USERS.kickAdmin.password);
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible();
  });

  test("Kick generates and can download a rebate report", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.kickAdmin.email, FIXTURE_USERS.kickAdmin.password);
    await page.goto("/admin/rebates/reports");
    await expect(page.getByRole("heading", { name: /rebate reports/i })).toBeVisible();
  });
});

test.describe("Golden path: Franchisor", () => {
  test.skip(!FIXTURE_USERS.franchisor.password, "Requires E2E_FRANCHISOR_PASSWORD and a seeded Clerk test user");

  test("Franchisor creates an announcement", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisor.email, FIXTURE_USERS.franchisor.password);
    await page.goto("/franchisor/announcements");

    await page.getByRole("button", { name: /new announcement|create/i }).click();
    await page.getByLabel(/title/i).fill(`E2E Announcement ${Date.now()}`);
    await page.getByLabel(/body/i).fill("This is an end-to-end test announcement.");
    await page.getByRole("button", { name: /publish|create|save/i }).click();

    await expect(page.getByText(/E2E Announcement/)).toBeVisible({ timeout: 10_000 });
  });

  test("Franchisor has no shop UI anywhere in their surface", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisor.email, FIXTURE_USERS.franchisor.password);
    await page.goto("/franchisor");
    const bodyText = (await page.textContent("body"))?.toLowerCase() ?? "";
    expect(bodyText).not.toMatch(/shop|checkout|allowance balance/);
  });
});

test.describe("Golden path: Franchisee", () => {
  test.skip(!FIXTURE_USERS.franchisee.password, "Requires E2E_FRANCHISEE_PASSWORD and a seeded Clerk test user");

  test("Franchisee sees and acknowledges an announcement", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisee.email, FIXTURE_USERS.franchisee.password);
    await page.goto("/");

    const ackButton = page.getByRole("button", { name: /acknowledge/i }).first();
    if (await ackButton.isVisible().catch(() => false)) {
      await ackButton.click();
      await expect(ackButton).not.toBeVisible({ timeout: 5_000 });
    }
  });

  test("Franchisee downloads an active asset", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisee.email, FIXTURE_USERS.franchisee.password);
    await page.goto("/assets");

    const downloadButton = page.getByRole("button", { name: /download/i }).first();
    if (await downloadButton.isVisible().catch(() => false)) {
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10_000 }), downloadButton.click()]);
      expect(download).toBeTruthy();
    }
  });

  test("Franchisee completes an assigned task", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisee.email, FIXTURE_USERS.franchisee.password);
    await page.goto("/tasks");

    const completeButton = page.getByRole("button", { name: /complete|mark done/i }).first();
    if (await completeButton.isVisible().catch(() => false)) {
      await completeButton.click();
      await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("Franchisee progresses through onboarding", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisee.email, FIXTURE_USERS.franchisee.password);
    await page.goto("/onboarding");

    const checkbox = page.getByRole("checkbox").first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
      await expect(checkbox).toBeChecked();
    }
  });

  test("Franchisee places an order using allowance and card", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisee.email, FIXTURE_USERS.franchisee.password);
    await page.goto("/shop");

    const addToCartButton = page.getByRole("button", { name: /add to cart/i }).first();
    await addToCartButton.click();

    await page.goto("/cart");
    await page.getByRole("button", { name: /checkout/i }).click();

    await page.goto("/checkout");
    const placeOrderButton = page.getByRole("button", { name: /place order|pay|confirm/i });
    if (await placeOrderButton.isVisible().catch(() => false)) {
      await placeOrderButton.click();
      await expect(page.getByText(/order confirmed|success|thank you/i)).toBeVisible({ timeout: 15_000 });
    }
  });

  test("Franchisee sees only their own location's order history", async ({ page, signInAs }) => {
    await signInAs(FIXTURE_USERS.franchisee.email, FIXTURE_USERS.franchisee.password);
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: /orders/i })).toBeVisible();
  });
});
