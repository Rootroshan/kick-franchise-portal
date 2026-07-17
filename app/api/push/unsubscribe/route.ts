import { z } from "zod";
import { requireAnyRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { withTenant } from "@/server/db/withTenant";

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

/** [K,F,U]: remove the caller's own push subscription by endpoint. Scoped to
 *  the authenticated user so one user can't delete another's subscription. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireAnyRole();
  const input = await parseJsonBody(req, unsubscribeSchema);

  await withTenant(ctx, (tx) =>
    tx.pushSubscription.deleteMany({ where: { endpoint: input.endpoint, clerkUserId: ctx.userId } })
  );

  return Response.json({ ok: true });
});
