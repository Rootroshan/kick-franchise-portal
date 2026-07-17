"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

/**
 * Radial engagement donut. Renders the overall score in the centre and each
 * available component as a coloured segment. Screen-reader summary is provided
 * by the parent card (this is decorative + interactive tooltips).
 */
export function EngagementDonut({
  overall,
  components,
}: {
  overall: number;
  components: Array<{ label: string; percent: number; available: boolean }>;
}) {
  const data = components
    .filter((c) => c.available)
    .map((c) => ({ name: c.label, value: c.percent }));

  const COLORS = ["hsl(var(--status-info))", "hsl(var(--status-success))", "hsl(var(--status-warning))", "hsl(var(--status-purple))"];

  // If nothing is available, show a neutral ring so the chart never breaks.
  const chartData = data.length > 0 ? data : [{ name: "No data", value: 1 }];

  return (
    <div className="relative h-48 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="value" innerRadius={62} outerRadius={84} paddingAngle={data.length > 1 ? 2 : 0} startAngle={90} endAngle={-270}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={data.length > 0 ? COLORS[i % COLORS.length] : "hsl(var(--muted))"} />
            ))}
          </Pie>
          {data.length > 0 && <Tooltip formatter={(v: number) => `${v}%`} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Overall</span>
        <span className="text-2xl font-bold tabular-nums">{overall}%</span>
      </div>
    </div>
  );
}
