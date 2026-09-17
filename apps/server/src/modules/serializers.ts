import type {
  Announcement,
  Channel,
  Challenge,
  ChallengeHint,
  CompetitionSettingsDto,
  Incident,
  Message,
  NotificationDto,
  PublicUser,
  ScoreboardEntry,
  Team,
  Ticket,
  TicketCategoryDto,
  TicketEvent,
  TicketTagDto,
} from '@sydt/shared';
import { type Role } from '@sydt/shared';

type AnyRecord = Record<string, unknown>;

export function serializeUser(user: AnyRecord & { team?: AnyRecord | null }): PublicUser {
  return {
    id: user.id as string,
    username: user.username as string,
    displayName: user.displayName as string,
    avatarUrl: (user.avatarUrl as string | null) ?? null,
    bio: ((user.bio as string | null) ?? '').trim() || null,
    role: user.role as Role,
    status: (user.status as PublicUser['status']) ?? 'OFFLINE',
    team: user.team
      ? {
          id: user.team.id as string,
          name: user.team.name as string,
          color: (user.team.color as string) ?? '#22d3ee',
          logoUrl: (user.team.logoUrl as string | null) ?? null,
        }
      : null,
  };
}

export function serializeTeam(team: AnyRecord, extras: {
  memberCount?: number;
  score?: number;
  rank?: number;
  solveCount?: number;
  bloodCount?: number;
} = {}): Team {
  return {
    id: team.id as string,
    serverId: (team.serverId as string | undefined) ?? undefined,
    slug: team.slug as string,
    name: team.name as string,
    tagline: (team.tagline as string | null) ?? null,
    color: (team.color as string) ?? '#22d3ee',
    logoUrl: (team.logoUrl as string | null) ?? null,
    captainId: (team.captainId as string | null) ?? null,
    memberCount: extras.memberCount ?? 0,
    score: extras.score ?? 0,
    rank: extras.rank ?? 0,
    solveCount: extras.solveCount ?? 0,
    bloodCount: extras.bloodCount ?? 0,
  };
}

export function serializeChannel(channel: AnyRecord): Channel {
  return {
    id: channel.id as string,
    name: channel.name as string,
    slug: channel.slug as string,
    topic: (channel.topic as string | null) ?? null,
    type: channel.type as Channel['type'],
    categoryId: (channel.categoryId as string | null) ?? null,
    position: (channel.position as number) ?? 0,
    isPrivate: Boolean(channel.isPrivate),
    isLocked: Boolean(channel.isLocked),
    challengeId: (channel.challengeId as string | null) ?? null,
    teamId: (channel.teamId as string | null) ?? null,
    iconKey: (channel.iconKey as string | null) ?? null,
    logoUrl: (channel.logoUrl as string | null) ?? null,
    serverId: (channel.serverId as string | null) ?? null,
  };
}

export interface SerializeMessageInput extends AnyRecord {
  reactions?: Array<{ emoji: string; userId: string }>;
  attachments?: Array<{ id: string; url: string; name: string; mimeType: string; size: number }>;
  author: AnyRecord;
  replyTo?: { id: string; authorId: string; content: string } | null;
  pin?: AnyRecord | null;
}

export function serializeMessage(msg: SerializeMessageInput): Message {
  const reactions = aggregateReactions(msg.reactions ?? []);
  let mentions: string[] = [];
  try {
    mentions = JSON.parse((msg.mentionsJson as string) ?? '[]');
  } catch {
    mentions = [];
  }
  return {
    id: msg.id as string,
    channelId: msg.channelId as string,
    authorId: msg.authorId as string,
    author: serializeUser(msg.author),
    content: msg.deletedAt ? '' : (msg.content as string),
    replyToId: (msg.replyToId as string | null) ?? null,
    replyTo: msg.replyTo
      ? { id: msg.replyTo.id, authorId: msg.replyTo.authorId, content: msg.replyTo.content }
      : null,
    pinned: Boolean(msg.pin),
    editedAt: msg.editedAt ? new Date(msg.editedAt as Date).toISOString() : null,
    deletedAt: msg.deletedAt ? new Date(msg.deletedAt as Date).toISOString() : null,
    createdAt: new Date(msg.createdAt as Date).toISOString(),
    attachments: (msg.attachments ?? []).map((a) => ({
      id: a.id,
      url: a.url,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
    })),
    reactions,
    mentions,
  };
}

function aggregateReactions(rows: Array<{ emoji: string; userId: string }>): Message['reactions'] {
  const map = new Map<string, { emoji: string; count: number; userIds: string[] }>();
  for (const r of rows) {
    const existing = map.get(r.emoji);
    if (existing) {
      existing.count += 1;
      existing.userIds.push(r.userId);
    } else {
      map.set(r.emoji, { emoji: r.emoji, count: 1, userIds: [r.userId] });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function serializeChallenge(
  ch: AnyRecord & { _count?: { solves: number; hints: number }; discussionChannel?: AnyRecord | null },
  ctx: { mySolves?: Set<string>; bloodTeamId?: string | null; authorName?: string | null } = {},
): Challenge {
  let tags: string[] = [];
  try {
    tags = JSON.parse((ch.tagsJson as string) ?? '[]');
  } catch {
    tags = [];
  }
  return {
    id: ch.id as string,
    slug: ch.slug as string,
    title: ch.title as string,
    description: ch.description as string,
    category: ch.category as Challenge['category'],
    difficulty: ch.difficulty as Challenge['difficulty'],
    points: (ch.points as number) ?? 0,
    tags,
    solveCount: ch._count?.solves ?? 0,
    firstBloodTeamId: (ch.firstBloodTeamId as string | null) ?? ctx.bloodTeamId ?? null,
    hintCount: ch._count?.hints ?? 0,
    discussionChannelId: (ch.discussionChannel?.id as string | null) ?? null,
    authorName: ctx.authorName ?? null,
    isReleased: Boolean(ch.isReleased ?? true),
    isSolvedByMyTeam: ctx.mySolves?.has(ch.id as string) ?? false,
  };
}

export function serializeHint(
  hint: AnyRecord,
  ctx: { unlocked: boolean },
): ChallengeHint {
  return {
    id: hint.id as string,
    order: (hint.order as number) ?? 0,
    text: ctx.unlocked ? (hint.text as string) : '',
    cost: (hint.cost as number) ?? 0,
    unlocked: ctx.unlocked,
  };
}

export function serializeTicketCategory(c: AnyRecord): TicketCategoryDto {
  return {
    id: c.id as string,
    key: c.key as string,
    name: c.name as string,
    position: (c.position as number) ?? 0,
    isActive: (c.isActive as boolean) ?? true,
    requiresChallenge: (c.requiresChallenge as boolean) ?? false,
  };
}

export function serializeCompetition(c: AnyRecord): CompetitionSettingsDto {
  return {
    serverId: c.serverId as string,
    startsAt: c.startsAt ? new Date(c.startsAt as Date).toISOString() : null,
    endsAt: c.endsAt ? new Date(c.endsAt as Date).toISOString() : null,
    timezone: (c.timezone as string) ?? 'Europe/Istanbul',
    status: c.status as CompetitionSettingsDto['status'],
    ticketPolicy: c.ticketPolicy as CompetitionSettingsDto['ticketPolicy'],
    archivedAt: c.archivedAt ? new Date(c.archivedAt as Date).toISOString() : null,
  };
}

export function serializeTicketTag(t: AnyRecord): TicketTagDto {
  return {
    id: t.id as string,
    name: t.name as string,
    color: (t.color as string) ?? '#a78bfa',
  };
}

export function serializeTicket(
  t: AnyRecord & {
    openedBy: AnyRecord;
    assignedTo?: AnyRecord | null;
    team?: AnyRecord | null;
    category?: AnyRecord | null;
    challenge?: AnyRecord | null;
    tags?: Array<{ tag: AnyRecord }> | null;
  },
  ctx?: { unreadCount?: number; messageCount?: number; attachmentCount?: number },
): Ticket {
  const assignedTo = t.assignedTo ? serializeUser(t.assignedTo) : null;
  const priority = (t.priority as Ticket['priority']) ?? 'MEDIUM';
  return {
    id: t.id as string,
    serverId: t.serverId as string,
    code: t.code as string,
    seq: (t.seq as number) ?? 0,
    title: t.title as string,
    body: t.body as string,
    status: t.status as Ticket['status'],
    priority,
    severity: priority,
    category: t.category ? serializeTicketCategory(t.category) : null,
    challengeId: (t.challengeId as string | null) ?? null,
    challenge: t.challenge
      ? {
          id: t.challenge.id as string,
          title: t.challenge.title as string,
          category: (t.challenge.category as string) ?? '',
        }
      : null,
    channelId: (t.channelId as string | null) ?? null,
    openedBy: serializeUser(t.openedBy),
    assignedTo,
    claimedBy: assignedTo,
    team: t.team
      ? {
          id: t.team.id as string,
          name: t.team.name as string,
          color: (t.team.color as string) ?? '#22d3ee',
        }
      : null,
    tags: (t.tags ?? []).map((link) => serializeTicketTag(link.tag)),
    createdAt: new Date(t.createdAt as Date).toISOString(),
    updatedAt: new Date(t.updatedAt as Date).toISOString(),
    firstResponseAt: t.firstResponseAt ? new Date(t.firstResponseAt as Date).toISOString() : null,
    resolvedAt: t.resolvedAt ? new Date(t.resolvedAt as Date).toISOString() : null,
    closedAt: t.closedAt ? new Date(t.closedAt as Date).toISOString() : null,
    reopenCount: (t.reopenCount as number) ?? 0,
    messageCount: ctx?.messageCount ?? 0,
    attachmentCount: ctx?.attachmentCount ?? 0,
    unreadCount: ctx?.unreadCount ?? 0,
  };
}

export function serializeTicketEvent(
  ev: AnyRecord & { author?: AnyRecord | null; attachments?: AnyRecord[] | null },
): TicketEvent {
  let meta: Record<string, unknown> | null = null;
  try {
    meta = JSON.parse((ev.metaJson as string) ?? '{}');
  } catch {
    meta = null;
  }
  return {
    id: ev.id as string,
    ticketId: ev.ticketId as string,
    type: ev.type as TicketEvent['type'],
    author: ev.author ? serializeUser(ev.author) : null,
    body: (ev.body as string | null) ?? null,
    meta,
    attachments: (ev.attachments ?? []).map((a) => ({
      id: a.id as string,
      name: a.name as string,
      mimeType: a.mimeType as string,
      size: (a.size as number) ?? 0,
      url: a.url as string,
      createdAt: new Date(a.createdAt as Date).toISOString(),
    })),
    createdAt: new Date(ev.createdAt as Date).toISOString(),
  };
}

export function serializeNotification(n: AnyRecord): NotificationDto {
  return {
    id: n.id as string,
    kind: n.kind as NotificationDto['kind'],
    title: n.title as string,
    body: (n.body as string) ?? '',
    href: (n.href as string | null) ?? null,
    refType: (n.refType as string | null) ?? null,
    refId: (n.refId as string | null) ?? null,
    serverId: (n.serverId as string | null) ?? null,
    read: n.readAt != null,
    createdAt: new Date(n.createdAt as Date).toISOString(),
    meta: parseJsonObject(n.metaJson),
  };
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function serializeIncident(
  i: AnyRecord & { openedBy: AnyRecord; assignedTo?: AnyRecord | null },
): Incident {
  return {
    id: i.id as string,
    title: i.title as string,
    severity: i.severity as Incident['severity'],
    status: i.status as Incident['status'],
    description: i.description as string,
    openedBy: serializeUser(i.openedBy),
    assignedTo: i.assignedTo ? serializeUser(i.assignedTo) : null,
    createdAt: new Date(i.createdAt as Date).toISOString(),
    resolvedAt: i.resolvedAt ? new Date(i.resolvedAt as Date).toISOString() : null,
    channelId: (i.channelId as string | null) ?? null,
    serverId: (i.serverId as string | null) ?? null,
  };
}

export function serializeAnnouncement(
  a: AnyRecord & { author: AnyRecord },
): Announcement {
  return {
    id: a.id as string,
    title: a.title as string,
    body: a.body as string,
    severity: a.severity as Announcement['severity'],
    author: serializeUser(a.author),
    createdAt: new Date(a.createdAt as Date).toISOString(),
    scheduledFor: a.scheduledFor ? new Date(a.scheduledFor as Date).toISOString() : null,
    publishedAt: a.publishedAt ? new Date(a.publishedAt as Date).toISOString() : null,
    expiresAt: a.expiresAt ? new Date(a.expiresAt as Date).toISOString() : null,
    serverId: (a.serverId as string | null) ?? null,
    channelId: (a.channelId as string | null) ?? null,
    sourceTicketId: (a.sourceTicketId as string | null) ?? null,
  };
}

export function serializeScoreboardEntry(
  team: AnyRecord & { _count?: { solves: number } },
  args: {
    rank: number;
    previousRank: number | null;
    score: number;
    solveCount: number;
    bloodCount: number;
    lastSolveAt: Date | null;
    memberCount: number;
  },
): ScoreboardEntry {
  return {
    rank: args.rank,
    previousRank: args.previousRank,
    score: args.score,
    solveCount: args.solveCount,
    lastSolveAt: args.lastSolveAt ? args.lastSolveAt.toISOString() : null,
    team: serializeTeam(team, {
      memberCount: args.memberCount,
      score: args.score,
      rank: args.rank,
      solveCount: args.solveCount,
      bloodCount: args.bloodCount,
    }),
  };
}
