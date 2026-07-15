-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "clerkOrgId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_clerkOrgId_key" ON "Tenant"("clerkOrgId");
