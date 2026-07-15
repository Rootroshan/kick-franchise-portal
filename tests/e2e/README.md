# E2E test notes

These Playwright specs exercise the golden-path flows required by tech spec
§18 and Dev Brief §12: tenant/location creation, announcement lifecycle,
asset download, task completion, onboarding, allowance+card checkout, rebate
reporting, and the franchisor lockout (no commerce UI, no cross-tenant
access).

**Auth strategy**: Clerk-gated E2E tests normally require either Clerk's
testing-token flow or seeded test users with known credentials. Since this
environment has no live Clerk project configured, these specs assume a test
Clerk instance is configured in CI via `CLERK_SECRET_KEY`/publishable key
pointing at a real (non-production) Clerk application seeded with the fixture
users below, OR that `@clerk/testing`'s `setupClerkTestingToken()` helper is
wired up once real Clerk credentials exist. The specs are written against
that assumption and will need real Clerk test-mode credentials in CI env vars
to run against a live server — they cannot pass against placeholder Stripe/
Clerk keys alone, since sign-in requires a real identity provider round trip.

Fixture users expected to exist in the seeded test Clerk org (create via the
Kick admin UI + Clerk dashboard, or a seed script, before running):
  - kick-admin@e2e.test        (KICK_ADMIN)
  - franchisor@e2e.test        (FRANCHISOR_ADMIN, tenant "e2e-brand")
  - franchisee@e2e.test        (FRANCHISEE_USER, tenant "e2e-brand", location "E2E Store")
