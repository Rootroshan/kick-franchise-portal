import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  Store,
  Users2,
  ShieldCheck,
  CreditCard,
  Megaphone,
  Images,
  ClipboardList,
  ListChecks,
  Package,
  ShoppingCart,
  WalletCards,
  BadgePercent,
  FileChartColumn,
  Bell,
  ScrollText,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "notifications"; // dynamic count filled by the shell
};

/** Kick Super Admin sidebar (design reference order). */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/brands", label: "Brands", icon: Building2 },
  { href: "/admin/stores", label: "Stores", icon: Store },
  { href: "/admin/users", label: "Users", icon: Users2 },
  { href: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/artwork", label: "Artwork Hub", icon: Images },
  { href: "/admin/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/admin/onboarding", label: "Onboarding", icon: ListChecks },
  { href: "/admin/commerce", label: "Catalogue", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/allowances", label: "Allowances", icon: WalletCards },
  { href: "/admin/rebates", label: "Rebates", icon: BadgePercent },
  { href: "/admin/rebates/reports", label: "Reports", icon: FileChartColumn },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
  { href: "/admin/audit-log", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
