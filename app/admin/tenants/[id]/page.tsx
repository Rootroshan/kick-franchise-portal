import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";

// Legacy tenant route → the stable brand-ID route.
export default async function TenantDetailRedirect({ params }: { params: { id: string } }) {
  const ctx = await requireRole("KICK_ADMIN")();
  const tenant = await withTenant(ctx, (tx) => tx.tenant.findUnique({ where: { id: params.id }, select: { id: true } }));
  if (!tenant) notFound();
  redirect(`/admin/brands/${tenant.id}`);
}
