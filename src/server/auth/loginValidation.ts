import { z } from "zod";
import type { Role } from "@prisma/client";
import { withTenant, systemKickContext } from "@/server/db/withTenant";
import { resolveTenantFromHost } from "@/server/modules/identity/tenantResolution";

/**
 * Post-authentication authorisation for the brand portals.
 *
 * Runs AFTER credentials are verified. Authentication proves who you are;
 * this decides whether that identity may enter THIS tenant portal in THIS
 * role.
 *
 * Two rules make it safe:
 *
 *  1. The tenant comes from the resolved Host header, never from the request
 *     body. A caller cannot aim at a brand they do not control.
 *  2. The selected role is only ever COMPARED against Membership.role. A
 *     mismatch is a rejection, never an elevation — otherwise the role selector
 *     would be a privilege-escalation vector rather than a convenience.
 */

/** Roles selectable on a brand portal. KICK_ADMIN is deliberately absent. */
export const portalRoleSchema = z.enum(["FRANCHISOR_ADMIN", "FRANCHISEE_USER"]);
export type PortalRole = z.infer<typeof portalRoleSchema>;

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  role: portalRoleSchema,
});

export type LoginOutcome =
  | { ok: true; role: Role; tenantId: string; locationId: string | null; redirectTo: string }
  | { ok: false; code: LoginErrorCode; message: string };

export type LoginErrorCode =
  | "UNKNOWN_DOMAIN"
  | "INVALID_CREDENTIALS"
  | "WRONG_PORTAL"
  | "NO_STORE"
  | "INACTIVE_STORE";

/**
 * Messages are deliberately coarse where they touch account existence.
 *
 * "No membership for this tenant" and "wrong password" both surface as the
 * same credentials error: distinguishing them would confirm that an address
 * exists on ANOTHER brand, which leaks the customer list across tenants.
 *
 * WRONG_PORTAL is the one exception: the caller has ALREADY proven they hold
 * valid credentials for an account with a membership on this exact tenant —
 * there is nothing left to leak by naming which portal they should use
 * instead, and a clear "wrong door" message is more useful than a generic one.
 */
const MESSAGES: Record<LoginErrorCode, string> = {
  UNKNOWN_DOMAIN: "This portal address is not recognised. Check the web address and try again.",
  INVALID_CREDENTIALS: "Incorrect email or password for this portal.",
  WRONG_PORTAL: "Incorrect email or password for this portal.",
  NO_STORE: "Your account is not assigned to a store yet. Contact your brand administrator.",
  INACTIVE_STORE: "Your assigned store is not active. Contact your brand administrator.",
};

/** Role-specific "wrong door" message for a CONFIRMED membership on this tenant, wrong role for this route. */
function wrongPortalMessage(selectedRole: PortalRole): string {
  return selectedRole === "FRANCHISOR_ADMIN"
    ? "This account does not have Franchise Admin access."
    : "This account does not have Store User access.";
}

function deny(code: LoginErrorCode, message?: string): LoginOutcome {
  return { ok: false, code, message: message ?? MESSAGES[code] };
}

/**
 * Validates that an authenticated user may enter this portal as the selected
 * role, and returns where to send them.
 *
 * @param userId  Authenticated user id — from the session, never the client.
 * @param host    Request Host header.
 * @param selectedRole  The portal the user chose. Used only as a filter.
 */
export async function validatePortalLogin(
  userId: string,
  host: string,
  selectedRole: PortalRole
): Promise<LoginOutcome> {
  // Rejects unknown hosts, unverified custom domains and inactive tenants.
  const tenant = await resolveTenantFromHost(host);
  if (!tenant) return deny("UNKNOWN_DOMAIN");

  // Membership is the authority on role and scope. Read with system authority
  // because no request context exists yet — this call is how we build it.
  const memberships = await withTenant(systemKickContext(), (tx) =>
    tx.membership.findMany({
      where: { clerkUserId: userId },
      include: { location: { select: { id: true, status: true } } },
    })
  );

  const membership = memberships.find((m) => m.tenantId === tenant.id);
  // No membership for THIS tenant: report as credentials, not as "wrong
  // brand" — the latter confirms the account exists elsewhere.
  if (!membership) return deny("INVALID_CREDENTIALS");

  // The selected portal must match the granted role. Never the other way round.
  if (membership.role !== selectedRole) return deny("WRONG_PORTAL", wrongPortalMessage(selectedRole));

  if (membership.role === "FRANCHISEE_USER") {
    if (!membership.locationId || !membership.location) return deny("NO_STORE");
    if (membership.location.status !== "active") return deny("INACTIVE_STORE");
  }

  return {
    ok: true,
    role: membership.role,
    tenantId: tenant.id,
    locationId: membership.locationId,
    // Destination derived from the verified role, never from a client-supplied
    // redirect parameter.
    redirectTo: membership.role === "FRANCHISOR_ADMIN" ? "/franchisor" : "/",
  };
}

/**
 * Gate for the KICK Super Admin login, which is a separate surface from the
 * brand portals. Requires a platform-wide KICK_ADMIN membership — the same
 * shape requestContext.ts recognises (role KICK_ADMIN with tenantId null).
 */
export async function validateAdminLogin(userId: string): Promise<LoginOutcome> {
  const memberships = await withTenant(systemKickContext(), (tx) =>
    tx.membership.findMany({ where: { clerkUserId: userId } })
  );

  const isPlatformAdmin = memberships.some((m) => m.role === "KICK_ADMIN" && m.tenantId === null);
  if (!isPlatformAdmin) {
    return {
      ok: false,
      code: "WRONG_PORTAL",
      message: "This account does not have Super Admin access.",
    };
  }

  return { ok: true, role: "KICK_ADMIN", tenantId: null as unknown as string, locationId: null, redirectTo: "/admin" };
}
