import { describe, it, expect } from "vitest";
import { safePercent, trend, countTrend, overallEngagement, isOverdue, storeScore } from "@/server/modules/franchisor-dashboard/calculations";
import { resolveDateRange } from "@/server/modules/franchisor-dashboard/dateRange";

describe("safePercent", () => {
  it("returns 0 when denominator is 0 (no NaN/Infinity)", () => {
    expect(safePercent(5, 0)).toBe(0);
    expect(safePercent(0, 0)).toBe(0);
  });
  it("rounds to nearest integer", () => {
    expect(safePercent(1, 3)).toBe(33);
    expect(safePercent(2, 3)).toBe(67);
  });
  it("clamps to 0..100", () => {
    expect(safePercent(150, 100)).toBe(100);
    expect(safePercent(-5, 100)).toBe(0);
  });
});

describe("trend / countTrend", () => {
  it("detects up/down/neutral for percentages", () => {
    expect(trend(82, 70).direction).toBe("up");
    expect(trend(60, 68).direction).toBe("down");
    expect(trend(50, 50).direction).toBe("neutral");
  });
  it("reports absolute-count deltas", () => {
    expect(countTrend(48, 44)).toEqual({ direction: "up", deltaPoints: 4 });
    expect(countTrend(40, 44)).toEqual({ direction: "down", deltaPoints: -4 });
  });
});

describe("overallEngagement", () => {
  it("averages only available components", () => {
    expect(
      overallEngagement([
        { percent: 80, available: true },
        { percent: 60, available: true },
        { percent: 0, available: false }, // excluded
      ])
    ).toBe(70);
  });
  it("returns 0 when nothing available", () => {
    expect(overallEngagement([{ percent: 0, available: false }])).toBe(0);
  });
});

describe("isOverdue", () => {
  const now = new Date("2025-05-15T12:00:00Z");
  it("is overdue when open and past due", () => {
    expect(isOverdue("OPEN", new Date("2025-05-10T00:00:00Z"), now)).toBe(true);
  });
  it("is not overdue when completed", () => {
    expect(isOverdue("COMPLETED", new Date("2025-05-10T00:00:00Z"), now)).toBe(false);
  });
  it("is not overdue with no due date or future due", () => {
    expect(isOverdue("OPEN", null, now)).toBe(false);
    expect(isOverdue("OPEN", new Date("2025-05-20T00:00:00Z"), now)).toBe(false);
  });
});

describe("storeScore", () => {
  it("is the mean of available components", () => {
    expect(
      storeScore([
        { percent: 100, available: true },
        { percent: 50, available: true },
        { percent: 0, available: false },
      ])
    ).toBe(75);
  });
});

describe("resolveDateRange", () => {
  const now = new Date("2025-05-15T12:00:00Z");
  it("defaults to this month with previous = last month", () => {
    const r = resolveDateRange({}, now);
    expect(r.preset).toBe("this_month");
    expect(r.current.start.getMonth()).toBe(4); // May (0-indexed)
    expect(r.previous.start.getMonth()).toBe(3); // April
  });
  it("last_month resolves to April, previous March", () => {
    const r = resolveDateRange({ preset: "last_month" }, now);
    expect(r.current.start.getMonth()).toBe(3);
    expect(r.previous.start.getMonth()).toBe(2);
  });
  it("this_quarter covers Apr–Jun", () => {
    const r = resolveDateRange({ preset: "this_quarter" }, now);
    expect(r.current.start.getMonth()).toBe(3); // April
    expect(r.current.end.getMonth()).toBe(6); // July (exclusive)
  });
  it("custom range is honoured and previous is the equivalent prior window", () => {
    const r = resolveDateRange({ from: "2025-05-01", to: "2025-05-31" }, now);
    expect(r.preset).toBe("custom");
    expect(r.current.start.toISOString().slice(0, 10)).toBe("2025-05-01");
    // previous window is same duration immediately before
    expect(r.previous.end.getTime()).toBe(r.current.start.getTime());
  });
  it("falls back to this_month when custom range is inverted", () => {
    const r = resolveDateRange({ from: "2025-05-31", to: "2025-05-01" }, now);
    expect(r.preset).toBe("this_month");
  });
});
