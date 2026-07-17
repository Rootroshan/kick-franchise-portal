import { requireTenantRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { PageHeader } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

export default async function FranchisorSettingsPage() {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const brand = await withTenant(ctx, (tx) =>
    tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true, slug: true, createdAt: true, _count: { select: { locations: true, memberships: true } } } })
  );

  return (
    <div>
      <PageHeader title="Settings" description="Your brand profile. Commerce, pricing and billing settings are managed by Kick Media." />
      <div className="max-w-xl rounded-xl border border-border bg-card p-5 text-sm">
        <Row label="Brand name" value={brand?.name ?? "—"} />
        <Row label="Portal slug" value={brand?.slug ?? "—"} />
        <Row label="Stores" value={String(brand?._count.locations ?? 0)} />
        <Row label="Members" value={String(brand?._count.memberships ?? 0)} />
        <Row label="Created" value={brand ? brand.createdAt.toLocaleDateString() : "—"} />
      </div>
      <p className="mt-4 max-w-xl text-xs text-muted-foreground">
        Product catalogue, pricing, orders, payments, allowances and rebates are controlled exclusively by Kick Media and are not
        editable from this portal.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
