"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const FEED_TABS = ["All", "Unread", "Pinned", "Acknowledged"] as const;
export type FeedTab = (typeof FEED_TABS)[number];

/** URL-param driven tabs + search + sort for the announcements feed. */
export function AnnouncementsToolbar({ tab, sort, q }: { tab: FeedTab; sort: "newest" | "oldest"; q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2">
      <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Filter announcements">
        {FEED_TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tab}
            onClick={() => setParams({ tab: t === "All" ? null : t })}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              t === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            setParams({ q: typeof value === "string" && value.trim() ? value.trim() : null });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search announcements"
            aria-label="Search announcements"
            className="h-9 w-40 rounded-md border border-input bg-background pl-8 pr-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 sm:w-52"
          />
        </form>
        <Select
          aria-label="Sort announcements"
          value={sort}
          onChange={(e) => setParams({ sort: e.target.value === "oldest" ? "oldest" : null })}
          className="h-9 w-auto"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </Select>
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}
