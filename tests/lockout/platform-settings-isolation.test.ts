import { describe, it, expect, beforeEach } from "vitest";
import { withTenant } from "@/server/db/withTenant";
import { kickCtx, franchiseeCtx, franchisorCtx, resetDatabase, seedTenantWithLocation } from "../helpers/db";
import { encryptSecret, decryptSecret } from "@/server/lib/secretBox";

/**
 * PlatformSetting holds live payment/storage credentials. RLS restricts it to
 * KICK_ADMIN, so a bug that leaked a query into a tenant-scoped request path
 * still returns zero rows rather than a Stripe key. These tests pin that down
 * at the database level — not just the app guard.
 */
describe("PlatformSetting is KICK_ADMIN-only", () => {
  beforeEach(async () => {
    await resetDatabase();
    await withTenant(kickCtx(), (tx) =>
      tx.platformSetting.create({
        data: {
          key: "STRIPE_SECRET_KEY",
          valueEnc: encryptSecret("sk_test_super_secret_value"),
          lastFour: "alue",
          updatedBy: "kick-admin",
        },
      })
    );
  });

  it("a franchisee cannot read platform credentials", async () => {
    const { tenant, location } = await seedTenantWithLocation();
    const rows = await withTenant(franchiseeCtx(tenant.id, location.id, "user-a"), (tx) =>
      tx.platformSetting.findMany()
    );
    expect(rows).toHaveLength(0);
  });

  it("a franchisor cannot read platform credentials", async () => {
    const { tenant } = await seedTenantWithLocation();
    const rows = await withTenant(franchisorCtx(tenant.id), (tx) => tx.platformSetting.findMany());
    expect(rows).toHaveLength(0);
  });

  it("a franchisor cannot write a platform credential", async () => {
    const { tenant } = await seedTenantWithLocation();
    await expect(
      withTenant(franchisorCtx(tenant.id), (tx) =>
        tx.platformSetting.create({
          data: { key: "R2_SECRET_ACCESS_KEY", valueEnc: encryptSecret("attacker"), updatedBy: "attacker" },
        })
      )
    ).rejects.toThrow();
  });

  it("KICK_ADMIN can read it back and the value decrypts", async () => {
    const rows = await withTenant(kickCtx(), (tx) => tx.platformSetting.findMany());
    expect(rows).toHaveLength(1);
    expect(decryptSecret(rows[0]!.valueEnc)).toBe("sk_test_super_secret_value");
  });

  it("the stored column is ciphertext, not the plaintext key", async () => {
    const rows = await withTenant(kickCtx(), (tx) => tx.platformSetting.findMany());
    expect(rows[0]!.valueEnc).not.toContain("sk_test_super_secret_value");
  });
});
