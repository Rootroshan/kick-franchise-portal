import { Webhook } from "svix";
import { getEnv } from "@/lib/env";
import { upsertMembership, removeMembership } from "@/server/modules/identity/membership";
import { withTenant, systemKickContext } from "@/server/db/withTenant";

export const runtime = "nodejs";

type ClerkEvent = {
  type: string;
  data: {
    id?: string;
    user_id?: string;
    organization?: { id: string };
    public_metadata?: { role?: string; locationId?: string };
    email_addresses?: Array<{ email_address: string }>;
    first_name?: string | null;
    last_name?: string | null;
  };
};

/**
 * Mirrors Clerk user/organization membership events into the local
 * Membership table (spec §9). Signature-verified via Svix. Clerk
 * Organizations map to Tenants via Tenant.clerkOrgId, set when the tenant's
 * Clerk org is created/linked from the Kick admin tenant management flow.
 */
export async function POST(req: Request) {
  const env = getEnv();
  if (!env.CLERK_WEBHOOK_SECRET) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  let event: ClerkEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkEvent;
  } catch (err) {
    console.error("Clerk webhook signature verification failed:", err);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "organizationMembership.created":
      case "organizationMembership.updated": {
        const clerkUserId = event.data.public_metadata?.role === "KICK_ADMIN" ? undefined : event.data.user_id;
        const orgId = event.data.organization?.id;
        if (!clerkUserId || !orgId) break;

        const tenant = await withTenant(systemKickContext(), (tx) => tx.tenant.findFirst({ where: { clerkOrgId: orgId } }));
        if (!tenant) break;

        const role = (event.data.public_metadata?.role as "FRANCHISOR_ADMIN" | "FRANCHISEE_USER") ?? "FRANCHISEE_USER";
        await upsertMembership({
          clerkUserId,
          tenantId: tenant.id,
          locationId: event.data.public_metadata?.locationId ?? null,
          role,
          email: event.data.email_addresses?.[0]?.email_address ?? null,
          displayName: [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || null,
        });
        break;
      }
      case "organizationMembership.deleted": {
        const clerkUserId = event.data.user_id;
        const orgId = event.data.organization?.id;
        if (!clerkUserId || !orgId) break;
        const tenant = await withTenant(systemKickContext(), (tx) => tx.tenant.findFirst({ where: { clerkOrgId: orgId } }));
        if (!tenant) break;
        await removeMembership(clerkUserId, tenant.id);
        break;
      }
      case "user.updated": {
        // Kick admins are flagged via publicMetadata.role = 'KICK_ADMIN' and
        // are not tied to one org (spec §9) — mirror as a cross-tenant
        // Membership with tenantId null.
        if (event.data.public_metadata?.role === "KICK_ADMIN" && event.data.id) {
          await upsertMembership({
            clerkUserId: event.data.id,
            tenantId: null,
            locationId: null,
            role: "KICK_ADMIN",
            email: event.data.email_addresses?.[0]?.email_address ?? null,
            displayName: [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || null,
          });
        }
        break;
      }
      default:
        break;
    }
    return Response.json({ received: true });
  } catch (err) {
    console.error(`Error processing Clerk webhook (${event.type}):`, err);
    return Response.json({ error: "Internal processing error" }, { status: 500 });
  }
}
