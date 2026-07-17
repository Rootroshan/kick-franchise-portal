import { Wallet, TrendingDown, PiggyBank } from "lucide-react";
import { requireRole } from "@/server/modules/identity/guard";
import { getStoreAllowances } from "@/server/modules/allowances/store";
import { formatCents } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  GRANT: "Grant",
  ORDER_DEBIT: "Order",
  REFUND_CREDIT: "Refund",
  ADJUSTMENT: "Adjustment",
  EXPIRY: "Expiry",
};

export default async function AllowancePage() {
  const ctx = await requireRole("FRANCHISEE_USER")();
  const allowances = await getStoreAllowances(ctx);

  if (allowances.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">My Allowance</h1>
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No active allowance period for your store yet.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-lg font-semibold">My Allowance</h1>

      {allowances.map((a) => (
        <div key={a.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{a.periodLabel}</span>
            <span className="text-xs text-muted-foreground">{a.usagePercent}% used</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat icon={PiggyBank} label="Granted" value={formatCents(a.grantedCents, a.currency)} />
            <Stat icon={TrendingDown} label="Used" value={formatCents(a.usedCents, a.currency)} />
            <Stat icon={Wallet} label="Balance" value={formatCents(a.balanceCents, a.currency)} highlight />
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${a.usagePercent}%` }} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Transaction history</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              {a.ledger.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transactions yet.</p>
              ) : (
                a.ledger.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0">
                    <div>
                      <Badge variant="secondary">{REASON_LABEL[l.reason] ?? l.reason}</Badge>
                      <span className="ml-2 text-xs text-muted-foreground">{l.createdAt.toLocaleDateString()}</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium tabular-nums ${l.deltaCents < 0 ? "text-status-error" : "text-status-success"}`}>
                        {l.deltaCents < 0 ? "" : "+"}{formatCents(l.deltaCents, a.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">{formatCents(l.balanceAfter, a.currency)}</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <Icon className="mb-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}
