import { redirect } from "next/navigation";
import { getRequestContext } from "@/server/modules/identity/requestContext";
import { HttpError } from "@/server/modules/identity/errors";
import { withTenant } from "@/server/db/withTenant";
import { getFranchisorBadgeCount } from "@/server/modules/franchisor-dashboard/badge";
import { FranchisorShell } from "@/components/franchisor/layout/FranchisorShell";
import { PushOptInBanner } from "@/components/franchisor/PushOptInBanner";

/**
 * Franchisor portal gate + shell. FRANCHISOR_ADMIN only; other roles are
 * redirected to their own home (KICK_ADMIN → /admin, else → /). Unauthenticated
 * requests throw HttpError(401) from getRequestContext → redirected to the
 * Franchise Admin login for this tenant, never the KICK_ADMIN /sign-in.
 */
export default async function FranchisorLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch (err) {
    if (err instanceof HttpError) {
      redirect(err.status === 401 ? "/admin-login" : "/");
    }
    throw err;
  }

  if (ctx.role === "KICK_ADMIN") redirect("/admin");
  if (ctx.role !== "FRANCHISOR_ADMIN") redirect("/");
  if (!ctx.tenantId) redirect("/");

  const tenantId = ctx.tenantId;

  const [brand, badge] = await Promise.all([
    withTenant(ctx, (tx) => tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })),
    getFranchisorBadgeCount(ctx, tenantId).catch(() => 0),
  ]);

  // displayName isn't on the context; resolve from membership for the header greeting.
  const membership = await withTenant(ctx, (tx) =>
    tx.membership.findFirst({ where: { tenantId, clerkUserId: ctx.userId }, select: { displayName: true, email: true } })
  );
  const userName = membership?.displayName || membership?.email?.split("@")[0] || "Franchisor Admin";

  return (
    <FranchisorShell brandName={brand?.name ?? "Franchisor Portal"} userName={userName} notificationCount={badge}>
      <PushOptInBanner />
      {children}
    </FranchisorShell>
  );
}
