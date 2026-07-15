import { systemKickContext, withTenant } from "@/server/db/withTenant";

/**
 * Optional (spec §12): grants the next period's allowance for locations that
 * had one in the just-ended period, carrying forward the same grantedCents/
 * overflow config. Disabled by default — Kick admins grant allowances
 * explicitly via /api/allowances in the MVP; this job exists so a tenant can
 * opt into automatic rollover later without a schema change.
 */
export async function rolloverAllowancesForNewPeriod(newPeriodLabel: string, previousPeriodLabel: string) {
  const previous = await withTenant(systemKickContext(), (tx) =>
    tx.allowance.findMany({ where: { periodLabel: previousPeriodLabel } })
  );

  let created = 0;
  for (const allowance of previous) {
    await withTenant(systemKickContext(), async (tx) => {
      const existing = await tx.allowance.findUnique({
        where: { locationId_periodLabel: { locationId: allowance.locationId, periodLabel: newPeriodLabel } },
      });
      if (existing) return;

      await tx.allowance.create({
        data: {
          tenantId: allowance.tenantId,
          locationId: allowance.locationId,
          periodLabel: newPeriodLabel,
          grantedCents: allowance.grantedCents,
          currency: allowance.currency,
          overflow: allowance.overflow,
          createdBy: "system-rollover",
        },
      });
      created++;
    });
  }

  return { created };
}
