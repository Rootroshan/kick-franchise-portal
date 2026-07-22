import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { authPrisma } from "@/server/db/authClient";

/**
 * These are integration tests against a real local Postgres (`kick_test`),
 * connected as the non-superuser `kick_app_test` role so RLS is genuinely
 * enforced — RLS and row-lock concurrency behavior cannot be faithfully
 * verified against mocks.
 */

export function kickCtx(): RequestContext {
  return { tenantId: null, role: "KICK_ADMIN", locationId: null, storeRole: null, userId: "test-kick-admin" };
}

export function franchisorCtx(tenantId: string): RequestContext {
  return { tenantId, role: "FRANCHISOR_ADMIN", locationId: null, storeRole: null, userId: "test-franchisor" };
}

export function franchiseeCtx(
  tenantId: string,
  locationId: string,
  userId = "test-franchisee",
  storeRole: RequestContext["storeRole"] = "USER"
): RequestContext {
  return { tenantId, role: "FRANCHISEE_USER", locationId, storeRole, userId };
}

/**
 * Wipes all tenant-owned tables between tests. Runs as KICK_ADMIN via the
 * privileged path (raw client, bypasses RLS via superuser DIRECT connection
 * is NOT used here — deletes go through the app role, so KICK_ADMIN context
 * is required) — EXCEPT AuditLog, which has no DELETE policy at all (it's
 * deliberately append-only in production, see prisma/rls.sql). Under
 * kick_app_test's RLS-enforced role, `tx.auditLog.deleteMany()` silently
 * deletes 0 rows — no error, no thrown exception — so it has to go through
 * authPrisma (the DIRECT_URL / schema-owner connection) instead, the same
 * connection the app itself uses for the other deny-all-RLS tables (User,
 * Account, Session, Invitation).
 */
export async function resetDatabase() {
  await authPrisma.auditLog.deleteMany();
  // Notification has no DELETE RLS policy either (deny-all by omission, like
  // AuditLog) — tx.notification.deleteMany() under the RLS-enforced app role
  // silently matches 0 rows, so this must go through the schema-owner connection.
  await authPrisma.notification.deleteMany();
  await withTenant(kickCtx(), async (tx) => {
    // Platform-wide, no FK references — safe to clear first. Must be reset or
    // a row from one test leaks into the next and collides on the primary key.
    await tx.platformSetting.deleteMany();
    await tx.rebateAccrual.deleteMany();
    await tx.rebateReport.deleteMany();
    await tx.rebateRule.deleteMany();
    await tx.allowanceLedger.deleteMany();
    await tx.allowance.deleteMany();
    await tx.orderLine.deleteMany();
    await tx.order.deleteMany();
    await tx.locationOrderingRule.deleteMany();
    await tx.productVariant.deleteMany();
    await tx.product.deleteMany();
    await tx.onboardingProgress.deleteMany();
    await tx.onboardingItem.deleteMany();
    await tx.onboardingTemplate.deleteMany();
    await tx.taskAssignment.deleteMany();
    await tx.task.deleteMany();
    await tx.asset.deleteMany();
    await tx.announcementAck.deleteMany();
    await tx.announcementRead.deleteMany();
    await tx.announcement.deleteMany();
    await tx.pushSubscription.deleteMany();
    // Notification is handled above via authPrisma (no DELETE RLS policy).
    // Tenant-scoped memberships cascade with tenant.deleteMany() below, but a
    // platform-wide KICK_ADMIN membership (tenantId null) has no tenant FK to
    // cascade from and must be cleared explicitly, or it leaks across tests
    // that reuse the same clerkUserId (e.g. "kick-admin-1").
    await tx.membership.deleteMany({ where: { tenantId: null } });
    await tx.processedStripeEvent.deleteMany();
    await tx.customDomain.deleteMany();
    await tx.membership.deleteMany();
    await tx.location.deleteMany();
    await tx.tenant.deleteMany();
  });
}

export async function seedTenantWithLocation() {
  return withTenant(kickCtx(), async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: "Test Brand", slug: `test-brand-${Date.now()}-${Math.floor(Math.random() * 1e6)}` },
    });
    const domain = await tx.customDomain.create({
      data: {
        tenantId: tenant.id,
        hostname: `portal.${tenant.slug}.test`,
        status: "VERIFIED",
        verificationToken: `test-${tenant.id}`,
        verifiedAt: new Date(),
      },
    });
    const location = await tx.location.create({
      data: { tenantId: tenant.id, name: "Test Store #1" },
    });
    return { tenant, location, domain };
  });
}
