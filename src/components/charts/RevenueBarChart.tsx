"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCents } from "@/lib/utils";

export function RevenueBarChart({ data }: { data: Array<{ label: string; cents: number }> }) {
  const allZero = data.every((d) => d.cents === 0);
  if (allZero) {
    return <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">No revenue in this range yet.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          tickFormatter={(v: number) => (v >= 100000 ? `$${Math.round(v / 100000) / 10}k` : `$${Math.round(v / 100)}`)}
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={48}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))" }}
          formatter={(v: number) => [formatCents(v), "Revenue"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
        />
        <Bar dataKey="cents" fill="hsl(var(--status-info))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
