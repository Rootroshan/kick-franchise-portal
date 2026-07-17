"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, PanelLeftClose, PanelLeft, Search, Bell, ChevronDown } from "lucide-react";
import { LogoutButton } from "./LogoutButton";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./adminNav";

type Props = {
  children: React.ReactNode;
  roleLabel: string;
  userName: string;
  badges?: { notifications?: number };
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin/dashboard") return pathname === "/admin" || pathname === "/admin/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/admin/dashboard": { title: "Super Admin Dashboard", subtitle: "Full control across brands, commerce, and platform operations." },
  "/admin/tenants": { title: "Brands", subtitle: "Every brand on the Kick platform." },
  "/admin/stores": { title: "Stores", subtitle: "All franchisee locations across brands." },
  "/admin/announcements": { title: "Announcements", subtitle: "Platform-wide and per-brand communications." },
  "/admin/artwork": { title: "Artwork Hub", subtitle: "Brand assets — Kick-managed." },
  "/admin/tasks": { title: "Tasks", subtitle: "Operational tasks across brands." },
  "/admin/onboarding": { title: "Onboarding", subtitle: "New-store setup progress." },
  "/admin/commerce": { title: "Catalogue", subtitle: "Products, variants, SKUs and pricing." },
  "/admin/orders": { title: "Orders", subtitle: "All orders across every brand." },
  "/admin/allowances": { title: "Allowances", subtitle: "Per-store spending allowances." },
  "/admin/rebates": { title: "Rebates", subtitle: "Rebate rules and accruals." },
  "/admin/audit-log": { title: "Audit Logs", subtitle: "Every privileged action, recorded." },
  "/admin/notifications": { title: "Notifications", subtitle: "Platform alerts and events." },
  "/admin/settings": { title: "Settings", subtitle: "Platform configuration." },
};

const DASHBOARD_META = { title: "Super Admin Dashboard", subtitle: "Full control across brands, commerce, and platform operations." };

function pageMeta(pathname: string): { title: string; subtitle?: string } {
  if (pathname === "/admin" || pathname === "/admin/dashboard") return DASHBOARD_META;
  // longest matching prefix
  const match = Object.keys(PAGE_META)
    .filter((k) => pathname === k || pathname.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return (match && PAGE_META[match]) || { title: "Kick Admin" };
}

export function AdminShell({ children, roleLabel, userName, badges }: Props) {
  const pathname = usePathname();
  const { title, subtitle } = pageMeta(pathname);
  const [collapsed, setCollapsed] = useState(false); // desktop rail
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile drawer

  const sidebarWidth = collapsed ? "lg:w-16" : "lg:w-64";

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        const badge = item.badgeKey ? badges?.[item.badgeKey] : undefined;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-sidebar-active",
              active
                ? "bg-sidebar-active text-sidebar-active-foreground"
                : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
              collapsed && "lg:justify-center lg:px-0"
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
            {badge != null && badge > 0 && (
              <span
                className={cn(
                  "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-active px-1.5 text-xs font-bold text-sidebar-active-foreground",
                  active && "bg-white/25",
                  collapsed && "lg:absolute lg:right-1 lg:top-1 lg:ml-0 lg:h-4 lg:min-w-4"
                )}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const SidebarBrand = () => (
    <div className={cn("flex items-center gap-2 border-b border-sidebar-border px-4 py-4", collapsed && "lg:justify-center lg:px-0")}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-active text-sm font-black text-sidebar-active-foreground">
        K
      </div>
      <div className={cn("leading-tight", collapsed && "lg:hidden")}>
        <div className="text-sm font-bold text-white">KICK</div>
        <div className="text-[10px] uppercase tracking-wide text-sidebar-muted">Franchise Portal</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-app-bg">
      {/* ---- Desktop sidebar (fixed) ---- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar transition-[width] duration-200 lg:flex",
          sidebarWidth
        )}
      >
        <SidebarBrand />
        <NavList />
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted hover:bg-white/5 hover:text-white"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            <span className={cn(collapsed && "lg:hidden")}>Collapse</span>
          </button>
          <div className={cn("mt-1 flex items-center gap-2 rounded-md px-3 py-2", collapsed && "lg:justify-center lg:px-0")}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className={cn("min-w-0 leading-tight", collapsed && "lg:hidden")}>
              <div className="truncate text-xs font-medium text-white">{userName}</div>
              <div className="truncate text-[10px] text-sidebar-muted">{roleLabel}</div>
            </div>
          </div>
          <LogoutButton collapsed={collapsed} />
        </div>
      </aside>

      {/* ---- Mobile drawer ---- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar shadow-xl">
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
              <SidebarBrand />
              <button onClick={() => setDrawerOpen(false)} className="text-sidebar-muted hover:text-white" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* ---- Main column ---- */}
      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-200", collapsed ? "lg:pl-16" : "lg:pl-64")}>
        {/* Sticky header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-1.5 text-foreground hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-base font-bold sm:text-lg">{title}</h1>
            </div>
            {subtitle && <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>}
          </div>

          {/* Global search — desktop */}
          <form action="/admin/search" className="relative hidden max-w-xs flex-1 md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              placeholder="Search brands, stores, orders…"
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </form>

          <Link
            href="/admin/notifications"
            className="relative rounded-md p-1.5 text-foreground hover:bg-muted"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {(badges?.notifications ?? 0) > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-error px-1 text-[10px] font-bold text-white">
                {badges!.notifications}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-muted">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-xs font-medium">{userName}</div>
              <div className="text-[10px] text-muted-foreground">{roleLabel}</div>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </div>
        </header>

        {/* Mobile search bar */}
        <div className="border-b border-border bg-card px-4 py-2 md:hidden">
          <form action="/admin/search" className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              placeholder="Search…"
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </form>
        </div>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
