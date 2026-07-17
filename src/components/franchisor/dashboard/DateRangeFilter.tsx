"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar } from "lucide-react";

const PRESETS = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "last_quarter", label: "Last quarter" },
];

/** URL-driven date-range preset selector (§28). Writes ?preset= and clears custom from/to. */
export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("preset") ?? "this_month";

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
      <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Date range</span>
      <select
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("preset", e.target.value);
          next.delete("from");
          next.delete("to");
          router.push(`${pathname}?${next.toString()}`);
        }}
        className="bg-transparent font-medium outline-none"
        aria-label="Select date range"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
    </label>
  );
}
