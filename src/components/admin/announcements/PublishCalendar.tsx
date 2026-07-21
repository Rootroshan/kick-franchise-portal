"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PublishCalendarDay } from "@/server/modules/announcements/admin";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Month grid + nav + date-click filter. Client: needs click handlers for nav/day-select. */
export function PublishCalendar({ year, month, days }: { year: number; month: number; days: PublishCalendarDay[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const byDay = new Map(days.map((d) => [d.date, d]));
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = firstOfMonth.getUTCDay(); // 0=Sun

  const activeDate = params.get("date") ?? "";

  const navigate = (deltaMonths: number) => {
    const next = new URLSearchParams(params.toString());
    let y = year;
    let m = month + deltaMonths;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    next.set("cy", String(y));
    next.set("cm", String(m));
    router.push(`${pathname}?${next.toString()}`);
  };

  const selectDay = (dateKey: string) => {
    const next = new URLSearchParams(params.toString());
    if (activeDate === dateKey) next.delete("date");
    else next.set("date", dateKey);
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  };

  const cells: Array<{ day: number; dateKey: string } | null> = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateKey });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Publish Calendar</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Previous month"
            className="rounded p-1 hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[110px] text-center text-xs font-medium text-muted-foreground">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            type="button"
            onClick={() => navigate(1)}
            aria-label="Next month"
            className="rounded p-1 hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <span key={`blank-${i}`} />;
          const bucket = byDay.get(cell.dateKey);
          const isActive = activeDate === cell.dateKey;
          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => selectDay(cell.dateKey)}
              className={`relative flex h-8 flex-col items-center justify-center rounded text-xs transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
              aria-pressed={isActive}
              aria-label={`${cell.dateKey}${bucket ? `, ${bucket.publishedCount} published, ${bucket.scheduledCount} scheduled` : ""}`}
            >
              <span>{cell.day}</span>
              {bucket && (
                <span className="absolute bottom-0.5 flex gap-0.5">
                  {bucket.publishedCount > 0 && <span className="h-1 w-1 rounded-full bg-status-success" />}
                  {bucket.scheduledCount > 0 && <span className="h-1 w-1 rounded-full bg-status-warning" />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-status-success" /> Published
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-status-warning" /> Scheduled
        </span>
      </div>
    </div>
  );
}
