import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, franchiseeCtx, resetDatabase } from "../helpers/db";

/**
 * Proves one tenant cannot access another tenant's operational data (spec
 * §12 e2e requirement: "one tenant cannot access another tenant's data").
 * Distinct from the commerce lockout tests — this checks ordinary
 * tenant-scoped tables (Announcement, Task, Asset) that BOTH
 * FRANCHISOR_ADMIN and FRANCHISEE_USER are otherwise allowed to touch,
 * just never across tenant boundaries.
 */
describe("Cross-tenant isolation: a tenant cannot see another tenant's operational data", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function seedTwoTenants() {
    return withTenant(kickCtx(), async (tx) => {
      const tenantA = await tx.tenant.create({ data: { name: "Brand A", slug: `brand-a-${Date.now()}` } });
      const tenantB = await tx.tenant.create({ data: { name: "Brand B", slug: `brand-b-${Date.now()}` } });
      const locationA = await tx.location.create({ data: { tenantId: tenantA.id, name: "A Store" } });
      const locationB = await tx.location.create({ data: { tenantId: tenantB.id, name: "B Store" } });
      return { tenantA, tenantB, locationA, locationB };
    });
  }

  it("a franchisor in tenant A cannot see tenant B's announcements", async () => {
    const { tenantA, tenantB } = await seedTwoTenants();
    await withTenant(kickCtx(), (tx) =>
      tx.announcement.create({
        data: { tenantId: tenantB.id, title: "B-only announcement", body: "secret", status: "PUBLISHED", createdBy: "seed" },
      })
    );

    const asFranchisorA = await withTenant(franchisorCtx(tenantA.id), (tx) => tx.announcement.findMany());
    expect(asFranchisorA).toHaveLength(0);
  });

  it("a franchisee in tenant A location cannot see tenant B's tasks", async () => {
    const { tenantA, tenantB, locationA, locationB } = await seedTwoTenants();
    const taskB = await withTenant(kickCtx(), (tx) => tx.task.create({ data: { tenantId: tenantB.id, title: "B task", createdBy: "seed" } }));
    await withTenant(kickCtx(), (tx) => tx.taskAssignment.create({ data: { taskId: taskB.id, locationId: locationB.id } }));

    const asFranchiseeA = await withTenant(franchiseeCtx(tenantA.id, locationA.id), (tx) => tx.taskAssignment.findMany());
    expect(asFranchiseeA).toHaveLength(0);
  });

  it("a franchisee cannot see another location's onboarding progress within the SAME tenant", async () => {
    const { tenantA, locationA } = await seedTwoTenants();
    const otherLocation = await withTenant(kickCtx(), (tx) => tx.location.create({ data: { tenantId: tenantA.id, name: "Other Store A" } }));

    const template = await withTenant(kickCtx(), (tx) =>
      tx.onboardingTemplate.create({ data: { tenantId: tenantA.id, name: "Template" } })
    );
    const item = await withTenant(kickCtx(), (tx) =>
      tx.onboardingItem.create({ data: { templateId: template.id, title: "Step 1", order: 0 } })
    );
    await withTenant(kickCtx(), (tx) =>
      tx.onboardingProgress.create({ data: { locationId: otherLocation.id, templateId: template.id, itemId: item.id, done: true } })
    );

    const asMyLocation = await withTenant(franchiseeCtx(tenantA.id, locationA.id), (tx) => tx.onboardingProgress.findMany());
    expect(asMyLocation).toHaveLength(0);
  });

  it("a franchisor cannot see another tenant's assets even if it knows the asset id", async () => {
    const { tenantA, tenantB } = await seedTwoTenants();
    const assetB = await withTenant(kickCtx(), (tx) =>
      tx.asset.create({
        data: { tenantId: tenantB.id, name: "B Logo", type: "logo", storageKey: "k", mime: "image/png", sizeBytes: 100, createdBy: "seed" },
      })
    );

    const found = await withTenant(franchisorCtx(tenantA.id), (tx) => tx.asset.findUnique({ where: { id: assetB.id } }));
    expect(found).toBeNull();
  });
});
