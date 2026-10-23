-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "requireAck" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AnnouncementAck" (
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ackedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("announcementId", "userId"),
    CONSTRAINT "AnnouncementAck_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementAck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AnnouncementAck_userId_idx" ON "AnnouncementAck"("userId");
