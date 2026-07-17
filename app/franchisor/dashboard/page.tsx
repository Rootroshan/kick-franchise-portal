import { requireRole } from "@/server/modules/identity/guard";
import { getFranchisorDashboard } from "@/server/modules/franchisor-dashboard/service";
import { withTenant } from "@/server/db/withTenant";
import { FranchisorDashboardView } from "@/components/franchisor/dashboard/FranchisorDashboardView";
import { ErrorState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function FranchisorDashboardPage({
  searchParams,
}: {
  searchParams: { preset?: string; from?: string; to?: string };
}) {
  const ctx = await requireRole("FRANCHISOR_ADMIN")();

  let data;
  try {
    data = await getFranchisorDashboard(ctx, searchParams);
  } catch {
    return <ErrorState message="We couldn't load your dashboard. Please try again." />;
  }

  const membership = await withTenant(ctx, (tx) =>
    tx.membership.findFirst({ where: { tenantId: ctx.tenantId ?? undefined, clerkUserId: ctx.userId }, select: { displayName: true, email: true } })
  );
  const rawName = membership?.displayName || membership?.email || "there";
  const firstName = rawName.split(" ")[0]?.split("@")[0] || "there";

  return <FranchisorDashboardView data={data} firstName={firstName} />;
}
