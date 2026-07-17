"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Search, Bell, PanelLeftClose, PanelLeft, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { FRANCHISOR_NAV } from "./franchisorNav";
import { FranchisorSearch } from "./FranchisorSearch";
import { LogoutButton } from "@/components/layout/LogoutButton";

/**
 * Responsive franchisor portal shell: navy sidebar (collapsible desktop rail +
 * mobile drawer) + sticky header with permitted-content search, notifications,
 * and profile. Mirrors the admin shell's design language. Client component so
 * the drawer/collapse/search interactions work; all DATA is passed in as props
 * from the server layout.
 */
export function FranchisorShell({
  children,
  brandName,
  userName,
  notificationCount = 0,
}: {
  children: React.ReactNode;
  brandName: string;
  userName: string;
  notificationCount?: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/franchisor/dashboard"
      ? pathname === "/franchisor" || pathname === "/franchisor/dashboard"
      : pathname === href || pathname.startsWith(href + "/");

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 px-2" aria-label="Primary">
      {FRANCHISOR_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
              collapsed && "lg:justify-center lg:px-2"
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
            {item.badgeKey === "notifications" && notificationCount > 0 && (
              <span className={cn("ml-auto rounded-full bg-status-error px-1.5 py-0.5 text-[10px] font-bold text-white", collapsed && "lg:hidden")}>
                {notificationCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const SidebarInner = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col bg-sidebar">
      <div className={cn("flex items-center gap-2 px-4 py-4", collapsed && "lg:justify-center lg:px-2")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className={cn("min-w-0", collapsed && "lg:hidden")}>
          <div className="truncate text-sm font-bold text-white">{brandName}</div>
          <div className="truncate text-[11px] text-white/50">Franchisor Portal</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <NavList onNavigate={onNavigate} />
      </div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="hidden items-center gap-2 border-t border-white/10 px-4 py-3 text-sm text-white/60 hover:text-white lg:flex"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        <span className={cn(collapsed && "lg:hidden")}>Collapse</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Desktop sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden lg:block", collapsed ? "lg:w-16" : "lg:w-64")}>
        <SidebarInner />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-3 z-10 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarInner onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Content column */}
      <div className={cn("flex min-h-screen flex-col transition-[padding] lg:pl-64", collapsed && "lg:pl-16")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-4">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-2 hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden max-w-md flex-1 sm:block">
            <FranchisorSearch />
          </div>
          <div className="flex-1 sm:hidden" />

          <Link
            href="/franchisor/notifications"
            className="relative rounded-md p-2 hover:bg-muted"
            aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ""}`}
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-error px-1 text-[10px] font-bold text-white">
                {notificationCount}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-2 rounded-md p-1.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials || "FA"}
              </span>
              <span className="hidden text-sm font-medium sm:block">{userName}</span>
            </span>
            <LogoutButton variant="icon" />
          </div>
        </header>

        {/* Mobile search row */}
        <div className="border-b border-border bg-card px-3 py-2 sm:hidden">
          <FranchisorSearch />
        </div>

        <main className="flex-1 p-3 sm:p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

/** Icon-only fallback search trigger is unnecessary — the search box collapses gracefully. */
export { Search };
