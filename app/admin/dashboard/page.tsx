import { requireRole } from "@/server/modules/identity/guard";
import { getDashboardData } from "@/server/modules/dashboard/service";
import { DashboardView } from "@/components/admin/DashboardView";

// Platform Health was removed from this page by request — service health lives
// on /admin/settings, so the getSystemHealth() call is gone with it.
export default async function AdminDashboardPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const data = await getDashboardData(ctx);
  return <DashboardView data={data} />;
}
