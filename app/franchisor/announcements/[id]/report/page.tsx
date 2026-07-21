import Link from "next/link";
import { requireTenantRole } from "@/server/modules/identity/guard";
import { getAcknowledgementReport } from "@/server/modules/announcements/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AnnouncementReportPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenantRole("FRANCHISOR_ADMIN")();
  const report = await getAcknowledgementReport(ctx, params.id, ctx.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Acknowledgement Report</h1>
          <p className="text-sm text-muted-foreground">
            {report.acknowledgedCount} of {report.totalLocations} locations acknowledged.
          </p>
        </div>
        <Link href="/franchisor/announcements">
          <Button variant="outline" size="sm">
            Back to announcements
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Per-location breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {report.locations.map((l) => (
              <li key={l.locationId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{l.locationName}</span>
                <Badge variant={l.acknowledged ? "success" : "muted"}>{l.acknowledged ? "Acknowledged" : "Pending"}</Badge>
              </li>
            ))}
            {report.locations.length === 0 && <p className="text-sm text-muted-foreground">No locations yet.</p>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
