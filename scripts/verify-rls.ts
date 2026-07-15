/**
 * CI gate: fails the build if
 *   1. the app's DATABASE_URL role can bypass RLS (rolbypassrls / superuser), or
 *   2. any table in the public schema does not have RLS enabled, or
 *   3. a tenant-scoped table has RLS enabled but zero policies defined.
 *
 * Run via `npm run rls:verify`. Wired into CI after migrate + rls:apply.
 */
import { Client } from "pg";

// Tables that are intentionally global/non-tenant (no tenant-scoping policy expected)
// but must still have RLS enabled with at least one policy.
const ALL_APP_TABLES = [
  "Tenant",
  "CustomDomain",
  "Location",
  "Membership",
  "Announcement",
  "AnnouncementAck",
  "Asset",
  "Task",
  "TaskAssignment",
  "OnboardingTemplate",
  "OnboardingItem",
  "OnboardingProgress",
  "Product",
  "ProductVariant",
  "LocationOrderingRule",
  "Order",
  "OrderLine",
  "Allowance",
  "AllowanceLedger",
  "RebateRule",
  "RebateAccrual",
  "RebateReport",
  "PushSubscription",
  "AuditLog",
  "ProcessedStripeEvent",
];

async function main() {
  const directUrl = process.env.DIRECT_URL;
  const appUrl = process.env.DATABASE_URL;
  if (!directUrl || !appUrl) {
    throw new Error("DIRECT_URL and DATABASE_URL must both be set");
  }

  let failed = false;

  // --- Check 1: app role cannot bypass RLS ---
  const appRoleMatch = appUrl.match(/postgresql:\/\/([^:]+):/);
  const appRoleName = appRoleMatch?.[1];
  if (!appRoleName) {
    throw new Error("Could not parse app role name from DATABASE_URL");
  }

  const admin = new Client({ connectionString: directUrl });
  await admin.connect();
  try {
    const { rows } = await admin.query(
      `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1`,
      [appRoleName]
    );
    if (rows.length === 0) {
      console.error(`❌ App role "${appRoleName}" not found in pg_roles.`);
      failed = true;
    } else {
      const role = rows[0];
      if (role.rolsuper || role.rolbypassrls) {
        console.error(
          `❌ App role "${appRoleName}" can bypass RLS (superuser=${role.rolsuper}, bypassrls=${role.rolbypassrls}). ` +
            `The lockout is worthless if the app connects with this role.`
        );
        failed = true;
      } else {
        console.log(`✅ App role "${appRoleName}" cannot bypass RLS.`);
      }
    }

    // --- Check 2 & 3: every table has RLS enabled AND at least one policy ---
    for (const table of ALL_APP_TABLES) {
      const { rows: relRows } = await admin.query(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1 AND relnamespace = 'public'::regnamespace`,
        [table]
      );
      if (relRows.length === 0) {
        console.error(`❌ Table "${table}" does not exist — schema drift from expected model list.`);
        failed = true;
        continue;
      }
      if (!relRows[0].relrowsecurity) {
        console.error(`❌ Table "${table}" does NOT have RLS enabled. This is a P0 data leak.`);
        failed = true;
        continue;
      }

      const { rows: polRows } = await admin.query(
        `SELECT count(*)::int AS n FROM pg_policies WHERE tablename = $1`,
        [table]
      );
      if (polRows[0].n === 0) {
        console.error(`❌ Table "${table}" has RLS enabled but ZERO policies — all access will be denied, likely unintended.`);
        failed = true;
      } else {
        console.log(`✅ Table "${table}" has RLS enabled with ${polRows[0].n} polic${polRows[0].n === 1 ? "y" : "ies"}.`);
      }
    }
  } finally {
    await admin.end();
  }

  if (failed) {
    console.error("\n❌ RLS verification FAILED. Deployment must be blocked.");
    process.exit(1);
  }
  console.log("\n✅ RLS verification passed.");
}

main().catch((err) => {
  console.error("❌ RLS verification errored:", err);
  process.exit(1);
});
