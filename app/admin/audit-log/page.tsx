import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";

export default async function AuditLogPage() {
  const ctx = await requireRole("KICK_ADMIN")();

  const logs = await withTenant(ctx, (tx) => tx.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Immutable record of privileged actions.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditLogPanel
            initialLogs={logs.map((l) => ({
              id: l.id,
              action: l.action,
              entity: l.entity,
              entityId: l.entityId,
              role: l.role,
              actorId: l.actorId,
              createdAt: l.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
