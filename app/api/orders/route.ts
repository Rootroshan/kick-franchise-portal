import { z } from "zod";
import { requireRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseSearchParams } from "@/server/lib/apiHandler";
import { listStoreOrders, getStoreOrderSummary } from "@/server/modules/commerce/storeOrders";

const listQuerySchema = z.object({
  status: z.enum(["processing", "shipped", "delivered", "cancelled", "refunded", "failed"]).optional(),
  q: z.string().max(200).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["newest", "oldest", "total_desc", "total_asc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(50).optional(),
});

/**
 * Store User order list: server-side pagination + aggregate summary counts,
 * scoped to the caller's own (tenant, location) — see storeOrders.ts.
 * FRANCHISOR_ADMIN gets 403 from requireRole before any query runs;
 * KICK_ADMIN uses /admin/orders (listOrdersAdmin), not this endpoint.
 */
export const GET = withErrorHandling(async (req) => {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const query = parseSearchParams(req.url, listQuerySchema);

  const [list, summary] = await Promise.all([listStoreOrders(ctx, query), getStoreOrderSummary(ctx)]);
  return Response.json({ ...list, summary });
});
