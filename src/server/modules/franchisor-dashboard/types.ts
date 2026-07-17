import type { Trend } from "./calculations";

/** Everything the franchisor dashboard renders. NO commerce fields exist here by design. */

export type Kpi = {
  key: "activeStores" | "announcementsRead" | "tasksCompleted" | "onboardingProgress" | "artworkDownloads";
  label: string;
  /** Formatted for display (e.g. "82%", "48", "1,248"). */
  value: string;
  /** Raw numeric value for accessibility / sorting. */
  raw: number;
  isPercent: boolean;
  trend: Trend;
  available: boolean;
};

export type EngagementComponent = { key: string; label: string; percent: number; available: boolean };

export type TopStore = {
  id: string;
  name: string;
  score: number; // 0..100 engagement
};

export type TaskSummary = { open: number; overdue: number; dueThisWeek: number; completed: number };

export type BrandSummary = {
  id: string;
  name: string;
  logoUrl: string | null;
  totalStores: number;
  activeStores: number;
  brandAdmins: number;
  createdAt: Date;
};

export type AnnouncementItem = {
  id: string;
  title: string;
  excerpt: string;
  status: string;
  publishAt: Date | null;
  requiresAck: boolean;
  isPinned: boolean;
  readPercent: number;
};

export type OnboardingItem = {
  id: string;
  name: string;
  storesAssigned: number;
  storesCompleted: number;
  percent: number;
  stalled: boolean;
};

export type ActivityItem = {
  id: string;
  action: string;
  actor: string;
  entity: string;
  entityId: string | null;
  createdAt: Date;
};

export type NotificationItem = {
  id: string;
  category: "overdue_tasks" | "unread_announcement" | "onboarding_inactivity" | "push_failure" | "system";
  message: string;
  createdAt: Date;
  href: string | null;
};

export type FranchisorDashboardData = {
  brand: BrandSummary;
  kpis: Kpi[];
  engagement: { overall: number; overallTrend: Trend; components: EngagementComponent[] };
  topStores: TopStore[];
  tasks: TaskSummary;
  announcements: AnnouncementItem[];
  onboarding: OnboardingItem[];
  activity: ActivityItem[];
  notifications: NotificationItem[];
  rangeLabel: string;
};
