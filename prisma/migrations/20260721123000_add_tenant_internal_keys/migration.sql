-- Preserve the historical slug for compatibility, while making its replacement
-- explicit and ensuring retried brand-provisioning requests cannot duplicate a tenant.
ALTER TABLE "Tenant" ADD COLUMN "internalKey" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "idempotencyKey" TEXT;

UPDATE "Tenant" SET "internalKey" = "slug" WHERE "internalKey" IS NULL;

CREATE UNIQUE INDEX "Tenant_internalKey_key" ON "Tenant"("internalKey");
CREATE UNIQUE INDEX "Tenant_idempotencyKey_key" ON "Tenant"("idempotencyKey");
