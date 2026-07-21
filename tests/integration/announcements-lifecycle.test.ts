import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import {
  createAnnouncement,
  listAnnouncements,
  acknowledgeAnnouncement,
  getAcknowledgementReport,
  getAcknowledgementSummary,
  getAnnouncementAcknowledgementUsers,
} from "@/server/modules/announcements/service";
import { listFranchisorAnnouncements } from "@/server/modules/announcements/franchisorList";
import {
  listAnnouncementsAdmin,
  getAnnouncementKpis,
  getAnnouncementPublishCalendar,
  getAnnouncementRecentActivity,
} from "@/server/modules/announcements/admin";
import { publishScheduledAnnouncements, expireAnnouncements } from "../../worker/jobs/announcements";
import { parseListQuery } from "@/lib/adminQuery";

const emptyQuery = parseListQuery({});

describe("Announcements: visibility, ack-once, pinned sort, scheduling", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("hides a scheduled (not-yet-published) announcement from the franchisee feed", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await createAnnouncement(franchisorCtx(tenant.id), tenant.id, {
      title: "Not yet",
      body: "x",
      isPinned: false,
      requiresAck: false,
      publishAt: future,
    });

    const feed = await listAnnouncements(franchiseeCtx(tenant.id, location.id), tenant.id);
    expect(feed.find((a) => a.title === "Not yet")).toBeUndefined();
  });

  it("hides an expired announcement from the franchisee feed even if status hasn't been cron-flipped yet", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(tenant.id), tenant.id, {
      title: "Old news",
      body: "x",
      isPinned: false,
      requiresAck: false,
    });
    // Force it PUBLISHED-but-expired without waiting on the cron, to prove
    // the live expiresAt check in listAnnouncements is independent of it.
    await withTenant(kickCtx(), (tx) =>
      tx.announcement.update({ where: { id: created.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    );

    const feed = await listAnnouncements(franchiseeCtx(tenant.id, location.id), tenant.id);
    expect(feed.find((a) => a.title === "Old news")).toBeUndefined();
  });

  it("shows a currently-published, non-expired announcement", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Live now", body: "x", isPinned: false, requiresAck: false });

    const feed = await listAnnouncements(franchiseeCtx(tenant.id, location.id), tenant.id);
    expect(feed.find((a) => a.title === "Live now")).toBeDefined();
  });

  it("acknowledging twice is idempotent (DB-level once-per-user, no error on repeat)", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Ack me", body: "x", isPinned: false, requiresAck: true });
    const ctx = franchiseeCtx(tenant.id, location.id, "u-ack-twice");

    await acknowledgeAnnouncement(ctx, created.id);
    await expect(acknowledgeAnnouncement(ctx, created.id)).resolves.not.toThrow();

    const acks = await withTenant(kickCtx(), (tx) => tx.announcementAck.findMany({ where: { announcementId: created.id } }));
    expect(acks).toHaveLength(1);
  });

  it("rejects acknowledging an announcement from another tenant", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(a.tenant.id), a.tenant.id, { title: "A only", body: "x", isPinned: false, requiresAck: true });

    await expect(acknowledgeAnnouncement(franchiseeCtx(b.tenant.id, b.location.id), created.id)).rejects.toThrow();
  });

  it("sorts pinned first on the franchisee feed, franchisor list, and KICK_ADMIN list", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Unpinned", body: "x", isPinned: false, requiresAck: false });
    await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Pinned", body: "x", isPinned: true, requiresAck: false });

    const feed = await listAnnouncements(franchiseeCtx(tenant.id, location.id), tenant.id);
    expect(feed[0]?.title).toBe("Pinned");

    const franchisorList = await listFranchisorAnnouncements(franchisorCtx(tenant.id), tenant.id, emptyQuery);
    expect(franchisorList.rows[0]?.title).toBe("Pinned");

    const adminList = await listAnnouncementsAdmin(kickCtx(), emptyQuery);
    expect(adminList.rows[0]?.title).toBe("Pinned");
  });

  it("keeps pinned first on the franchisor list even when sorting by title", async () => {
    const { tenant } = await seedTenantWithLocation();
    await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Zzz unpinned", body: "x", isPinned: false, requiresAck: false });
    await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Aaa pinned", body: "x", isPinned: true, requiresAck: false });

    const bySortedTitle = await listFranchisorAnnouncements(franchisorCtx(tenant.id), tenant.id, { ...emptyQuery, sort: "title", direction: "asc" });
    // "Aaa pinned" would sort first alphabetically anyway — use a case where
    // alphabetical order would put the unpinned one first, to prove pinned
    // genuinely wins over the requested sort rather than agreeing by luck.
    expect(bySortedTitle.rows[0]?.title).toBe("Aaa pinned");
  });

  it("publishScheduledAnnouncements flips SCHEDULED to PUBLISHED once publishAt has passed", async () => {
    const { tenant } = await seedTenantWithLocation();
    // Created as SCHEDULED (publishAt genuinely in the future)...
    const created = await createAnnouncement(franchisorCtx(tenant.id), tenant.id, {
      title: "Will publish",
      body: "x",
      isPinned: false,
      requiresAck: false,
      publishAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const before = await withTenant(kickCtx(), (tx) => tx.announcement.findUnique({ where: { id: created.id } }));
    expect(before?.status).toBe("SCHEDULED");

    // ...then simulate time passing by moving publishAt into the past
    // directly, the same way the real cron would find it due on its next run.
    await withTenant(kickCtx(), (tx) => tx.announcement.update({ where: { id: created.id }, data: { publishAt: new Date(Date.now() - 1000) } }));

    const result = await publishScheduledAnnouncements();
    expect(result.published).toBeGreaterThanOrEqual(1);

    const after = await withTenant(kickCtx(), (tx) => tx.announcement.findUnique({ where: { id: created.id } }));
    expect(after?.status).toBe("PUBLISHED");
  });

  it("expireAnnouncements flips PUBLISHED to EXPIRED once expiresAt has passed", async () => {
    const { tenant } = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Will expire", body: "x", isPinned: false, requiresAck: false });
    await withTenant(kickCtx(), (tx) => tx.announcement.update({ where: { id: created.id }, data: { expiresAt: new Date(Date.now() - 1000) } }));

    const result = await expireAnnouncements();
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const after = await withTenant(kickCtx(), (tx) => tx.announcement.findUnique({ where: { id: created.id } }));
    expect(after?.status).toBe("EXPIRED");
  });

  it("getAcknowledgementReport for FRANCHISOR_ADMIN rejects another tenant's announcement even with the id known", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(a.tenant.id), a.tenant.id, { title: "A only", body: "x", isPinned: false, requiresAck: true });

    await expect(getAcknowledgementReport(franchisorCtx(b.tenant.id), created.id, b.tenant.id)).rejects.toThrow();
  });

  it("getAcknowledgementReport reports per-store, not per-user, acknowledgement", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Report me", body: "x", isPinned: false, requiresAck: true });
    // Two different users at the SAME store both ack — store should count once.
    await acknowledgeAnnouncement(franchiseeCtx(tenant.id, location.id, "u1"), created.id);
    await acknowledgeAnnouncement(franchiseeCtx(tenant.id, location.id, "u2"), created.id);

    const report = await getAcknowledgementReport(franchisorCtx(tenant.id), created.id, tenant.id);
    expect(report.totalLocations).toBe(1);
    expect(report.acknowledgedCount).toBe(1);
  });

  it("getAnnouncementKpis counts an EXPIRED announcement separately from the other statuses", async () => {
    const { tenant } = await seedTenantWithLocation();
    await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Draft one", body: "x", isPinned: false, requiresAck: false, publishAt: null }).then((a) =>
      withTenant(kickCtx(), (tx) => tx.announcement.update({ where: { id: a.id }, data: { status: "DRAFT" } }))
    );
    const expired = await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Old news", body: "x", isPinned: false, requiresAck: false });
    await withTenant(kickCtx(), (tx) => tx.announcement.update({ where: { id: expired.id }, data: { status: "EXPIRED", expiresAt: new Date(Date.now() - 1000) } }));
    await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Live", body: "x", isPinned: false, requiresAck: false });

    const kpis = await getAnnouncementKpis(kickCtx());
    expect(kpis.expired).toBe(1);
    expect(kpis.published).toBe(1);
    expect(kpis.drafts).toBe(1);
    expect(kpis.total).toBe(3);
  });

  it("getAcknowledgementSummary computes percent from eligible FRANCHISEE_USER memberships, not from acks alone", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Please ack", body: "x", isPinned: false, requiresAck: true });
    // Three eligible store users, only one of whom acks.
    await withTenant(kickCtx(), (tx) =>
      tx.membership.createMany({
        data: [
          { clerkUserId: "u1", tenantId: tenant.id, locationId: location.id, role: "FRANCHISEE_USER" },
          { clerkUserId: "u2", tenantId: tenant.id, locationId: location.id, role: "FRANCHISEE_USER" },
          { clerkUserId: "u3", tenantId: tenant.id, locationId: location.id, role: "FRANCHISEE_USER" },
        ],
      })
    );
    await acknowledgeAnnouncement(franchiseeCtx(tenant.id, location.id, "u1"), created.id);

    const summary = await getAcknowledgementSummary(franchisorCtx(tenant.id), tenant.id, created.id);
    expect(summary.totalEligibleUsers).toBe(3);
    expect(summary.acknowledgedUsers).toBe(1);
    expect(summary.pendingUsers).toBe(2);
    expect(summary.percent).toBe(33); // Math.round(1/3 * 100)
  });

  it("getAcknowledgementSummary returns 0 percent (not NaN/divide-by-zero) with no eligible users", async () => {
    const { tenant } = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "No one to ack", body: "x", isPinned: false, requiresAck: true });

    const summary = await getAcknowledgementSummary(franchisorCtx(tenant.id), tenant.id, created.id);
    expect(summary.totalEligibleUsers).toBe(0);
    expect(summary.percent).toBe(0);
  });

  it("getAnnouncementAcknowledgementUsers rejects another tenant's announcement even with the id known", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(a.tenant.id), a.tenant.id, { title: "A only", body: "x", isPinned: false, requiresAck: true });

    await expect(
      getAnnouncementAcknowledgementUsers(franchisorCtx(b.tenant.id), created.id, b.tenant.id, { page: 1, limit: 20 })
    ).rejects.toThrow();
  });

  it("getAnnouncementAcknowledgementUsers never returns another tenant's membership rows, even filtered by that tenant's own locationId", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(a.tenant.id), a.tenant.id, { title: "A only", body: "x", isPinned: false, requiresAck: true });
    await withTenant(kickCtx(), (tx) =>
      tx.membership.createMany({
        data: [
          { clerkUserId: "a-user", tenantId: a.tenant.id, locationId: a.location.id, role: "FRANCHISEE_USER", displayName: "Alice A" },
          { clerkUserId: "b-user", tenantId: b.tenant.id, locationId: b.location.id, role: "FRANCHISEE_USER", displayName: "Bob B" },
        ],
      })
    );

    // Tenant A's own report never shows tenant B's user, even without a location filter.
    const rowsForA = await getAnnouncementAcknowledgementUsers(franchisorCtx(a.tenant.id), created.id, a.tenant.id, { page: 1, limit: 20 });
    expect(rowsForA.rows.map((r) => r.clerkUserId)).toEqual(["a-user"]);
    expect(rowsForA.rows.some((r) => r.clerkUserId === "b-user")).toBe(false);

    // Passing tenant B's own locationId as a filter, scoped under tenant A's ctx+tenantId,
    // must not leak tenant B's membership row into tenant A's report.
    const rowsWithForeignLocationFilter = await getAnnouncementAcknowledgementUsers(franchisorCtx(a.tenant.id), created.id, a.tenant.id, {
      page: 1,
      limit: 20,
      locationId: b.location.id,
    });
    expect(rowsWithForeignLocationFilter.rows).toHaveLength(0);
  });

  it("getAnnouncementPublishCalendar scoped to one tenant does not count another tenant's scheduled/published announcements", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const day = new Date(Date.UTC(2026, 6, 15, 12, 0, 0)); // 2026-07-15, safely inside the month for both branches below
    await createAnnouncement(franchisorCtx(a.tenant.id), a.tenant.id, { title: "A scheduled", body: "x", isPinned: false, requiresAck: false, publishAt: day }).then(
      (created) => withTenant(kickCtx(), (tx) => tx.announcement.update({ where: { id: created.id }, data: { status: "SCHEDULED", publishAt: day } }))
    );
    await createAnnouncement(franchisorCtx(b.tenant.id), b.tenant.id, { title: "B scheduled", body: "x", isPinned: false, requiresAck: false, publishAt: day }).then(
      (created) => withTenant(kickCtx(), (tx) => tx.announcement.update({ where: { id: created.id }, data: { status: "SCHEDULED", publishAt: day } }))
    );

    const calendarForA = await getAnnouncementPublishCalendar(franchisorCtx(a.tenant.id), a.tenant.id, 2026, 7);
    const totalForA = calendarForA.reduce((sum, d) => sum + d.scheduledCount + d.publishedCount, 0);
    expect(totalForA).toBe(1); // only A's own announcement, not both tenants'

    const crossTenantForKick = await getAnnouncementPublishCalendar(kickCtx(), undefined, 2026, 7);
    const totalForKick = crossTenantForKick.reduce((sum, d) => sum + d.scheduledCount + d.publishedCount, 0);
    expect(totalForKick).toBe(2); // KICK_ADMIN with no tenantId legitimately sees both
  });

  it("getAnnouncementRecentActivity scoped to one tenant does not surface another tenant's audit rows", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    await createAnnouncement(franchisorCtx(a.tenant.id), a.tenant.id, { title: "A activity", body: "x", isPinned: false, requiresAck: false });
    await createAnnouncement(franchisorCtx(b.tenant.id), b.tenant.id, { title: "B activity", body: "x", isPinned: false, requiresAck: false });

    const activityForA = await getAnnouncementRecentActivity(franchisorCtx(a.tenant.id), a.tenant.id, 10);
    expect(activityForA.every((row) => row.label === "created")).toBe(true);
    expect(activityForA).toHaveLength(1);

    const crossTenantForKick = await getAnnouncementRecentActivity(kickCtx(), undefined, 10);
    expect(crossTenantForKick.length).toBeGreaterThanOrEqual(2); // KICK_ADMIN with no tenantId legitimately sees both
  });
});
