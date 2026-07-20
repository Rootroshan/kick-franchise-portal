"use client";

import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sign-out control (Lucide LogOut icon).
 *
 * Deliberately does NOT use Clerk's useClerk()/SignOutButton: in local
 * dev-bypass mode the layout does not mount <ClerkProvider>, and the hook
 * THROWS during render ("useClerk can only be used within <ClerkProvider>").
 * That crashed the whole client subtree it was rendered in — a try/catch in the
 * handler can't help, because the failure happens at render time, not on click.
 *
 * Navigating to Clerk's sign-out route works in both modes: with Clerk active
 * it clears the session and redirects; in dev-bypass it simply lands on
 * /sign-in. No provider dependency, no render-time hook.
 *
 * `variant`:
 *  - "sidebar": full-width row for the dark navy sidebars (admin/franchisor)
 *  - "icon":    compact icon-only button for headers
 *  - "light":   bordered button for light surfaces (store settings)
 */
export function LogoutButton({
  variant = "sidebar",
  collapsed = false,
}: {
  variant?: "sidebar" | "icon" | "light";
  collapsed?: boolean;
}) {
  const signOut = () => {
    window.location.href = "/sign-out";
  };

  if (variant === "light") {
    return (
      <button
        onClick={signOut}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-status-error/30 px-4 text-sm font-medium text-status-error hover:bg-status-error/5"
        aria-label="Logout"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        onClick={signOut}
        className="rounded-md p-1.5 text-foreground hover:bg-muted"
        aria-label="Logout"
        title="Logout"
      >
        <LogOut className="h-5 w-5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      onClick={signOut}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted hover:bg-white/5 hover:text-white",
        collapsed && "lg:justify-center lg:px-0"
      )}
      aria-label="Logout"
      title="Logout"
    >
      <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className={cn(collapsed && "lg:hidden")}>Logout</span>
    </button>
  );
}
