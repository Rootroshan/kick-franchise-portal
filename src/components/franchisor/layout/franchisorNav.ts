import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Megaphone,
  Images,
  ClipboardList,
  ListChecks,
  Store,
  ChartNoAxesCombined,
  Bell,
  Activity,
  Settings,
} from "lucide-react";

export type FranchisorNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "notifications";
};

/**
 * Franchisor sidebar — brand communication & engagement only.
 * NO commerce entries (Catalogue/Orders/Payments/Allowances/Rebates) exist
 * here by design (§6). Adding one is a P0 lockout violation.
 */
export const FRANCHISOR_NAV: FranchisorNavItem[] = [
  { href: "/franchisor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/franchisor/announcements", label: "Announcements", icon: Megaphone },
  { href: "/franchisor/artwork", label: "Artwork Hub", icon: Images },
  { href: "/franchisor/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/franchisor/onboarding", label: "Onboarding", icon: ListChecks },
  { href: "/franchisor/stores", label: "Stores", icon: Store },
  { href: "/franchisor/analytics", label: "Engagement Analytics", icon: ChartNoAxesCombined },
  { href: "/franchisor/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
  { href: "/franchisor/activity", label: "Activity", icon: Activity },
  { href: "/franchisor/settings", label: "Settings", icon: Settings },
];
