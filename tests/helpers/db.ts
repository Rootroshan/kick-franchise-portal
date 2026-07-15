import { withTenant, type RequestContext } from "@/server/db/withTenant";

/**
 * These are integration tests against a real local Postgres (`kick_test`),
 * connected as the non-superuser `kick_app_test` role so RLS is genuinely
 * enforced — RLS and row-lock concurrency behavior cannot be faithfully
 * verified against mocks.
 */

export function kickCtx(): RequestContext {
  return { tenantId: null, role: "KICK_ADMIN", locationId: null, userId: "test-kick-admin" };
}

export function franchisorCtx(tenantId: string): RequestContext {
  return { tenantId, role: "FRANCHISOR_ADMIN", locationId: null, userId: "test-franchisor" };
}

export function franchiseeCtx(tenantId: string, locationId: string, userId = "test-franchisee"): RequestContext {
  return { tenantId, role: "FRANCHISEE_USER", locationId, userId };
}

/** Wipes all tenant-owned tables between tests. Runs as KICK_ADMIN via the privileged path (raw client, bypasses RLS via superuser DIRECT connection is NOT used here — deletes go through the app role, so KICK_ADMIN context is required). */
export async function resetDatabase() {
  await withTenant(kickCtx(), async (tx) => {
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
    await tx.announcement.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.pushSubscription.deleteMany();
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
    const location = await tx.location.create({
      data: { tenantId: tenant.id, name: "Test Store #1" },
    });
    return { tenant, location };
  });
}
