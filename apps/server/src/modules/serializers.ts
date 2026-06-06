import type {
  Announcement,
  Channel,
  Challenge,
  ChallengeHint,
  Incident,
  Message,
  PublicUser,
  ScoreboardEntry,
  Team,
  Ticket,
  TicketEvent,
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

export function serializeTicket(
  t: AnyRecord & {
    openedBy: AnyRecord;
    claimedBy?: AnyRecord | null;
    team?: AnyRecord | null;
  },
): Ticket {
  return {
    id: t.id as string,
    code: t.code as string,
    title: t.title as string,
    body: t.body as string,
    status: t.status as Ticket['status'],
    severity: t.severity as Ticket['severity'],
    challengeId: (t.challengeId as string | null) ?? null,
    channelId: (t.channelId as string | null) ?? null,
    openedBy: serializeUser(t.openedBy),
    claimedBy: t.claimedBy ? serializeUser(t.claimedBy) : null,
    team: t.team
      ? {
          id: t.team.id as string,
          name: t.team.name as string,
          color: (t.team.color as string) ?? '#22d3ee',
        }
      : null,
    createdAt: new Date(t.createdAt as Date).toISOString(),
    updatedAt: new Date(t.updatedAt as Date).toISOString(),
    unreadCount: 0,
  };
}

export function serializeTicketEvent(ev: AnyRecord & { author?: AnyRecord | null }): TicketEvent {
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
    createdAt: new Date(ev.createdAt as Date).toISOString(),
  };
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
    serverId: (a.serverId as string | null) ?? null,
    channelId: (a.channelId as string | null) ?? null,
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
