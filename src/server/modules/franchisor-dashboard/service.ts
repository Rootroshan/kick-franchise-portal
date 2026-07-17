import type { RequestContext } from "@/server/db/withTenant";
import { assertFranchisor } from "./permissions";
import { resolveDateRange } from "./dateRange";
import { periodCounts, storeEngagement, dashboardEntities } from "./repository";
import { safePercent, trend, countTrend, overallEngagement, storeScore } from "./calculations";
import type { FranchisorDashboardData, Kpi, AnnouncementItem, OnboardingItem, ActivityItem, NotificationItem } from "./types";

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/**
 * Assemble the full franchisor dashboard for one tenant + date range.
 * Non-commerce only; role/tenant enforced by assertFranchisor + RLS.
 */
export async function getFranchisorDashboard(
  ctx: RequestContext,
  rangeParams: { from?: string; to?: string; preset?: string }
): Promise<FranchisorDashboardData> {
  const fctx = assertFranchisor(ctx);
  const tenantId = fctx.tenantId;
  const { current, previous, label } = resolveDateRange(rangeParams);

  const [cur, prev, stores, entities] = await Promise.all([
    periodCounts(ctx, tenantId, current),
    periodCounts(ctx, tenantId, previous),
    storeEngagement(ctx, tenantId, current),
    dashboardEntities(ctx, tenantId),
  ]);

  // ---- KPI percentages (current + previous) ----
  const annReadCur = safePercent(cur.ackDone, cur.ackOpportunities);
  const annReadPrev = safePercent(prev.ackDone, prev.ackOpportunities);
  const tasksCur = safePercent(cur.taskCompleted, cur.taskTotal);
  const tasksPrev = safePercent(prev.taskCompleted, prev.taskTotal);
  const onbCur = safePercent(cur.onbDone, cur.onbTotal);
  const onbPrev = safePercent(prev.onbDone, prev.onbTotal);

  const kpis: Kpi[] = [
    {
      key: "activeStores",
      label: "Active Stores",
      value: fmtNumber(cur.activeStores),
      raw: cur.activeStores,
      isPercent: false,
      trend: countTrend(cur.activeStores, prev.activeStores),
      available: true,
    },
    {
      key: "announcementsRead",
      label: "Announcements Read",
      value: `${annReadCur}%`,
      raw: annReadCur,
      isPercent: true,
      trend: trend(annReadCur, annReadPrev),
      available: cur.ackOpportunities > 0,
    },
    {
      key: "tasksCompleted",
      label: "Tasks Completed",
      value: `${tasksCur}%`,
      raw: tasksCur,
      isPercent: true,
      trend: trend(tasksCur, tasksPrev),
      available: cur.taskTotal > 0,
    },
    {
      key: "onboardingProgress",
      label: "Onboarding Progress",
      value: `${onbCur}%`,
      raw: onbCur,
      isPercent: true,
      trend: trend(onbCur, onbPrev),
      available: cur.onbTotal > 0,
    },
    {
      key: "artworkDownloads",
      label: "Artwork Downloads",
      value: fmtNumber(cur.artworkDownloads),
      raw: cur.artworkDownloads,
      isPercent: false,
      trend: countTrend(cur.artworkDownloads, prev.artworkDownloads),
      available: true,
    },
  ];

  // ---- Engagement donut (percentage components only) ----
  const artworkEngagementCur = safePercent(cur.artworkDownloads, cur.activeStores); // downloads-per-active-store, capped 100
  const artworkEngagementPrev = safePercent(prev.artworkDownloads, prev.activeStores);
  const components = [
    { key: "announcements", label: "Announcements Read", percent: annReadCur, available: cur.ackOpportunities > 0 },
    { key: "tasks", label: "Tasks Completed", percent: tasksCur, available: cur.taskTotal > 0 },
    { key: "onboarding", label: "Onboarding Progress", percent: onbCur, available: cur.onbTotal > 0 },
    { key: "artwork", label: "Artwork Engagement", percent: artworkEngagementCur, available: cur.activeStores > 0 },
  ];
  const overall = overallEngagement(components);
  const overallPrev = overallEngagement([
    { percent: annReadPrev, available: prev.ackOpportunities > 0 },
    { percent: tasksPrev, available: prev.taskTotal > 0 },
    { percent: onbPrev, available: prev.onbTotal > 0 },
    { percent: artworkEngagementPrev, available: prev.activeStores > 0 },
  ]);

  // ---- Top stores ----
  const topStores = stores
    .map((s) => ({
      id: s.id,
      name: s.name,
      score: storeScore([
        { percent: s.ackDone > 0 ? 100 : 0, available: true },
        { percent: safePercent(s.taskDone, s.taskTotal), available: s.taskTotal > 0 },
        { percent: safePercent(s.onbDone, s.onbTotal), available: s.onbTotal > 0 },
      ]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // ---- Announcements ----
  const activeStoreCount = entities.activeStores || 1;
  const announcements: AnnouncementItem[] = entities.announcements.map((a) => ({
    id: a.id,
    title: a.title,
    excerpt: a.body.slice(0, 120),
    status: a.status,
    publishAt: a.publishAt,
    requiresAck: a.requiresAck,
    isPinned: a.isPinned,
    readPercent: a.requiresAck ? safePercent(a._count.acks, activeStoreCount) : 0,
  }));

  // ---- Onboarding ----
  const onboarding: OnboardingItem[] = entities.templates.map((t) => {
    const allProgress = t.items.flatMap((it) => it.progress);
    const storesAssigned = new Set(allProgress.map((p) => p.locationId)).size;
    const perStoreDone = new Map<string, { total: number; done: number }>();
    for (const it of t.items) {
      for (const p of it.progress) {
        const cur2 = perStoreDone.get(p.locationId) ?? { total: 0, done: 0 };
        cur2.total += 1;
        if (p.done) cur2.done += 1;
        perStoreDone.set(p.locationId, cur2);
      }
    }
    const storesCompleted = [...perStoreDone.values()].filter((v) => v.total > 0 && v.done === v.total).length;
    const lastActivity = allProgress.reduce<Date | null>((max, p) => (p.doneAt && (!max || p.doneAt > max) ? p.doneAt : max), null);
    const stalled = storesCompleted < storesAssigned && (!lastActivity || lastActivity < entities.staleThreshold);
    return {
      id: t.id,
      name: t.name,
      storesAssigned,
      storesCompleted,
      percent: safePercent(storesCompleted, storesAssigned),
      stalled,
    };
  });

  // ---- Activity ----
  const activity: ActivityItem[] = entities.activity.map((l) => ({
    id: l.id,
    action: l.action,
    actor: l.actorId,
    entity: l.entity,
    entityId: l.entityId,
    createdAt: l.createdAt,
  }));

  // ---- Notifications (permitted categories only) ----
  const notifications: NotificationItem[] = [];
  if (cur.taskOverdue > 0) {
    notifications.push({ id: "n-overdue", category: "overdue_tasks", message: `${cur.taskOverdue} task${cur.taskOverdue === 1 ? " is" : "s are"} overdue`, createdAt: entities.now, href: "/franchisor/tasks?status=overdue" });
  }
  const unreadStores = Math.max(0, activeStoreCount - cur.ackDone);
  if (cur.ackOpportunities > 0 && unreadStores > 0) {
    notifications.push({ id: "n-unread", category: "unread_announcement", message: `${unreadStores} store${unreadStores === 1 ? " has" : "s have"} not acknowledged the latest announcement`, createdAt: entities.now, href: "/franchisor/announcements" });
  }
  const stalledCount = onboarding.filter((o) => o.stalled).length;
  if (stalledCount > 0) {
    notifications.push({ id: "n-onb", category: "onboarding_inactivity", message: `${stalledCount} onboarding template${stalledCount === 1 ? " has" : "s have"} stalled stores`, createdAt: entities.now, href: "/franchisor/onboarding" });
  }
  if (entities.pushFailures > 0) {
    notifications.push({ id: "n-push", category: "push_failure", message: `${entities.pushFailures} push notification${entities.pushFailures === 1 ? "" : "s"} failed to deliver`, createdAt: entities.now, href: "/franchisor/notifications" });
  }
  if (notifications.length === 0) {
    notifications.push({ id: "n-ok", category: "system", message: "All systems operational — everything is running smoothly", createdAt: entities.now, href: null });
  }

  const theme = (entities.brand?.theme as { logoUrl?: string } | null) ?? null;

  return {
    brand: {
      id: entities.brand?.id ?? tenantId,
      name: entities.brand?.name ?? "Your Brand",
      logoUrl: theme?.logoUrl || null,
      totalStores: entities.brand?._count.locations ?? 0,
      activeStores: entities.activeStores,
      brandAdmins: entities.brandAdmins,
      createdAt: entities.brand?.createdAt ?? new Date(),
    },
    kpis,
    engagement: { overall, overallTrend: trend(overall, overallPrev), components },
    topStores,
    tasks: { open: cur.taskOpen, overdue: cur.taskOverdue, dueThisWeek: cur.taskDueThisWeek, completed: cur.taskCompleted },
    announcements,
    onboarding,
    activity,
    notifications,
    rangeLabel: label,
  };
}
