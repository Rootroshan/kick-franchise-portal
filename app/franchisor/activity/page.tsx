import { Activity as ActivityIcon } from "lucide-react";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { PageHeader, EmptyState } from "@/components/admin/kit";

export const dynamic = "force-dynamic";

const COMMERCE_ACTIONS = ["order.refund", "order.paid", "order.failed", "allowance.grant", "allowance.adjust", "rebate.accrue"];

export default async function FranchisorActivityPage() {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  // Tenant-scoped, commerce actions excluded (§22). RLS also scopes tenant.
  const items = await withTenant(ctx, (tx) =>
    tx.auditLog.findMany({ where: { tenantId: ctx.tenantId, action: { notIn: COMMERCE_ACTIONS } }, orderBy: { createdAt: "desc" }, take: 50 })
  );

  return (
    <div>
      <PageHeader title="Activity" description="Recent operational activity across your brand." />
      {items.length === 0 ? (
        <EmptyState title="No activity yet" description="Actions across your brand will appear here." icon={ActivityIcon} />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <ActivityIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-medium">{a.action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                  <span className="text-muted-foreground"> · {a.entity}</span>
                </div>
                <div className="text-xs text-muted-foreground">{a.actorId} · {a.createdAt.toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
