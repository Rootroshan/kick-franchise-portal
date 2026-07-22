import Link from "next/link";
import { Bell } from "lucide-react";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { BrandMark } from "@/components/layout/BrandMark";

/**
 * Store User portal top bar. The bottom nav (BottomNav) already owns primary
 * navigation, so this stays minimal — brand identity plus the two things a
 * signed-in user expects reachable from anywhere: notifications and logout.
 * Mirrors FranchisorShell's header language (sticky, blurred, same icon
 * sizing) without duplicating its sidebar/search, which don't apply here.
 */
export function TopBar({
  brandName,
  logoUrl,
  unreadCount = 0,
}: {
  brandName: string;
  logoUrl?: string | null;
  unreadCount?: number;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/95 px-4 backdrop-blur">
      <Link href="/" className="flex min-w-0 flex-1 items-center" aria-label={brandName}>
        <BrandMark name={brandName} logoUrl={logoUrl} imgClassName="h-8 max-w-[140px]" nameClassName="text-sm" />
      </Link>

      <Link
        href="/notifications"
        className="relative rounded-md p-2 hover:bg-muted"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-error px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>

      <LogoutButton variant="icon" />
    </header>
  );
}
