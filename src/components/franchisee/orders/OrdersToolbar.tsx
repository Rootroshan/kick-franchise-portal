"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { InlineLoader } from "@/components/ui/InlineLoader";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total_desc", label: "Highest total" },
  { value: "total_asc", label: "Lowest total" },
];

/**
 * Search / sort / date-range controls. All state lives in the URL query
 * string, so filters survive refresh + back/forward and the server component
 * does the actual (paginated) querying. Search is debounced; because each
 * keystroke replaces the same URL, the previous in-flight server render is
 * superseded — no stale result can land on top of a newer one.
 */
export function OrdersToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [showFilters, setShowFilters] = useState(Boolean(params.get("from") || params.get("to")));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(overrides: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page"); // any filter change restarts pagination
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // Debounced search → URL.
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => apply({ q: q || null }), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by order number or product name…"
            aria-label="Search orders"
            className="pl-9"
          />
          {pending && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <InlineLoader className="text-muted-foreground" />
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className={cn(
            "inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted",
            showFilters && "bg-muted"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filter
        </button>

        <select
          value={params.get("sort") ?? "newest"}
          onChange={(e) => apply({ sort: e.target.value === "newest" ? null : e.target.value })}
          aria-label="Sort orders"
          className="min-h-10 rounded-md border border-border bg-card px-2 text-sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            From
            <input
              type="date"
              defaultValue={params.get("from") ?? ""}
              onChange={(e) => apply({ from: e.target.value || null })}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            To
            <input
              type="date"
              defaultValue={params.get("to") ?? ""}
              onChange={(e) => apply({ to: e.target.value || null })}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          {(params.get("from") || params.get("to")) && (
            <button type="button" onClick={() => apply({ from: null, to: null })} className="text-xs font-medium text-primary hover:underline">
              Clear dates
            </button>
          )}
        </div>
      )}
    </div>
  );
}
