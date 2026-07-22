-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "notificationPrefs" JSONB NOT NULL DEFAULT '{}';
