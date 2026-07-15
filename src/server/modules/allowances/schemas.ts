import { z } from "zod";

export const grantAllowanceSchema = z.object({
  locationId: z.string().uuid(),
  periodLabel: z.string().regex(/^\d{4}-(Q[1-4]|M(0[1-9]|1[0-2]))$/, "Expected format YYYY-Q# or YYYY-M##"),
  grantedCents: z.number().int().positive(),
  currency: z.string().length(3).optional().default("CAD"),
  overflow: z.enum(["BLOCK", "CHARGE_CARD"]).optional().default("CHARGE_CARD"),
});

export const adjustAllowanceSchema = z.object({
  allowanceId: z.string().uuid(),
  deltaCents: z.number().int(),
  reason: z.literal("ADJUSTMENT").optional().default("ADJUSTMENT"),
});
