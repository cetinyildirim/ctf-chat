-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TEAM_MEMBER',
    "platformRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "avatarUrl" TEXT,
    "bio" TEXT,
    "lastSeenAt" DATETIME,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil" DATETIME,
    "mutedSince" DATETIME,
    "preferredLocale" TEXT NOT NULL DEFAULT 'tr',
    "preferredTheme" TEXT NOT NULL DEFAULT 'dark',
    "notifyDefault" TEXT NOT NULL DEFAULT 'ALL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "contextType" TEXT,
    "contextId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserReport_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "color" TEXT NOT NULL DEFAULT '#22d3ee',
    "logoUrl" TEXT,
    "inviteCode" TEXT NOT NULL,
    "ctfdTeamId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "captainId" TEXT,
    CONSTRAINT "Team_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerTeamMember" (
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "serverId"),
    CONSTRAINT "ServerTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerTeamMember_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChannelDmParticipant" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("channelId", "userId"),
    CONSTRAINT "ChannelDmParticipant_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelDmParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserChannelPreference" (
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "notifyMode" TEXT NOT NULL DEFAULT 'DEFAULT',

    PRIMARY KEY ("userId", "channelId"),
    CONSTRAINT "UserChannelPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserChannelPreference_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatServer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "bannerUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "themePrimary" TEXT,
    "themeAccent" TEXT,
    "emailNotifyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "requirePasswordChangeOnJoin" BOOLEAN NOT NULL DEFAULT false,
    "emailReplyTo" TEXT,
    "ctfdBaseUrl" TEXT,
    "ctfdAccessToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServerRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#a78bfa',
    "position" INTEGER NOT NULL DEFAULT 0,
    "hoist" BOOLEAN NOT NULL DEFAULT false,
    "permissionsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServerRole_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemberServerRole" (
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "MemberServerRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberServerRole_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberServerRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ServerRole" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerWebhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "eventsJson" TEXT NOT NULL DEFAULT '["announcement.publish"]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerWebhook_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerMember" (
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "nickname" TEXT,
    "avatarUrl" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" DATETIME,
    "bannedById" TEXT,
    "banReason" TEXT,

    PRIMARY KEY ("userId", "serverId"),
    CONSTRAINT "ServerMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerMember_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerMember_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "channelId" TEXT,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerInvite_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerInvite_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerInvite_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserServerPreference" (
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "notifyMode" TEXT NOT NULL DEFAULT 'DEFAULT',

    PRIMARY KEY ("userId", "serverId"),
    CONSTRAINT "UserServerPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserServerPreference_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "staffOnly" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "serverId" TEXT,
    "teamId" TEXT,
    CONSTRAINT "Category_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Category_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topic" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GLOBAL_CHAT',
    "iconKey" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "categoryId" TEXT,
    "serverId" TEXT,
    "challengeId" TEXT,
    "logoUrl" TEXT,
    "teamId" TEXT,
    CONSTRAINT "Channel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Channel_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Channel_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Channel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentionsJson" TEXT NOT NULL DEFAULT '[]',
    "replyToId" TEXT,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT,
    "ticketEventId" TEXT,
    "uploadedById" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_ticketEventId_fkey" FOREIGN KEY ("ticketEventId") REFERENCES "TicketEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "pinnedById" TEXT NOT NULL,
    "pinnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pin_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pin_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pin_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 100,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "isReleased" BOOLEAN NOT NULL DEFAULT true,
    "flag" TEXT NOT NULL,
    "authorId" TEXT,
    "firstBloodTeamId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Challenge_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Challenge_firstBloodTeamId_fkey" FOREIGN KEY ("firstBloodTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Hint_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HintUnlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hintId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HintUnlock_hintId_fkey" FOREIGN KEY ("hintId") REFERENCES "Hint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HintUnlock_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HintUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Solve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstBlood" BOOLEAN NOT NULL DEFAULT false,
    "solvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Solve_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Solve_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Solve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "serverId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "priorityRank" INTEGER NOT NULL DEFAULT 1,
    "categoryId" TEXT,
    "openedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "teamId" TEXT,
    "challengeId" TEXT,
    "channelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    "firstResponseAt" DATETIME,
    "lastCompetitorReplyAt" DATETIME,
    "lastOrganizerReplyAt" DATETIME,
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Ticket_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresChallenge" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketCategory_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#a78bfa',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tag_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketTag" (
    "ticketId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("ticketId", "tagId"),
    CONSTRAINT "TicketTag_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "relatedTicketId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketRelation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketRelation_relatedTicketId_fkey" FOREIGN KEY ("relatedTicketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketRelation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketRead" (
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("ticketId", "userId"),
    CONSTRAINT "TicketRead_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "serverId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "href" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetitionSettings" (
    "serverId" TEXT NOT NULL PRIMARY KEY,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "ticketPrefix" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "ticketPolicy" TEXT NOT NULL DEFAULT 'OPEN',
    "archivedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompetitionSettings_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "serverId" TEXT,
    "channelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Incident_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Incident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Incident_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Incident_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "authorId" TEXT NOT NULL,
    "serverId" TEXT,
    "channelId" TEXT,
    "scheduledFor" DATETIME,
    "publishedAt" DATETIME,
    "expiresAt" DATETIME,
    "sourceTicketId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Announcement_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ChatServer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Announcement_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "uploadMaxMb" INTEGER NOT NULL DEFAULT 100,
    "platformTitle" TEXT NOT NULL DEFAULT 'SYDT',
    "platformTagline" TEXT NOT NULL DEFAULT 'CTF Operations Console',
    "workspaceLabel" TEXT NOT NULL DEFAULT 'Komuta',
    "workspaceTitle" TEXT NOT NULL DEFAULT 'SYDT Chat',
    "defaultRegistrationServerId" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminBroadcast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminBroadcast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requireBeforeContinue" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Survey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SINGLE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SurveyOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveyResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "textValue" TEXT,
    CONSTRAINT "SurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveyAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "SurveyOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "authorId" TEXT,
    CONSTRAINT "PlatformPage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_mutedUntil_idx" ON "User"("mutedUntil");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE INDEX "UserReport_status_idx" ON "UserReport"("status");

-- CreateIndex
CREATE INDEX "UserReport_createdAt_idx" ON "UserReport"("createdAt");

-- CreateIndex
CREATE INDEX "UserReport_reportedId_idx" ON "UserReport"("reportedId");

-- CreateIndex
CREATE INDEX "UserReport_reporterId_idx" ON "UserReport"("reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_captainId_key" ON "Team"("captainId");

-- CreateIndex
CREATE INDEX "Team_serverId_idx" ON "Team"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_serverId_slug_key" ON "Team"("serverId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Team_serverId_inviteCode_key" ON "Team"("serverId", "inviteCode");

-- CreateIndex
CREATE INDEX "ServerTeamMember_teamId_idx" ON "ServerTeamMember"("teamId");

-- CreateIndex
CREATE INDEX "ServerTeamMember_serverId_idx" ON "ServerTeamMember"("serverId");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "ChannelDmParticipant_userId_idx" ON "ChannelDmParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatServer_slug_key" ON "ChatServer"("slug");

-- CreateIndex
CREATE INDEX "ChatServer_position_idx" ON "ChatServer"("position");

-- CreateIndex
CREATE INDEX "ServerRole_serverId_position_idx" ON "ServerRole"("serverId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ServerRole_serverId_name_key" ON "ServerRole"("serverId", "name");

-- CreateIndex
CREATE INDEX "MemberServerRole_serverId_userId_idx" ON "MemberServerRole"("serverId", "userId");

-- CreateIndex
CREATE INDEX "MemberServerRole_roleId_idx" ON "MemberServerRole"("roleId");

-- CreateIndex
CREATE INDEX "ServerWebhook_serverId_idx" ON "ServerWebhook"("serverId");

-- CreateIndex
CREATE INDEX "ServerMember_serverId_idx" ON "ServerMember"("serverId");

-- CreateIndex
CREATE INDEX "ServerMember_serverId_bannedAt_idx" ON "ServerMember"("serverId", "bannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServerInvite_code_key" ON "ServerInvite"("code");

-- CreateIndex
CREATE INDEX "ServerInvite_serverId_idx" ON "ServerInvite"("serverId");

-- CreateIndex
CREATE INDEX "ServerInvite_creatorId_idx" ON "ServerInvite"("creatorId");

-- CreateIndex
CREATE INDEX "Category_position_idx" ON "Category"("position");

-- CreateIndex
CREATE INDEX "Category_serverId_position_idx" ON "Category"("serverId", "position");

-- CreateIndex
CREATE INDEX "Category_teamId_idx" ON "Category"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_serverId_teamId_key" ON "Category"("serverId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_slug_key" ON "Channel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_challengeId_key" ON "Channel"("challengeId");

-- CreateIndex
CREATE INDEX "Channel_categoryId_position_idx" ON "Channel"("categoryId", "position");

-- CreateIndex
CREATE INDEX "Channel_type_idx" ON "Channel"("type");

-- CreateIndex
CREATE INDEX "Channel_serverId_position_idx" ON "Channel"("serverId", "position");

-- CreateIndex
CREATE INDEX "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_authorId_idx" ON "Message"("authorId");

-- CreateIndex
CREATE INDEX "Reaction_messageId_idx" ON "Reaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_messageId_userId_emoji_key" ON "Reaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "Attachment_ticketEventId_idx" ON "Attachment"("ticketEventId");

-- CreateIndex
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Pin_messageId_key" ON "Pin"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_slug_key" ON "Challenge"("slug");

-- CreateIndex
CREATE INDEX "Challenge_category_idx" ON "Challenge"("category");

-- CreateIndex
CREATE INDEX "Challenge_difficulty_idx" ON "Challenge"("difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "Hint_challengeId_order_key" ON "Hint"("challengeId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "HintUnlock_hintId_teamId_key" ON "HintUnlock"("hintId", "teamId");

-- CreateIndex
CREATE INDEX "Solve_teamId_idx" ON "Solve"("teamId");

-- CreateIndex
CREATE INDEX "Solve_solvedAt_idx" ON "Solve"("solvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Solve_challengeId_teamId_key" ON "Solve"("challengeId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_teamId_idx" ON "Ticket"("teamId");

-- CreateIndex
CREATE INDEX "Ticket_serverId_status_updatedAt_idx" ON "Ticket"("serverId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Ticket_serverId_teamId_updatedAt_idx" ON "Ticket"("serverId", "teamId", "updatedAt");

-- CreateIndex
CREATE INDEX "Ticket_serverId_priorityRank_updatedAt_idx" ON "Ticket"("serverId", "priorityRank", "updatedAt");

-- CreateIndex
CREATE INDEX "Ticket_serverId_challengeId_idx" ON "Ticket"("serverId", "challengeId");

-- CreateIndex
CREATE INDEX "Ticket_serverId_assignedToId_idx" ON "Ticket"("serverId", "assignedToId");

-- CreateIndex
CREATE INDEX "Ticket_serverId_categoryId_idx" ON "Ticket"("serverId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_serverId_seq_key" ON "Ticket"("serverId", "seq");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketCategory_serverId_position_idx" ON "TicketCategory"("serverId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TicketCategory_serverId_key_key" ON "TicketCategory"("serverId", "key");

-- CreateIndex
CREATE INDEX "Tag_serverId_idx" ON "Tag"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_serverId_name_key" ON "Tag"("serverId", "name");

-- CreateIndex
CREATE INDEX "TicketTag_tagId_idx" ON "TicketTag"("tagId");

-- CreateIndex
CREATE INDEX "TicketRelation_relatedTicketId_idx" ON "TicketRelation"("relatedTicketId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketRelation_ticketId_relatedTicketId_kind_key" ON "TicketRelation"("ticketId", "relatedTicketId", "kind");

-- CreateIndex
CREATE INDEX "TicketRead_userId_idx" ON "TicketRead"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_refType_refId_idx" ON "Notification"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionSettings_ticketPrefix_key" ON "CompetitionSettings"("ticketPrefix");

-- CreateIndex
CREATE INDEX "CompetitionSettings_status_idx" ON "CompetitionSettings"("status");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Incident_serverId_createdAt_idx" ON "Incident"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

-- CreateIndex
CREATE INDEX "Announcement_serverId_publishedAt_idx" ON "Announcement"("serverId", "publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_scheduledFor_idx" ON "Announcement"("scheduledFor");

-- CreateIndex
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminBroadcast_createdAt_idx" ON "AdminBroadcast"("createdAt");

-- CreateIndex
CREATE INDEX "AdminBroadcast_kind_idx" ON "AdminBroadcast"("kind");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_target_idx" ON "AuditLog"("target");

-- CreateIndex
CREATE INDEX "SurveyQuestion_surveyId_position_idx" ON "SurveyQuestion"("surveyId", "position");

-- CreateIndex
CREATE INDEX "SurveyOption_questionId_position_idx" ON "SurveyOption"("questionId", "position");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_surveyId_userId_key" ON "SurveyResponse"("surveyId", "userId");

-- CreateIndex
CREATE INDEX "SurveyAnswer_responseId_idx" ON "SurveyAnswer"("responseId");

-- CreateIndex
CREATE INDEX "SurveyAnswer_questionId_idx" ON "SurveyAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPage_slug_key" ON "PlatformPage"("slug");

-- CreateIndex
CREATE INDEX "PlatformPage_published_idx" ON "PlatformPage"("published");

