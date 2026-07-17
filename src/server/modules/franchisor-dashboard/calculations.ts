/**
 * Pure engagement math for the Franchisor dashboard. No I/O, no commerce —
 * every function here is unit-tested (see tests/unit/franchisor-calculations.test.ts).
 * All percentages are integers 0..100; division is always guarded.
 */

/** Percent 0..100, rounded. Returns 0 when denominator is 0 (never NaN/Infinity). */
export function safePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  const pct = (numerator / denominator) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

/** Trend = current - previous, in percentage points. */
export type Trend = { direction: "up" | "down" | "neutral"; deltaPoints: number };

export function trend(current: number, previous: number): Trend {
  const deltaPoints = Math.round((current - previous) * 10) / 10;
  if (deltaPoints > 0) return { direction: "up", deltaPoints };
  if (deltaPoints < 0) return { direction: "down", deltaPoints };
  return { direction: "neutral", deltaPoints: 0 };
}

/** Absolute-count trend (e.g. active stores 48 vs 44). */
export function countTrend(current: number, previous: number): Trend {
  const deltaPoints = current - previous;
  if (deltaPoints > 0) return { direction: "up", deltaPoints };
  if (deltaPoints < 0) return { direction: "down", deltaPoints };
  return { direction: "neutral", deltaPoints: 0 };
}

/**
 * Overall engagement = mean of the AVAILABLE component percentages.
 * A component is "available" when its denominator was > 0 (we pass the
 * already-computed percents plus a flag). Documented in README §Engagement.
 */
export function overallEngagement(components: Array<{ percent: number; available: boolean }>): number {
  const present = components.filter((c) => c.available);
  if (present.length === 0) return 0;
  const sum = present.reduce((s, c) => s + c.percent, 0);
  return Math.round(sum / present.length);
}

/** True when a task assignment is overdue: still open and past its due time. */
export function isOverdue(status: string, dueAt: Date | null, now: Date): boolean {
  return status !== "COMPLETED" && dueAt !== null && dueAt.getTime() < now.getTime();
}

/** Store engagement score = mean of that store's available component percents. */
export function storeScore(components: Array<{ percent: number; available: boolean }>): number {
  return overallEngagement(components);
}
