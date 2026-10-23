-- AlterTable
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "disabledAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "disabledReason" TEXT;

-- AlterTable
ALTER TABLE "ChatServer" ADD COLUMN "autoJoinNewUsers" BOOLEAN NOT NULL DEFAULT false;
