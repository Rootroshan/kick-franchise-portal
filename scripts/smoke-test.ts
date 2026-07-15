/**
 * Post-deploy smoke test (spec §19 CI/CD step 12). Hits a handful of
 * unauthenticated, low-risk endpoints against a deployed environment to
 * confirm the app booted correctly, without requiring test credentials.
 *
 * Usage: SMOKE_BASE_URL=https://portal.kickmedia.com npx tsx scripts/smoke-test.ts
 */
async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL;
  if (!baseUrl) {
    throw new Error("SMOKE_BASE_URL is required, e.g. https://portal.kickmedia.com");
  }

  const checks: Array<{ name: string; path: string; expectStatus: number[] }> = [
    { name: "manifest responds", path: "/manifest.webmanifest", expectStatus: [200] },
    { name: "service worker is served", path: "/sw.js", expectStatus: [200] },
    // Unauthenticated API calls must be rejected, never 500 — proves the
    // app booted and auth guards are wired, without needing credentials.
    { name: "commerce API requires auth", path: "/api/commerce/products", expectStatus: [401, 403] },
    { name: "stripe webhook requires signature", path: "/api/webhooks/stripe", expectStatus: [400] },
  ];

  let failed = 0;
  for (const check of checks) {
    const url = `${baseUrl}${check.path}`;
    try {
      const res = await fetch(url, check.path === "/api/webhooks/stripe" ? { method: "POST", body: "{}" } : undefined);
      if (!check.expectStatus.includes(res.status)) {
        console.error(`❌ ${check.name}: expected one of [${check.expectStatus.join(", ")}], got ${res.status}`);
        failed++;
      } else {
        console.log(`✅ ${check.name} (${res.status})`);
      }
    } catch (err) {
      console.error(`❌ ${check.name}: request failed — ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n❌ Smoke tests failed: ${failed} check(s) did not pass.`);
    process.exit(1);
  }
  console.log("\n✅ All smoke checks passed.");
}

main().catch((err) => {
  console.error("❌ Smoke test run errored:", err);
  process.exit(1);
});
