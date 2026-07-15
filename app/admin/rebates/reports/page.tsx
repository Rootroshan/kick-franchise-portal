import { requireRole } from "@/server/modules/identity/guard";
import { withTenant } from "@/server/db/withTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RebateReportsPanel } from "@/components/admin/RebateReportsPanel";

export default async function RebateReportsPage() {
  const ctx = await requireRole("KICK_ADMIN")();

  const reports = await withTenant(ctx, (tx) =>
    tx.rebateReport.findMany({
      orderBy: { generatedAt: "desc" },
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Rebate Reports</h1>
        <p className="text-sm text-muted-foreground">Generated periodic rebate reports, exportable as CSV or PDF.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <RebateReportsPanel
            reports={reports.map((r) => ({
              id: r.id,
              period: r.period,
              periodLabel: r.periodLabel,
              generatedAt: r.generatedAt.toISOString(),
              hasCsv: Boolean(r.csvStorageKey),
              hasPdf: Boolean(r.pdfStorageKey),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
