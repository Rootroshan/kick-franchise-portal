"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TASK_TABS, TASK_SORTS, type TaskTab, type TaskSort } from "@/lib/taskState";

// Re-exported for existing consumers — the values now live in lib/taskState
// (a plain module) so a server component can read them without tripping the
// "call some() from the server but some is on the client" production error.
export { TASK_TABS, TASK_SORTS };
export type { TaskTab, TaskSort };

/**
 * URL-param driven tabs + debounced search + sort for the Store User tasks
 * page. Filtering happens on the server per navigation, so tabs update the
 * list without a full browser reload and active filters survive in the URL.
 */
export function TasksToolbar({ tab, sort, q }: { tab: TaskTab; sort: TaskSort; q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Debounced search → URL. router.replace supersedes any in-flight RSC
  // request for the previous keystroke, so stale results never win.
  useEffect(() => {
    if (search === q) return;
    debounce.current = setTimeout(() => setParams({ q: search.trim() || null }), 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-1 overflow-x-auto scrollbar-hide rounded-xl border border-border bg-card px-2"
        role="tablist"
        aria-label="Filter tasks"
      >
        {TASK_TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={t.value === tab}
            onClick={() => setParams({ tab: t.value || null })}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              t.value === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title or description…"
            aria-label="Search tasks by title or description"
            className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>
        <Select
          aria-label="Sort tasks"
          value={sort}
          onChange={(e) => setParams({ sort: e.target.value || null })}
          className="h-10 w-auto shrink-0"
        >
          {TASK_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
