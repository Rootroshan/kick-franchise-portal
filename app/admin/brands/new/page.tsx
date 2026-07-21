import { requireRole } from "@/server/modules/identity/guard";
import { CreateTenantForm } from "@/components/admin/CreateTenantForm";
import { cnameTarget } from "@/server/modules/tenants/hostingProvider";

export const dynamic = "force-dynamic";

export default async function NewBrandPage() {
  await requireRole("KICK_ADMIN")();
  return <CreateTenantForm cnameTarget={cnameTarget()} />;
}
