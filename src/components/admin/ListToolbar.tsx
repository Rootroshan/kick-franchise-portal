"use client";

import { useCallback, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export type FilterDef = { key: string; label: string; options: Array<{ value: string; label: string }> };

/**
 * URL-driven list toolbar: search box + filter dropdowns. Every change writes
 * to the query string (?search=&status=&brand=…) and resets to page 1, so the
 * server component re-fetches. No client-side data fetching.
 */
export function ListToolbar({ filters = [], searchPlaceholder = "Search…" }: { filters?: FilterDef[]; searchPlaceholder?: string }) {
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

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
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
    </div>
  );
}
