"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { TrendPoint } from "@/server/modules/franchisor-dashboard/trends";

/** Multi-series engagement trend line chart. Decorative + interactive; the
 *  parent provides a screen-reader summary. */
export function EngagementTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-72 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
          <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="announcements" name="Announcements" stroke="hsl(var(--status-info))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="tasks" name="Tasks" stroke="hsl(var(--status-success))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="onboarding" name="Onboarding" stroke="hsl(var(--status-warning))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="artwork" name="Artwork" stroke="hsl(var(--status-purple))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
