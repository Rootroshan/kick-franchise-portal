import Link from "next/link";
import { Building2, Store, UserPlus, Wallet, Package, Megaphone, ClipboardList, Image, FileDown } from "lucide-react";

const ACTIONS = [
  { href: "/admin/tenants?new=1", label: "Create Brand", icon: Building2, tone: "text-status-info" },
  { href: "/admin/stores?new=1", label: "Add Store", icon: Store, tone: "text-status-success" },
  { href: "/admin/tenants?invite=1", label: "Invite User", icon: UserPlus, tone: "text-status-purple" },
  { href: "/admin/allowances?new=1", label: "Grant Allowance", icon: Wallet, tone: "text-status-teal" },
  { href: "/admin/commerce?new=1", label: "Create Product", icon: Package, tone: "text-status-info" },
  { href: "/admin/announcements?new=1", label: "Publish Announcement", icon: Megaphone, tone: "text-status-warning" },
  { href: "/admin/tasks?new=1", label: "Create Task", icon: ClipboardList, tone: "text-status-purple" },
  { href: "/admin/artwork?new=1", label: "Upload Artwork", icon: Image, tone: "text-status-teal" },
  { href: "/admin/rebates/reports", label: "Export Report", icon: FileDown, tone: "text-status-info" },
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
