"use client";

import { LogOut } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

/**
 * Sign-out control (Lucide LogOut icon). Uses Clerk's signOut() and returns to
 * /sign-in. `useClerk()` is safe here because every shell that renders this is
 * mounted under <ClerkProvider> in production; in local dev-bypass mode Clerk
 * isn't active, so signOut() is a no-op and we just navigate to /sign-in.
 *
 * `variant`:
 *  - "sidebar": full-width row for the dark navy sidebars (admin/franchisor)
 *  - "icon":    compact icon-only button for headers
 */
export function LogoutButton({
  variant = "sidebar",
  collapsed = false,
}: {
  variant?: "sidebar" | "icon" | "light";
  collapsed?: boolean;
}) {
  const clerk = useClerk();

  const signOut = () => {
    try {
      void clerk.signOut({ redirectUrl: "/sign-in" });
    } catch {
      window.location.href = "/sign-in";
    }
  };

  if (variant === "light") {
    return (
      <button
        onClick={signOut}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-status-error/30 px-4 text-sm font-medium text-status-error hover:bg-status-error/5"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        onClick={signOut}
        className="rounded-md p-1.5 text-foreground hover:bg-muted"
        aria-label="Sign out"
        title="Sign out"
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
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className={cn(collapsed && "lg:hidden")}>Sign out</span>
    </button>
  );
}
