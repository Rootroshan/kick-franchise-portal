"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  PAID: "hsl(var(--status-success))",
  FULFILLED: "hsl(var(--status-info))",
  PENDING: "hsl(var(--status-warning))",
  PROCESSING: "hsl(var(--status-warning))",
  CANCELLED: "hsl(var(--status-error))",
  FAILED: "hsl(var(--status-error))",
  REFUNDED: "hsl(var(--status-purple))",
  PARTIALLY_REFUNDED: "hsl(var(--status-purple))",
};

export function OrdersDonut({ data }: { data: Array<{ status: string; count: number }> }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">No orders yet.</div>;
  }
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "hsl(var(--muted-foreground))"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, name: string) => [`${v} orders`, name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-bold tabular-nums">{total}</div>
          <div className="text-[10px] text-muted-foreground">total orders</div>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5 text-sm">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[d.status] ?? "hsl(var(--muted-foreground))" }} />
            <span className="capitalize text-foreground">{d.status.toLowerCase().replace(/_/g, " ")}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {d.count} · {Math.round((d.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
