import { describe, it, expect, beforeEach } from "vitest";
import { franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { createAnnouncement } from "@/server/modules/announcements/service";
import { getFranchisorAnnouncement, listFranchisorAnnouncements } from "@/server/modules/announcements/franchisorList";
import { createTask } from "@/server/modules/tasks/service";
import { getFranchisorTask } from "@/server/modules/tasks/franchisorList";
import { createOnboardingTemplate } from "@/server/modules/onboarding/service";
import { getTemplateDetail } from "@/server/modules/onboarding/franchisorList";
import { getSettings, updateBrand } from "@/server/modules/franchisor-settings/service";
import { parseListQuery } from "@/lib/adminQuery";

const emptyQuery = parseListQuery({});

describe("Franchisor CRUD (tenant-scoped, live DB)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates an announcement and reads it back scoped to the tenant", async () => {
    const { tenant } = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(tenant.id), tenant.id, { title: "Hello stores", body: "Body", isPinned: false, requiresAck: true });
    const detail = await getFranchisorAnnouncement(franchisorCtx(tenant.id), tenant.id, created.id);
    expect(detail.title).toBe("Hello stores");
    expect(detail.requiresAck).toBe(true);

    const list = await listFranchisorAnnouncements(franchisorCtx(tenant.id), tenant.id, emptyQuery);
    expect(list.rows.some((r) => r.id === created.id)).toBe(true);
  });

  it("another tenant cannot read the announcement", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const created = await createAnnouncement(franchisorCtx(a.tenant.id), a.tenant.id, { title: "A only", body: "x", isPinned: false, requiresAck: false });
    await expect(getFranchisorAnnouncement(franchisorCtx(b.tenant.id), b.tenant.id, created.id)).rejects.toThrow();
  });

  it("creates a task with one assignment per store", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const task = await createTask(franchisorCtx(tenant.id), tenant.id, { title: "Clean", details: null, dueAt: null, locationIds: [location.id] });
    const detail = await getFranchisorTask(franchisorCtx(tenant.id), tenant.id, task.id);
    expect(detail.assignments).toHaveLength(1);
    expect(detail.assignments[0]!.storeName).toBe(location.name);
  });

  it("creates an onboarding template with ordered steps", async () => {
    const { tenant } = await seedTenantWithLocation();
    const tpl = await createOnboardingTemplate(franchisorCtx(tenant.id), tenant.id, { name: "Setup", items: [{ title: "Step A" }, { title: "Step B" }] });
    const detail = await getTemplateDetail(franchisorCtx(tenant.id), tenant.id, tpl.id);
    expect(detail.steps.map((s) => s.title)).toEqual(["Step A", "Step B"]);
  });

  it("exposes brand settings read-only; RLS blocks a franchisor Tenant write", async () => {
    const { tenant } = await seedTenantWithLocation();
    // getSettings is permitted (read).
    const settings = await getSettings(franchisorCtx(tenant.id), tenant.id);
    expect(settings.brand.displayName).toBe("Test Brand");
    // Writing the Tenant row as a franchisor is blocked by RLS (WITH CHECK
    // KICK_ADMIN only) — proving §16 "cannot modify Kick-controlled settings".
    await expect(updateBrand(franchisorCtx(tenant.id), tenant.id, { displayName: "X", contactEmail: "a@b.com", contactPhone: "555", timezone: "UTC" })).rejects.toThrow();
  });
});
