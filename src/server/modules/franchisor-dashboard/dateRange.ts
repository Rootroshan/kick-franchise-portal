import { z } from "zod";

/** A [start, end) half-open range. */
export type DateRange = { start: Date; end: Date };
export type ResolvedRange = { current: DateRange; previous: DateRange; label: string; preset: RangePreset };

export type RangePreset = "this_month" | "last_month" | "this_quarter" | "last_quarter" | "custom";

const MAX_RANGE_DAYS = 366; // guard against absurd reporting windows (§28)

/** Zod schema for ?from=&to=&preset= query params. */
export const dateRangeQuerySchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    preset: z.enum(["this_month", "last_month", "this_quarter", "last_quarter", "custom"]).optional(),
  })
  .refine(
    (v) => {
      if (v.from && v.to) {
        const f = new Date(v.from);
        const t = new Date(v.to);
        if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return false;
        if (f > t) return false;
        if ((t.getTime() - f.getTime()) / 86_400_000 > MAX_RANGE_DAYS) return false;
      }
      return true;
    },
    { message: "Invalid date range: from must be a valid ISO date on or before to, within one year." }
  );

function monthRange(offset: number, now: Date): DateRange {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

function quarterRange(offsetQuarters: number, now: Date): DateRange {
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const startMonth = (currentQuarter + offsetQuarters) * 3;
  const start = new Date(now.getFullYear(), startMonth, 1);
  const end = new Date(now.getFullYear(), startMonth + 3, 1);
  return { start, end };
}

/** Previous equivalent window: same duration immediately before `current`. */
function previousOf(current: DateRange): DateRange {
  const durationMs = current.end.getTime() - current.start.getTime();
  return { start: new Date(current.start.getTime() - durationMs), end: new Date(current.start.getTime()) };
}

/**
 * Resolve URL params → a current range + its previous-period comparison.
 * Falls back to "this month" when nothing valid is supplied. `now` is
 * injectable for tests (tenant timezone handled by passing a tz-adjusted now).
 */
export function resolveDateRange(params: { from?: string; to?: string; preset?: string }, now = new Date()): ResolvedRange {
  const { from, to, preset } = params;

  if (from && to) {
    const start = new Date(from);
    const end = new Date(to);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      // Make end exclusive to end-of-day for inclusive custom ranges.
      const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
      const current = { start, end: endExclusive };
      return { current, previous: previousOf(current), label: "Custom range", preset: "custom" };
    }
  }

  switch (preset) {
    case "last_month": {
      const current = monthRange(-1, now);
      return { current, previous: monthRange(-2, now), label: "Last month", preset: "last_month" };
    }
    case "this_quarter": {
      const current = quarterRange(0, now);
      return { current, previous: quarterRange(-1, now), label: "This quarter", preset: "this_quarter" };
    }
    case "last_quarter": {
      const current = quarterRange(-1, now);
      return { current, previous: quarterRange(-2, now), label: "Last quarter", preset: "last_quarter" };
    }
    case "this_month":
    default: {
      const current = monthRange(0, now);
      return { current, previous: monthRange(-1, now), label: "This month", preset: "this_month" };
    }
  }
}

/** Human date for headers, e.g. "May 1 – May 31, 2025". */
export function formatRangeLabel(range: DateRange): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = range.start.toLocaleDateString("en-US", opts);
  const lastDay = new Date(range.end.getTime() - 86_400_000);
  const end = lastDay.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${start} – ${end}`;
}
