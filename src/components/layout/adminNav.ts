import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Store,
  Building2,
  Megaphone,
  Image,
  ClipboardList,
  GraduationCap,
  Package,
  ShoppingCart,
  Wallet,
  Percent,
  FileBarChart,
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
  { href: "/admin/tenants", label: "Brands", icon: Building2 },
  { href: "/admin/stores", label: "Stores", icon: Store },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/artwork", label: "Artwork Hub", icon: Image },
  { href: "/admin/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/admin/onboarding", label: "Onboarding", icon: GraduationCap },
  { href: "/admin/commerce", label: "Catalogue", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/allowances", label: "Allowances", icon: Wallet },
  { href: "/admin/rebates", label: "Rebates", icon: Percent },
  { href: "/admin/rebates/reports", label: "Reports", icon: FileBarChart },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
  { href: "/admin/audit-log", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
