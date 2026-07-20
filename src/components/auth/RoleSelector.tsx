"use client";

import { cn } from "@/lib/utils";
import type { PortalRole } from "@/server/auth/loginValidation";

/**
 * Segmented role selector for the brand portals.
 *
 * This is a CONVENIENCE, not a permission. The server compares the choice
 * against Membership.role and rejects a mismatch — it can never grant a role
 * the user does not already hold. See server/auth/loginValidation.ts.
 *
 * Rendered as radios rather than buttons so arrow keys move between options and
 * screen readers announce it as one grouped choice.
 */
const OPTIONS: Array<{ value: PortalRole; label: string }> = [
  { value: "FRANCHISOR_ADMIN", label: "Franchise Admin" },
  { value: "FRANCHISEE_USER", label: "User" },
];

export function RoleSelector({
  value,
  onChange,
  disabled,
}: {
  value: PortalRole;
  onChange: (role: PortalRole) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="mb-5">
      <legend className="sr-only">Sign in as</legend>
      <div
        className="flex gap-1 rounded-full bg-muted p-1"
        style={{ borderRadius: 100 }}
        role="radiogroup"
        aria-label="Sign in as"
      >
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <label
              key={opt.value}
              className={cn(
                "relative flex flex-1 cursor-pointer items-center justify-center px-4 py-2.5 text-sm font-medium transition-colors",
                "focus-within:ring-2 focus-within:ring-[var(--tenant-primary,#2563eb)] focus-within:ring-offset-1",
                selected ? "text-white" : "text-muted-foreground hover:text-foreground",
                disabled && "cursor-not-allowed opacity-60"
              )}
              style={{
                borderRadius: 100,
                // Tenant primary colour, with a sensible fallback when a brand
                // has not set one. Never hard-coded per brand.
                backgroundColor: selected ? "var(--tenant-primary, #2563eb)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="portal-role"
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                disabled={disabled}
                className="sr-only"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
