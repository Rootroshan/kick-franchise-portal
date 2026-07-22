"use client";

import { useCallback, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterDef = { key: string; label: string; options: Array<{ value: string; label: string }> };

/**
 * URL-driven list toolbar: search box + filter dropdowns + optional date
 * range. Every change writes to the query string (?search=&status=&brand=…)
 * and resets to page 1, so the server component re-fetches. No client-side
 * data fetching.
 */
export function ListToolbar({
  filters = [],
  searchPlaceholder = "Search…",
  className,
  dateRange = false,
}: {
  filters?: FilterDef[];
  searchPlaceholder?: string;
  className?: string;
  /** Adds "From"/"To" date inputs writing to ?from=&to= (ISO date strings). */
  dateRange?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get("search") ?? "");

  const push = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === "") next.delete(k);
        else next.set(k, v);
      }
      next.set("page", "1"); // any filter change resets pagination
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  // Debounced search
  useEffect(() => {
    const current = params.get("search") ?? "";
    if (search === current) return;
    const t = setTimeout(() => push({ search }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Only offer Clear when something is actually filtered — an always-visible
  // control that usually does nothing is noise.
  const activeFilters =
    filters.some((f) => (params.get(f.key) ?? "") !== "") ||
    (params.get("search") ?? "") !== "" ||
    (dateRange && ((params.get("from") ?? "") !== "" || (params.get("to") ?? "") !== ""));

  const clearAll = () => {
    setSearch("");
    const next = new URLSearchParams(params.toString());
    for (const f of filters) next.delete(f.key);
    next.delete("search");
    if (dateRange) {
      next.delete("from");
      next.delete("to");
    }
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className={cn("mb-3 flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-[180px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {filters.map((f) => (
        <select
          key={f.key}
          value={params.get(f.key) ?? ""}
          onChange={(e) => push({ [f.key]: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          aria-label={f.label}
        >
          <option value="">{f.label}: All</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {dateRange && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={params.get("from") ?? ""}
            onChange={(e) => push({ from: e.target.value })}
            aria-label="From date"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={params.get("to") ?? ""}
            onChange={(e) => push({ to: e.target.value })}
            aria-label="To date"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {activeFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Clear Filters
        </button>
      )}
    </div>
  );
}
