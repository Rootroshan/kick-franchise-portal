import { z } from "zod";
import { requireAnyRole } from "@/server/modules/identity/guard";
import { withErrorHandling, parseJsonBody } from "@/server/lib/apiHandler";
import { withTenant } from "@/server/db/withTenant";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** [K,F,U]: register a push subscription for the authenticated user. */
export const POST = withErrorHandling(async (req) => {
  const ctx = await requireAnyRole();
  const input = await parseJsonBody(req, subscribeSchema);

  const subscription = await withTenant(ctx, (tx) =>
    tx.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        clerkUserId: ctx.userId,
        tenantId: ctx.tenantId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        status: "PENDING",
      },
      update: {
        clerkUserId: ctx.userId,
        tenantId: ctx.tenantId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        status: "PENDING",
        lastError: null,
      },
    })
  );

  return Response.json({ subscription }, { status: 201 });
});
