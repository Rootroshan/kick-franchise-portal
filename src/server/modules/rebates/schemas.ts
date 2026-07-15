import { z } from "zod";

export const createRebateRuleSchema = z
  .object({
    productId: z.string().uuid(),
    type: z.enum(["FLAT", "PERCENT"]),
    value: z.number().int().positive(), // FLAT = cents; PERCENT = basis points
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().nullable().optional(),
  })
  .refine((v) => v.type !== "PERCENT" || v.value <= 10_000, {
    message: "Percent rebate value (basis points) cannot exceed 10000 (100%)",
    path: ["value"],
  });

export const reportQuerySchema = z.object({
  period: z.enum(["MONTHLY", "QUARTERLY"]),
  periodLabel: z.string().min(4),
  tenantId: z.string().uuid().optional(),
});
