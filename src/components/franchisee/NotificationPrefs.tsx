"use client";

import { toast } from "sonner";

const ROWS = [
  { key: "announcements", label: "New announcements" },
  { key: "tasks", label: "Task reminders" },
  { key: "onboarding", label: "Onboarding reminders" },
  { key: "orders", label: "Order & fulfilment updates" },
];

/** Per-store notification preferences. Not persisted yet (no prefs table);
 *  toggles are local, documented in the README. */
export function NotificationPrefs() {
  return (
    <div className="flex flex-col">
      {ROWS.map((r) => (
        <label key={r.key} className="flex min-h-11 items-center justify-between border-b border-border last:border-0">
          <span className="text-sm">{r.label}</span>
          <input
            type="checkbox"
            defaultChecked
            className="h-5 w-9 cursor-pointer"
            onChange={(e) => toast.success(`${r.label} ${e.target.checked ? "on" : "off"}`)}
          />
        </label>
      ))}
    </div>
  );
}
