"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setNotificationPrefsAction } from "@/app/(franchisee)/settings/actions";
import { PREF_CATEGORIES, PREF_LABELS, type PrefCategory } from "@/lib/notificationPrefs";

/**
 * Per-category in-app notification opt-outs. Persisted on the caller's own
 * Membership row (notificationPrefs Json) and enforced server-side in
 * createNotification() — these are real toggles, not decoration.
 */
export function NotificationPrefs({ prefs }: { prefs: Record<PrefCategory, boolean> }) {
  const [state, setState] = useState(prefs);
  const [busyKey, setBusyKey] = useState<PrefCategory | null>(null);

  async function toggle(key: PrefCategory, checked: boolean) {
    const previous = state;
    setState({ ...state, [key]: checked });
    setBusyKey(key);
    const res = await setNotificationPrefsAction({ [key]: checked });
    setBusyKey(null);
    if (!res.ok) {
      setState(previous); // revert — never show a saved state that didn't save
      toast.error(res.message);
      return;
    }
    toast.success(`${PREF_LABELS[key]} ${checked ? "on" : "off"}`);
  }

  return (
    <div className="flex flex-col">
      {PREF_CATEGORIES.map((key) => (
        <label key={key} className="flex min-h-11 cursor-pointer items-center justify-between border-b border-border last:border-0">
          <span className="text-sm">{PREF_LABELS[key]}</span>
          <input
            type="checkbox"
            checked={state[key]}
            disabled={busyKey === key}
            className="h-5 w-9 cursor-pointer"
            onChange={(e) => toggle(key, e.target.checked)}
          />
        </label>
      ))}
    </div>
  );
}
