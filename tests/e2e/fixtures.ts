import { test as base, expect } from "@playwright/test";

/**
 * Shared Playwright fixtures for signing in as each of the three roles.
 *
 * Since Clerk was removed, sign-in is our own form at /sign-in backed by
 * NextAuth's credentials provider — so the fixture simply drives the real UI
 * rather than calling a vendor testing helper. No external test instance is
 * required; the fixture users must exist in the database with a password set
 * (see tests/e2e/README.md).
 */
export const test = base.extend<{ signInAs: (email: string, password: string) => Promise<void> }>({
  signInAs: async ({ page }, use) => {
    await use(async (email: string, password: string) => {
      await page.goto("/sign-in");
      await page.fill("#email", email);
      await page.fill("#password", password);
      await page.click('button[type="submit"]');
      // The form does a full navigation on success so the session cookie is
      // present on the server request that renders the dashboard.
      await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
    });
  },
});

export { expect };

export const FIXTURE_USERS = {
  kickAdmin: { email: "kick-admin@e2e.test", password: process.env.E2E_KICK_ADMIN_PASSWORD ?? "" },
  franchisor: { email: "franchisor@e2e.test", password: process.env.E2E_FRANCHISOR_PASSWORD ?? "" },
  franchisee: { email: "franchisee@e2e.test", password: process.env.E2E_FRANCHISEE_PASSWORD ?? "" },
};
