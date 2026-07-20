import Link from "next/link";
import { Building2, Store, Wallet, Package, Megaphone, ClipboardList, Image, FileDown, ScrollText } from "lucide-react";

/**
 * Every href here must land on a page that actually performs (or directly
 * offers) the action. Previously these pointed at `?new=1` / `?invite=1`
 * params that no page reads, so the buttons silently did nothing — the user
 * just landed on a list. Brand creation has a real admin route; the rest link
 * to the management surface for that entity, where the create control lives.
 */
const ACTIONS = [
  { href: "/admin/brands/new", label: "Create Brand", icon: Building2, tone: "text-status-info" },
  { href: "/admin/stores", label: "Manage Stores", icon: Store, tone: "text-status-success" },
  { href: "/admin/allowances", label: "Allowances", icon: Wallet, tone: "text-status-teal" },
  { href: "/admin/commerce", label: "Catalogue", icon: Package, tone: "text-status-info" },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone, tone: "text-status-warning" },
  { href: "/admin/tasks", label: "Tasks", icon: ClipboardList, tone: "text-status-purple" },
  { href: "/admin/artwork", label: "Artwork Hub", icon: Image, tone: "text-status-teal" },
  { href: "/admin/rebates/reports", label: "Reports", icon: FileDown, tone: "text-status-info" },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText, tone: "text-status-purple" },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.label}
            href={a.href}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-3 text-center transition-colors hover:bg-muted"
          >
            <Icon className={`h-5 w-5 ${a.tone}`} />
            <span className="text-[11px] font-medium leading-tight text-foreground">{a.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
