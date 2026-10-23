-- CreateTable
CREATE TABLE "BackupConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "hour" INTEGER NOT NULL DEFAULT 3,
    "weekday" INTEGER NOT NULL DEFAULT 0,
    "retention" INTEGER NOT NULL DEFAULT 7,
    "includeUploads" BOOLEAN NOT NULL DEFAULT true,
    "lastAutoRunAt" DATETIME,
    "lastRunAt" DATETIME,
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastDurationMs" INTEGER,
    "lastSizeBytes" BIGINT,
    "updatedAt" DATETIME NOT NULL
);

