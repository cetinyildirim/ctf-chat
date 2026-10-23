-- AlterTable
ALTER TABLE "User" ADD COLUMN "banReason" TEXT;
ALTER TABLE "User" ADD COLUMN "bannedUntil" DATETIME;
ALTER TABLE "User" ADD COLUMN "muteReason" TEXT;
