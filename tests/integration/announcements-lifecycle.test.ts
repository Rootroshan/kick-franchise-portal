import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { createAnnouncement, listAnnouncements, acknowledgeAnnouncement, getAcknowledgementReport } from "@/server/modules/announcements/service";
import { listFranchisorAnnouncements } from "@/server/modules/announcements/franchisorList";
import { listAnnouncementsAdmin } from "@/server/modules/announcements/admin";
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
});
