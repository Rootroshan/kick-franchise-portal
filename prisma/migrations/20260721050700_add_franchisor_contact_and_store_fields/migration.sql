-- CreateEnum
CREATE TYPE "StoreRole" AS ENUM ('MANAGER', 'USER');

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressCountry" TEXT,
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressPostalCode" TEXT,
ADD COLUMN     "addressState" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "managerEmail" TEXT,
ADD COLUMN     "managerName" TEXT,
ADD COLUMN     "managerPhone" TEXT,
ADD COLUMN     "storeCode" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "storeRole" "StoreRole";

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressCountry" TEXT,
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressPostalCode" TEXT,
ADD COLUMN     "addressState" TEXT,
ADD COLUMN     "contactName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Location_tenantId_storeCode_key" ON "Location"("tenantId", "storeCode");

