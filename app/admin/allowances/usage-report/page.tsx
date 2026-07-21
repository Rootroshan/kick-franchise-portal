import { requireRole } from "@/server/modules/identity/guard";
import { getAllowanceUsageReport } from "@/server/modules/allowances/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/utils";

export default async function AllowanceUsageReportPage() {
  const ctx = await requireRole("KICK_ADMIN")();
  const report = await getAllowanceUsageReport(ctx);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Allowance Usage Report</h1>
        <p className="text-sm text-muted-foreground">Granted / debited / refunded / adjusted balances by location and period.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
        </CardHeader>
        <CardContent className="scrollbar-hide overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4">Tenant</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4 text-right">Granted</th>
                <th className="py-2 pr-4 text-right">Debited</th>
                <th className="py-2 pr-4 text-right">Refunded</th>
                <th className="py-2 pr-4 text-right">Adjusted</th>
                <th className="py-2 pr-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {report.map((row, i) => (
                <tr key={`${row.locationId}-${row.periodLabel}-${i}`} className="border-b border-border/50">
                  <td className="py-2 pr-4">{row.tenantName}</td>
                  <td className="py-2 pr-4">{row.locationName}</td>
                  <td className="py-2 pr-4">{row.periodLabel}</td>
                  <td className="py-2 pr-4 text-right">{formatCents(row.grantedCents, row.currency)}</td>
                  <td className="py-2 pr-4 text-right">{formatCents(row.debitedCents, row.currency)}</td>
                  <td className="py-2 pr-4 text-right">{formatCents(row.refundedCents, row.currency)}</td>
                  <td className="py-2 pr-4 text-right">{formatCents(row.adjustedCents, row.currency)}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{formatCents(row.balanceCents, row.currency)}</td>
                </tr>
              ))}
              {report.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-muted-foreground">
                    No allowance activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
