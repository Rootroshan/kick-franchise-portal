import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { getAuditKpis } from "@/server/modules/identity/auditList";

/**
 * distinctActors was rewritten from `findMany({distinct})` (reads back one
 * row per distinct actor, unbounded) to a raw `COUNT(DISTINCT ...)` — this
 * pins that the count is still exactly right, including when the same actor
 * appears multiple times (the whole point of "distinct").
 */
describe("getAuditKpis", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("counts each actor once even when they appear in multiple log rows", async () => {
    const { tenant } = await seedTenantWithLocation();

    await withTenant(kickCtx(), async (tx) => {
      // actor-1 appears 3 times, actor-2 appears once — 2 distinct actors.
      for (let i = 0; i < 3; i++) {
        await tx.auditLog.create({
          data: { tenantId: tenant.id, actorId: "actor-1", role: "KICK_ADMIN", action: "tenant.update", entity: "Tenant", entityId: tenant.id },
        });
      }
      await tx.auditLog.create({
        data: { tenantId: tenant.id, actorId: "actor-2", role: "KICK_ADMIN", action: "tenant.update", entity: "Tenant", entityId: tenant.id },
      });
    });

    const kpis = await getAuditKpis(kickCtx());
    expect(kpis.total).toBe(4);
    expect(kpis.distinctActors).toBe(2);
  });

  it("returns zero distinct actors when the log is empty", async () => {
    const kpis = await getAuditKpis(kickCtx());
    expect(kpis.distinctActors).toBe(0);
    expect(kpis.total).toBe(0);
  });
});
