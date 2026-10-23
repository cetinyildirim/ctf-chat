-- AlterTable
ALTER TABLE "ChannelDmParticipant" ADD COLUMN "lastReadAt" DATETIME;

-- Existing DM history should not suddenly appear unread.
UPDATE "ChannelDmParticipant" SET "lastReadAt" = CURRENT_TIMESTAMP;
