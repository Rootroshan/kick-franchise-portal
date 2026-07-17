import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { Trend } from "@/server/modules/franchisor-dashboard/calculations";

/** Coloured up/down/neutral trend vs previous period. */
export function TrendIndicator({ trend, suffix = "%", label = "vs last period" }: { trend: Trend; suffix?: string; label?: string }) {
  const { direction, deltaPoints } = trend;
  const cls = direction === "up" ? "text-status-success" : direction === "down" ? "text-status-error" : "text-muted-foreground";
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const value = Math.abs(deltaPoints);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="tabular-nums">{value}{suffix}</span>
      <span className="font-normal text-muted-foreground">{label}</span>
    </span>
  );
}
