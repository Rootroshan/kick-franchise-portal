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
