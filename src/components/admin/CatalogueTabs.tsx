"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Section tabs for Catalogue.
 *
 * Pricing/variants and ordering rules were previously reachable only as
 * separate top-level destinations. These tabs group them under Catalogue
 * without moving any route, so existing deep links keep working and no
 * redirect is needed.
 */
const TABS = [
  { href: "/admin/commerce", label: "Products" },
  { href: "/admin/commerce?view=variants", label: "Variants & Pricing" },
  { href: "/admin/ordering-rules", label: "Ordering Rules" },
  { href: "/admin/commerce?view=stock", label: "Stock Visibility" },
] as const;

export function CatalogueTabs({ activeView }: { activeView?: string }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (pathname !== path) return false;
    const view = query?.split("=")[1];
    return view ? activeView === view : !activeView;
  };

  return (
    <nav className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-border" aria-label="Catalogue sections">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
            isActive(t.href)
              ? "border-status-info text-status-info"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
