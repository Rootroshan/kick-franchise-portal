import { test, expect } from "@playwright/test";

/**
 * Smoke coverage for the surfaces this release touched. Runs as KICK_ADMIN
 * via DEV_BYPASS_AUTH (.env.local). Franchisor/franchisee portals resolve
 * their tenant from the request host, which localhost can't provide — their
 * pages are covered by the vitest integration suite instead; here we assert
 * the host-resolved login page fails CLOSED (safe notice, no login form).
 */

test("admin announcements list renders with tabs, cards area and dashboard rail", async ({ page }) => {
  await page.goto("/admin/announcements");
  await expect(page.getByRole("main").getByRole("heading", { name: "Announcements", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Draft" })).toBeVisible();
  await expect(page.getByText("Announcement Overview")).toBeVisible();
  await expect(page.getByText("Publish Calendar")).toBeVisible();
  await expect(page.getByText("Recent Activity")).toBeVisible();
});

test("admin create-announcement composer renders with publish options and live summary", async ({ page }) => {
  await page.goto("/admin/announcements/new");
  await expect(page.getByRole("main").getByRole("heading", { name: "Create Announcement" })).toBeVisible();
  await expect(page.getByText("Publish Options")).toBeVisible();
  await expect(page.getByText("Announcement Summary")).toBeVisible();
  await expect(page.getByText("Tips")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Draft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish Announcement" })).toBeVisible();
});

test("create composer switches primary button label in schedule mode", async ({ page }) => {
  await page.goto("/admin/announcements/new");
  // check() retries until the input is actually interactive — a plain text
  // click can land before hydration under parallel-worker load and no-op.
  const scheduleRadio = page.getByRole("radio", { name: /Schedule for Later/ });
  await scheduleRadio.check();
  await expect(scheduleRadio).toBeChecked();
  await expect(page.getByRole("button", { name: "Schedule Announcement" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel(/Publish at/)).toBeVisible();
});

test("admin artwork hub renders", async ({ page }) => {
  await page.goto("/admin/artwork");
  await expect(page.getByRole("main").getByRole("heading", { name: "Artwork Hub" })).toBeVisible();
});

test("store-login fails closed on an unrecognised host (no login form leaked)", async ({ page }) => {
  await page.goto("/store-login");
  await expect(page.getByText("Portal not available")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
});

test("admin orders list renders with KPI cards, order-reference column, filters and export action", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page.getByRole("main").getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await expect(page.getByText("Total Orders")).toBeVisible();
  await expect(page.getByText("Net Revenue")).toBeVisible();
  await expect(page.getByLabel("From date")).toBeVisible();
  await expect(page.getByLabel("To date")).toBeVisible();

  // Selecting a row surfaces the bulk toolbar with the export action —
  // regression guard for the RSC-boundary crash this action's icon/action
  // once triggered when defined inline in the (server) page component.
  const firstCheckbox = page.locator('tbody input[type="checkbox"]').first();
  if (await firstCheckbox.count()) {
    await firstCheckbox.check();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  }
});

test("admin order detail renders without crashing for a real order", async ({ page }) => {
  await page.goto("/admin/orders");
  const rows = page.locator("tbody tr");
  if ((await rows.count()) === 0) test.skip(true, "no seeded orders to open");
  // The order-reference cell (e.g. "MGC-1001") is the most specific, stable
  // link to click — every cell in the row links to the same detail page.
  const orderRefLink = rows.first().locator("a").first();
  await orderRefLink.click();
  await page.waitForURL(/\/admin\/orders\/[a-f0-9-]+$/);
  await expect(page.getByRole("main").getByText("Subtotal", { exact: true })).toBeVisible();
});
