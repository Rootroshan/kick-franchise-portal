"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type FilterTab = { value: string; label: string; count?: number };

/**
 * Horizontally-scrollable status filter tabs (§8/§10/§14). Writes ?status= to
 * the URL and resets to page 1. Scrolls on mobile, wraps on desktop.
 */
export function FilterTabs({ tabs, paramKey = "status" }: { tabs: FilterTab[]; paramKey?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get(paramKey) ?? "";

  const select = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "") next.delete(paramKey);
    else next.set(paramKey, value);
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="mb-3 flex gap-1 overflow-x-auto border-b border-border pb-px" role="tablist" aria-label="Filter by status">
      {tabs.map((t) => {
        const isActive = active === t.value;
        return (
          <button
            key={t.value || "all"}
            role="tab"
            aria-selected={isActive}
            onClick={() => select(t.value)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 text-xs text-muted-foreground">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
