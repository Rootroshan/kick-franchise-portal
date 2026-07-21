import { withTenant, systemKickContext } from "@/server/db/withTenant";
import { createPresignedDownloadUrl } from "@/server/lib/storage";

export async function GET(_req: Request, { params }: { params: { tenantId: string } }) {
  const tenant = await withTenant(systemKickContext(), (tx) => tx.tenant.findUnique({ where: { id: params.tenantId }, select: { theme: true } })).catch(() => null);
  const logoKey = (tenant?.theme as { logoKey?: unknown } | null)?.logoKey;
  if (typeof logoKey !== "string" || !logoKey.startsWith("brand-logo-temp/")) return new Response("Not found", { status: 404 });
  const url = await createPresignedDownloadUrl(logoKey, 300);
  return Response.redirect(url, 302);
}
