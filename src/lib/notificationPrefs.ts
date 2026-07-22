/**
 * Notification preference categories shared by the client toggle UI and the
 * server prefs service. Kept dependency-free so it's safe in a client bundle.
 */
export const PREF_CATEGORIES = ["ANNOUNCEMENT", "TASK", "ONBOARDING", "ORDER"] as const;
export type PrefCategory = (typeof PREF_CATEGORIES)[number];

export const PREF_LABELS: Record<PrefCategory, string> = {
  ANNOUNCEMENT: "New announcements",
  TASK: "Task reminders",
  ONBOARDING: "Onboarding reminders",
  ORDER: "Order & fulfilment updates",
};
