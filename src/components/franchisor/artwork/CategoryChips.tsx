import Link from "next/link";
import { buildHref } from "@/lib/adminQuery";
import { cn } from "@/lib/utils";

/**
 * Category navigation for the Artwork Hub. Renders as a vertical list on
 * desktop (lg+) and a horizontally-scrollable chip row on mobile (§9).
 * URL-driven via ?category=.
 */
export function CategoryChips({
  categories,
  active,
  basePath,
  currentParams,
}: {
  categories: Array<{ name: string; count: number }>;
  active: string;
  basePath: string;
  currentParams: Record<string, string>;
}) {
  return (
    <nav aria-label="Artwork categories">
      <ul className="flex gap-1.5 scrollbar-hide overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {categories.map((c) => {
          const value = c.name === "all" ? "" : c.name;
          const isActive = active === (c.name === "all" ? "all" : c.name) || (c.name === "all" && (active === "" || active === "all"));
          const label = c.name === "all" ? "All Files" : c.name;
          return (
            <li key={c.name} className="shrink-0">
              <Link
                href={buildHref(basePath, currentParams, { category: value, page: 1 })}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors lg:w-full",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="truncate">{label}</span>
                <span className="text-xs tabular-nums opacity-70">{c.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
