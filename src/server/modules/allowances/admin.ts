import { withTenant, type RequestContext } from "@/server/db/withTenant";
import { writeAuditLog } from "@/server/modules/identity/audit";
import { HttpError } from "@/server/modules/identity/errors";
import { computeAllowanceBalance, appendLedgerCredit } from "./ledger";
import type { z } from "zod";
import type { grantAllowanceSchema, adjustAllowanceSchema } from "./schemas";

/** KICK_ADMIN only — enforced by requireRole() at the route layer. */
export async function grantAllowance(ctx: RequestContext, tenantId: string, input: z.infer<typeof grantAllowanceSchema>) {
  return withTenant(ctx, async (tx) => {
    const location = await tx.location.findUnique({ where: { id: input.locationId } });
    if (!location || location.tenantId !== tenantId) {
      throw new HttpError(404, "Location not found for this tenant");
    }

    const preExisting = await tx.allowance.findUnique({
      where: { locationId_periodLabel: { locationId: input.locationId, periodLabel: input.periodLabel } },
    });

    const allowance = await tx.allowance.upsert({
      where: { locationId_periodLabel: { locationId: input.locationId, periodLabel: input.periodLabel } },
      create: {
        tenantId,
        locationId: input.locationId,
        periodLabel: input.periodLabel,
        grantedCents: input.grantedCents,
        currency: input.currency,
        overflow: input.overflow,
        createdBy: ctx.userId,
      },
      update: {}, // grants for an existing period are additive via ledger GRANT entries, not overwrite
    });

    // If the allowance already existed, record the additional grant as a ledger entry
    // rather than mutating grantedCents (keeps the ledger as sole source of truth for adjustments).
    let ledgerEntry = null;
    if (preExisting) {
      ledgerEntry = await appendLedgerCredit(tx, {
        allowanceId: allowance.id,
        orderId: null,
        deltaCents: input.grantedCents,
        reason: "GRANT",
      });
    }

    await writeAuditLog(tx, {
      tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "allowance.grant",
      entity: "Allowance",
      entityId: allowance.id,
      after: { ...allowance, additionalGrantLedgerId: ledgerEntry?.id ?? null },
    });

    return allowance;
  });
}

export async function adjustAllowance(ctx: RequestContext, input: z.infer<typeof adjustAllowanceSchema>) {
  return withTenant(ctx, async (tx) => {
    const allowance = await tx.allowance.findUnique({ where: { id: input.allowanceId } });
    if (!allowance) throw new HttpError(404, "Allowance not found");

    const balanceBefore = await computeAllowanceBalance(tx, allowance.id);
    const balanceAfter = balanceBefore + input.deltaCents;

    const entry = await tx.allowanceLedger.create({
      data: {
        allowanceId: allowance.id,
        deltaCents: input.deltaCents,
        balanceAfter,
        reason: "ADJUSTMENT",
      },
    });

    await writeAuditLog(tx, {
      tenantId: allowance.tenantId,
      actorId: ctx.userId,
      role: ctx.role,
      action: "allowance.adjust",
      entity: "AllowanceLedger",
      entityId: entry.id,
      before: { balanceBefore },
      after: { balanceAfter, deltaCents: input.deltaCents },
    });

    return entry;
  });
}

export async function listAllowances(ctx: RequestContext, tenantId: string) {
  return withTenant(ctx, (tx) => tx.allowance.findMany({ where: { tenantId }, include: { location: true } }));
}

export async function getOwnAllowanceBalance(ctx: RequestContext) {
  if (ctx.role !== "FRANCHISEE_USER" || !ctx.locationId) {
    throw new HttpError(403, "Forbidden");
  }
  return withTenant(ctx, async (tx) => {
    const allowances = await tx.allowance.findMany({ where: { locationId: ctx.locationId! } });
    const balances = await Promise.all(
      allowances.map(async (a) => ({
        allowanceId: a.id,
        periodLabel: a.periodLabel,
        grantedCents: a.grantedCents,
        currency: a.currency,
        balanceCents: await computeAllowanceBalance(tx, a.id),
      }))
    );
    return balances;
  });
}

/**
 * Usage report grouped by tenant and location — franchisors fund allowances,
 * Kick bills them for it, so this report is a required deliverable (spec §6/§11.1).
 */
export async function getAllowanceUsageReport(ctx: RequestContext, tenantId?: string) {
  return withTenant(ctx, async (tx) => {
    const allowances = await tx.allowance.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: {
        location: true,
        tenant: true,
        ledger: true,
      },
    });

    return allowances.map((a) => {
      const granted = a.ledger.filter((l) => l.reason === "GRANT").reduce((s, l) => s + l.deltaCents, a.grantedCents);
      const debited = a.ledger.filter((l) => l.reason === "ORDER_DEBIT").reduce((s, l) => s + Math.abs(l.deltaCents), 0);
      const refunded = a.ledger.filter((l) => l.reason === "REFUND_CREDIT").reduce((s, l) => s + l.deltaCents, 0);
      const adjusted = a.ledger.filter((l) => l.reason === "ADJUSTMENT").reduce((s, l) => s + l.deltaCents, 0);
      const balance = granted - debited + refunded + adjusted;

      return {
        tenantId: a.tenantId,
        tenantName: a.tenant.name,
        locationId: a.locationId,
        locationName: a.location.name,
        periodLabel: a.periodLabel,
        grantedCents: granted,
        debitedCents: debited,
        refundedCents: refunded,
        adjustedCents: adjusted,
        balanceCents: balance,
        currency: a.currency,
      };
    });
  });
}
