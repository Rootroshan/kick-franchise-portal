import { describe, it, expect, beforeEach, vi } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchisorCtx, franchiseeCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";

// Isolate DB/audit/RLS behavior from real R2 network calls — storage.ts is
// exercised for real in the R2 upload/download smoke tests, not here.
vi.mock("@/server/lib/storage", () => ({
  assertValidUpload: () => {},
  storageObjectExists: async () => true,
  createPresignedUploadUrl: async (key: string) => `https://mock-r2.test/${key}`,
  createPresignedDownloadUrl: async (key: string, ttlSeconds = 300) => `https://mock-r2.test/${key}?ttl=${Math.min(ttlSeconds, 300)}`,
  deleteStorageObject: async () => {},
  uploadObjectDirect: async () => {},
}));

const { createAsset, uploadAsset, listAssets, setAssetStatus, getAssetDownloadUrl, updateAssetMetadata, getAssetVersionHistory } = await import(
  "@/server/modules/assets/service"
);
const { listAssetsAdmin, getAssetKpis } = await import("@/server/modules/assets/admin");
const { listFranchisorAssets } = await import("@/server/modules/assets/franchisorList");
const { parseListQuery } = await import("@/lib/adminQuery");

const emptyQuery = parseListQuery({});

function upload(overrides: Partial<Parameters<typeof createAsset>[2]> = {}) {
  return {
    name: "Test Logo",
    type: "logo",
    category: "Logo",
    mime: "image/png",
    sizeBytes: 1024,
    storageKey: `tenants/x/assets/${crypto.randomUUID()}`,
    ...overrides,
  };
}

describe("Assets: upload, versioning, lifecycle, tenant isolation", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("uploads a new asset as ACTIVE and writes an audit log", async () => {
    const { tenant } = await seedTenantWithLocation();
    const asset = await createAsset(kickCtx(), tenant.id, upload());
    expect(asset.status).toBe("ACTIVE");
    expect(asset.version).toBe(1);

    const logs = await withTenant(kickCtx(), (tx) => tx.auditLog.findMany({ where: { entity: "Asset", entityId: asset.id } }));
    expect(logs.some((l) => l.action === "asset.upload")).toBe(true);
  });

  function directUploadMeta(overrides: Partial<Parameters<typeof uploadAsset>[3]> = {}) {
    return { name: "Test Logo", type: "logo", category: "Logo", mime: "image/png", sizeBytes: 1024, ...overrides };
  }

  it("uploadAsset (server-relayed upload) creates an ACTIVE asset without a client-supplied storageKey", async () => {
    const { tenant } = await seedTenantWithLocation();
    const file = Buffer.from("fake-file-bytes");
    const asset = await uploadAsset(kickCtx(), tenant.id, file, directUploadMeta({ sizeBytes: file.byteLength }));
    expect(asset.status).toBe("ACTIVE");
    expect(asset.storageKey).toContain(`tenants/${tenant.id}/assets/`);

    const logs = await withTenant(kickCtx(), (tx) => tx.auditLog.findMany({ where: { entity: "Asset", entityId: asset.id } }));
    expect(logs.some((l) => l.action === "asset.upload")).toBe(true);
  });

  it("uploadAsset rejects a file whose byte length does not match the declared sizeBytes", async () => {
    const { tenant } = await seedTenantWithLocation();
    const file = Buffer.from("short");
    await expect(uploadAsset(kickCtx(), tenant.id, file, directUploadMeta({ sizeBytes: 99999 }))).rejects.toThrow(/size/i);
  });

  it("creates an archived asset when publishActive is false", async () => {
    const { tenant } = await seedTenantWithLocation();
    const asset = await createAsset(kickCtx(), tenant.id, upload({ publishActive: false }));
    expect(asset.status).toBe("ARCHIVED");
  });

  it("replacing an asset increments version, archives the previous row, and links replacesId", async () => {
    const { tenant } = await seedTenantWithLocation();
    const v1 = await createAsset(kickCtx(), tenant.id, upload());
    const v2 = await createAsset(kickCtx(), tenant.id, upload({ replacesId: v1.id }));

    expect(v2.version).toBe(2);
    expect(v2.replacesId).toBe(v1.id);

    const reloadedV1 = await withTenant(kickCtx(), (tx) => tx.asset.findUnique({ where: { id: v1.id } }));
    expect(reloadedV1?.status).toBe("ARCHIVED");
  });

  it("rejects replacing an asset that belongs to another tenant", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const v1 = await createAsset(kickCtx(), a.tenant.id, upload());

    await expect(createAsset(kickCtx(), b.tenant.id, upload({ replacesId: v1.id }))).rejects.toThrow();
  });

  it("archive → deprecate → restore each write a statusChange audit row", async () => {
    const { tenant } = await seedTenantWithLocation();
    const asset = await createAsset(kickCtx(), tenant.id, upload());

    await setAssetStatus(kickCtx(), asset.id, "ARCHIVED");
    await setAssetStatus(kickCtx(), asset.id, "DEPRECATED");
    await setAssetStatus(kickCtx(), asset.id, "ACTIVE");

    const logs = await withTenant(kickCtx(), (tx) =>
      tx.auditLog.findMany({ where: { entity: "Asset", entityId: asset.id, action: "asset.statusChange" } })
    );
    expect(logs).toHaveLength(3);

    const final = await withTenant(kickCtx(), (tx) => tx.asset.findUnique({ where: { id: asset.id } }));
    expect(final?.status).toBe("ACTIVE");
  });

  it("franchisee sees only ACTIVE assets — ARCHIVED and DEPRECATED are hidden", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const active = await createAsset(kickCtx(), tenant.id, upload({ name: "Active One" }));
    const archived = await createAsset(kickCtx(), tenant.id, upload({ name: "Archived One" }));
    await setAssetStatus(kickCtx(), archived.id, "ARCHIVED");
    const deprecated = await createAsset(kickCtx(), tenant.id, upload({ name: "Deprecated One" }));
    await setAssetStatus(kickCtx(), deprecated.id, "DEPRECATED");

    const feed = await listAssets(franchiseeCtx(tenant.id, location.id), tenant.id, {});
    const ids = feed.map((a) => a.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(archived.id);
    expect(ids).not.toContain(deprecated.id);
  });

  it("franchisor cannot upload, archive, or download another tenant's asset", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const asset = await createAsset(kickCtx(), a.tenant.id, upload());

    await expect(createAsset(franchisorCtx(b.tenant.id), b.tenant.id, upload({ replacesId: asset.id }))).rejects.toThrow();

    // A franchisor's own-tenant listing never surfaces another tenant's asset.
    const bList = await listFranchisorAssets(franchisorCtx(b.tenant.id), b.tenant.id, emptyQuery);
    expect(bList.rows.find((r) => r.id === asset.id)).toBeUndefined();
  });

  it("KICK_ADMIN sees assets across tenants", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    await createAsset(kickCtx(), a.tenant.id, upload({ name: "Brand A Asset" }));
    await createAsset(kickCtx(), b.tenant.id, upload({ name: "Brand B Asset" }));

    const adminList = await listAssetsAdmin(kickCtx(), emptyQuery);
    const names = adminList.rows.map((r) => r.name);
    expect(names).toContain("Brand A Asset");
    expect(names).toContain("Brand B Asset");
  });

  it("franchisee is blocked from downloading a non-ACTIVE asset, and the signed URL TTL is capped at 300s", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const asset = await createAsset(kickCtx(), tenant.id, upload());
    await setAssetStatus(kickCtx(), asset.id, "ARCHIVED");

    await expect(getAssetDownloadUrl(franchiseeCtx(tenant.id, location.id), asset.id)).rejects.toThrow();

    const activeAsset = await createAsset(kickCtx(), tenant.id, upload({ name: "Downloadable" }));
    const url = await getAssetDownloadUrl(franchiseeCtx(tenant.id, location.id), activeAsset.id);
    expect(url).toContain("ttl=300");
  });

  it("updating metadata writes an audit row and is tenant-scoped for a franchisor", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const asset = await createAsset(kickCtx(), a.tenant.id, upload());

    await expect(updateAssetMetadata(franchisorCtx(b.tenant.id), asset.id, { name: "Hijacked" })).rejects.toThrow();

    const updated = await updateAssetMetadata(franchisorCtx(a.tenant.id), asset.id, { name: "Renamed" });
    expect(updated.name).toBe("Renamed");

    const logs = await withTenant(kickCtx(), (tx) =>
      tx.auditLog.findMany({ where: { entity: "Asset", entityId: asset.id, action: "asset.metadataUpdate" } })
    );
    expect(logs).toHaveLength(1);
  });

  it("version history returns the full chain, oldest first, with isCurrent on the latest", async () => {
    const { tenant } = await seedTenantWithLocation();
    const v1 = await createAsset(kickCtx(), tenant.id, upload());
    const v2 = await createAsset(kickCtx(), tenant.id, upload({ replacesId: v1.id }));
    const v3 = await createAsset(kickCtx(), tenant.id, upload({ replacesId: v2.id }));

    const history = await getAssetVersionHistory(kickCtx(), v3.id);
    expect(history.map((h) => h.version)).toEqual([1, 2, 3]);
    expect(history.find((h) => h.id === v3.id)?.isCurrent).toBe(true);
    expect(history.find((h) => h.id === v1.id)?.isCurrent).toBe(false);

    // Looking up from an older version in the chain returns the same full chain.
    const historyFromV1 = await getAssetVersionHistory(kickCtx(), v1.id);
    expect(historyFromV1.map((h) => h.id)).toEqual(history.map((h) => h.id));
  });

  it("franchisor cannot read another tenant's version history but can read their own", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const asset = await createAsset(kickCtx(), a.tenant.id, upload());

    await expect(getAssetVersionHistory(franchisorCtx(b.tenant.id), asset.id)).rejects.toThrow();

    const own = await getAssetVersionHistory(franchisorCtx(a.tenant.id), asset.id);
    expect(own.map((h) => h.id)).toEqual([asset.id]);
  });

  it("franchisor cannot change the status of another tenant's asset", async () => {
    const a = await seedTenantWithLocation();
    const b = await seedTenantWithLocation();
    const asset = await createAsset(kickCtx(), a.tenant.id, upload());

    await expect(setAssetStatus(franchisorCtx(b.tenant.id), asset.id, "ARCHIVED")).rejects.toThrow();

    const reloaded = await withTenant(kickCtx(), (tx) => tx.asset.findUnique({ where: { id: asset.id } }));
    expect(reloaded?.status).toBe("ACTIVE");
  });

  it("a successful download writes an asset.download audit row that feeds the Downloads KPI", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const asset = await createAsset(kickCtx(), tenant.id, upload());

    await getAssetDownloadUrl(franchiseeCtx(tenant.id, location.id), asset.id);
    await getAssetDownloadUrl(franchisorCtx(tenant.id), asset.id);

    const logs = await withTenant(kickCtx(), (tx) =>
      tx.auditLog.findMany({ where: { entity: "Asset", entityId: asset.id, action: "asset.download" } })
    );
    expect(logs).toHaveLength(2);

    const kpis = await getAssetKpis(kickCtx());
    expect(kpis.totalDownloads).toBe(2);
  });
});
