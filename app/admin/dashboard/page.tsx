import { requireRole } from "@/server/modules/identity/guard";
import { getDashboardData } from "@/server/modules/dashboard/service";
import { getSystemHealth } from "@/server/modules/dashboard/health";
import { DashboardView } from "@/components/admin/DashboardView";

export default async function AdminDashboardPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const [data, health] = await Promise.all([getDashboardData(ctx), getSystemHealth()]);
  return <DashboardView data={data} health={health} />;
}
