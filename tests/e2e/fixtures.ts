import { test as base, expect } from "@playwright/test";
import { clerkSetup, clerk } from "@clerk/testing/playwright";

/**
 * Shared Playwright fixtures for signing in as each of the three roles via
 * Clerk's official testing helpers (@clerk/testing). Requires a real Clerk
 * test-mode instance configured via CLERK_SECRET_KEY/
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in the environment — see tests/e2e/README.md
 * for the fixture users these specs expect to already exist.
 */
export const test = base.extend<{ signInAs: (email: string, password: string) => Promise<void> }>({
  signInAs: async ({ page }, use) => {
    await clerkSetup();
    await use(async (email: string, password: string) => {
      await page.goto("/sign-in");
      await clerk.signIn({
        page,
        signInParams: { strategy: "password", identifier: email, password },
      });
    });
  },
});

export { expect };

export const FIXTURE_USERS = {
  kickAdmin: { email: "kick-admin@e2e.test", password: process.env.E2E_KICK_ADMIN_PASSWORD ?? "" },
  franchisor: { email: "franchisor@e2e.test", password: process.env.E2E_FRANCHISOR_PASSWORD ?? "" },
  franchisee: { email: "franchisee@e2e.test", password: process.env.E2E_FRANCHISEE_PASSWORD ?? "" },
};
