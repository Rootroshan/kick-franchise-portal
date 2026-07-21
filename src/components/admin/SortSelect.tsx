"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type SortOption = { value: string; label: string; sort: string; direction: "asc" | "desc" };

/**
 * URL-driven sort dropdown (?sort=&direction=) for card-based lists that have
 * no column headers to click for sorting — same push/searchParams pattern as
 * ListToolbar/FilterTabs, just writing two params at once instead of one.
 */
export function SortSelect({ options }: { options: SortOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const currentSort = params.get("sort") ?? "";
  const currentDirection = params.get("direction") ?? "desc";
  const activeValue =
    options.find((o) => o.sort === currentSort && o.direction === currentDirection)?.value ?? options[0]?.value ?? "";

  const onChange = (value: string) => {
    const opt = options.find((o) => o.value === value);
    if (!opt) return;
    const next = new URLSearchParams(params.toString());
    next.set("sort", opt.sort);
    next.set("direction", opt.direction);
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <select
      value={activeValue}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Sort order"
      className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
