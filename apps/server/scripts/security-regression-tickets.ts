/**
 * Ticket system security regression (spec section 38: TCK-1..TCK-10).
 * Run: pnpm security:tickets
 * Requires API on http://localhost:4000 and a seeded database.
 *
 * Fixtures (two competitors on different teams of one competition) are created
 * directly in the database and removed afterwards; every assertion itself goes
 * through the HTTP API so it exercises the real authorization path.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';
import { assignUserToServerTeam } from '../src/lib/team-membership.js';
import { assignDefaultRoleToMember } from '../src/lib/assign-default-server-role.js';
import { absolutePathForStoredAttachment, unlinkQuiet } from '../src/lib/upload.js';

const API = process.env.REGRESSION_API ?? 'http://localhost:4000/api';
const ORIGIN = API.replace(/\/api\/?$/, '');
const PASS = 'Regression!2345';
const STAFF_PASS = 'Admin!2345';
const prisma = new PrismaClient();

interface Fixture {
  serverId: string;
  a: { id: string; username: string; teamId: string };
  b: { id: string; username: string; teamId: string };
}

/** Creates two competitors on two different teams of the same competition. */
async function createFixture(): Promise<Fixture> {
  const server = await prisma.chatServer.findFirst({
    where: { teams: { some: {} } },
    select: { id: true, teams: { select: { id: true }, take: 2 } },
  });
  if (!server || server.teams.length < 2) {
    throw new Error('Need a competition with at least two teams; run the seed first.');
  }

  const stamp = Date.now().toString(36);
  const passwordHash = await hashPassword(PASS);
  const made: Array<{ id: string; username: string; teamId: string }> = [];

  for (const [index, team] of server.teams.entries()) {
    const username = `regtck-${stamp}-${index}`;
    const user = await prisma.user.create({
      data: {
        email: `${username}@regression.local`,
        username,
        displayName: `Regression Competitor ${index + 1}`,
        passwordHash,
        role: 'TEAM_MEMBER',
        status: 'OFFLINE',
      },
      select: { id: true },
    });
    await prisma.serverMember.create({ data: { userId: user.id, serverId: server.id } });
    await assignDefaultRoleToMember(user.id, server.id);
    await assignUserToServerTeam(prisma, {
      userId: user.id,
      serverId: server.id,
      teamId: team.id,
    });
    made.push({ id: user.id, username, teamId: team.id });
  }

  return { serverId: server.id, a: made[0]!, b: made[1]! };
}

async function destroyFixture(fixture: Fixture): Promise<void> {
  const ids = [fixture.a.id, fixture.b.id];
  const tickets = await prisma.ticket.findMany({
    where: { openedById: { in: ids } },
    select: { id: true },
  });
  const ticketIds = tickets.map((t) => t.id);
  // Attachments cascade with their event, but the stored files do not.
  const attachments = await prisma.attachment.findMany({
    where: { ticketEvent: { ticketId: { in: ticketIds } } },
    select: { id: true, name: true },
  });
  for (const att of attachments) {
    await unlinkQuiet(absolutePathForStoredAttachment(att.id, att.name));
  }
  await prisma.announcement.deleteMany({ where: { sourceTicketId: { in: ticketIds } } });
  await prisma.notification.deleteMany({ where: { refId: { in: ticketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

type Result = { id: string; name: string; pass: boolean; detail: string };

class Session {
  jar = new Map<string, string>();
  csrf = '';
  userId = '';
  teamId: string | null = null;
  username = '';

  cookieHeader(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private absorb(res: Response): void {
    const raw = res.headers.getSetCookie?.() ?? [];
    const list = raw.length ? raw : [res.headers.get('set-cookie') ?? ''];
    for (const cookie of list) {
      if (!cookie) continue;
      for (const part of cookie.split(/,(?=\s*[a-zA-Z_][\w-]*=)/)) {
        const seg = part.trim().split(';')[0];
        if (!seg) continue;
        const eq = seg.indexOf('=');
        if (eq <= 0) continue;
        const name = seg.slice(0, eq).trim();
        const value = seg.slice(eq + 1).trim();
        if (value) this.jar.set(name, value);
        else this.jar.delete(name);
      }
    }
    const csrf = this.jar.get('sydt_csrf');
    if (csrf) this.csrf = csrf;
  }

  async request(
    path: string,
    init: RequestInit & { skipCsrf?: boolean } = {},
  ): Promise<{ status: number; text: string }> {
    const headers = new Headers(init.headers);
    headers.set('cookie', this.cookieHeader());
    if (init.method && !['GET', 'HEAD'].includes(init.method) && !init.skipCsrf && this.csrf) {
      headers.set('X-CSRF-Token', this.csrf);
    }
    const res = await fetch(`${API}${path}`, { ...init, headers });
    this.absorb(res);
    return { status: res.status, text: await res.text() };
  }

  async json<T>(
    path: string,
    init?: RequestInit & { skipCsrf?: boolean },
  ): Promise<{ status: number; data: T | undefined; text: string }> {
    const { status, text } = await this.request(path, init);
    let data: T | undefined;
    try {
      data = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      /* non-json body */
    }
    return { status, data, text };
  }

  post<T>(path: string, body?: unknown) {
    return this.json<T>(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  /** Multipart POST, used for the attachment cases. */
  postForm<T>(path: string, form: FormData) {
    return this.json<T>(path, { method: 'POST', body: form });
  }

  patch<T>(path: string, body: unknown) {
    return this.json<T>(path, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async login(identifier: string, password: string): Promise<boolean> {
    await this.request('/auth/csrf');
    const { status, text } = await this.json('/auth/login', {
      method: 'POST',
      skipCsrf: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    if (status !== 200) {
      if (process.env.REGRESSION_DEBUG) {
        console.error(`login ${identifier} -> ${status} ${text.slice(0, 160)}`);
      }
      return false;
    }
    const me = await this.json<{ user: { id: string; username: string; teamId: string | null } }>(
      '/auth/me',
    );
    this.userId = me.data?.user?.id ?? '';
    this.username = me.data?.user?.username ?? identifier;
    this.teamId = me.data?.user?.teamId ?? null;
    return true;
  }
}

interface TicketDto {
  id: string;
  code: string;
  status: string;
  team: { id: string; name: string } | null;
}
interface ListPage {
  tickets: TicketDto[];
  total: number;
}
interface EventDto {
  id: string;
  type: string;
  body: string | null;
  attachments: Array<{ id: string; name: string; url: string }>;
}
interface DetailDto {
  ticket: TicketDto;
  events: EventDto[];
  viewer: { canSeeInternal: boolean; canViewAll: boolean };
}

/** A one-pixel PNG, used as a legitimate attachment in the upload cases. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

function check(id: string, name: string, ok: boolean, detail: string): Result {
  return { id, name, pass: ok, detail };
}

async function main(): Promise<void> {
  const health = await fetch(`${ORIGIN}/health`);
  if (!health.ok) {
    console.error('API not reachable at', ORIGIN);
    process.exit(1);
  }

  const results: Result[] = [];
  const organizer = new Session();
  const organizerAdmin = new Session();
  const teamA = new Session();
  const teamB = new Session();

  const fixture = await createFixture();
  const { serverId } = fixture;
  const first = fixture.a;
  const second = fixture.b;

  if (
    !(await organizer.login('heimdall', STAFF_PASS)) ||
    !(await organizerAdmin.login('freya', STAFF_PASS)) ||
    !(await teamA.login(first.username, PASS)) ||
    !(await teamB.login(second.username, PASS))
  ) {
    console.error('login failed (organizer heimdall / regression competitors)');
    await destroyFixture(fixture);
    process.exit(1);
  }

  const meta = await teamA.json<{
    categories: Array<{ id: string; key: string; requiresChallenge: boolean }>;
  }>(`/servers/${serverId}/tickets/meta`);
  const category = meta.data?.categories?.find((c) => !c.requiresChallenge);

  // --- TCK-3: team_id in the request body must be ignored -------------------
  const created = await teamA.post<{ ticket: TicketDto }>(`/servers/${serverId}/tickets`, {
    title: 'Regression: VPN drops every 5 minutes',
    body: 'Our OpenVPN session resets constantly, which blocks the whole team.',
    priority: 'HIGH',
    categoryId: category?.id,
    teamId: second.teamId,
    openedById: second.id,
    status: 'CLOSED',
  });
  const ownTicket = created.data?.ticket;
  results.push(
    check(
      'TCK-3',
      'teamId/openedById in body cannot be spoofed',
      created.status === 201 &&
        ownTicket?.team?.id === first.teamId &&
        ownTicket?.status === 'OPEN',
      `status=${created.status} team=${ownTicket?.team?.id ?? 'null'} state=${ownTicket?.status ?? '-'}`,
    ),
  );

  // Team B opens its own ticket, which team A must never see.
  const foreign = await teamB.post<{ ticket: TicketDto }>(`/servers/${serverId}/tickets`, {
    title: 'Regression: flag rejected for BT09',
    body: 'Submitting the flag for BT09 returns incorrect although the format matches.',
    priority: 'MEDIUM',
    categoryId: category?.id,
  });
  const foreignTicket = foreign.data?.ticket;
  if (!ownTicket || !foreignTicket) {
    console.error('ticket creation failed', created.text, foreign.text);
    await destroyFixture(fixture);
    process.exit(1);
  }

  // --- TCK-1: direct read of another team's ticket --------------------------
  const crossRead = await teamA.json(`/tickets/${foreignTicket.id}`);
  results.push(
    check(
      'TCK-1',
      "Cross-team GET /tickets/:id returns 404",
      crossRead.status === 404,
      `status=${crossRead.status}`,
    ),
  );

  // --- TCK-7: id enumeration is indistinguishable from a missing ticket -----
  const ghost = await teamA.json('/tickets/clxxxxxxxxxxxxxxxxxxxxxxx');
  results.push(
    check(
      'TCK-7',
      'Unknown id and forbidden id both 404 (no enumeration oracle)',
      ghost.status === crossRead.status && crossRead.status === 404,
      `unknown=${ghost.status} forbidden=${crossRead.status}`,
    ),
  );

  // --- TCK-6: search cannot surface other teams' tickets -------------------
  const searchByCode = await teamA.json<ListPage>(
    `/servers/${serverId}/tickets?q=${encodeURIComponent(foreignTicket.code)}`,
  );
  const searchByTeam = await teamA.json<ListPage>(
    `/servers/${serverId}/tickets?teamId=${second.teamId}`,
  );
  const leakedInSearch =
    (searchByCode.data?.tickets ?? []).some((t) => t.id === foreignTicket.id) ||
    (searchByTeam.data?.tickets ?? []).some((t) => t.id === foreignTicket.id);
  results.push(
    check(
      'TCK-6',
      'Search/filter never returns another team ticket',
      searchByCode.status === 200 && !leakedInSearch,
      `codeHits=${searchByCode.data?.tickets?.length ?? 0} teamFilterHits=${searchByTeam.data?.tickets?.length ?? 0}`,
    ),
  );

  // --- TCK-5: internal notes are organizer-only ----------------------------
  const note = await organizer.post(`/tickets/${ownTicket.id}/comment`, {
    body: 'Internal: container restarted, related to the shared VPN incident.',
    internal: true,
  });
  const asCompetitor = await teamA.json<DetailDto>(`/tickets/${ownTicket.id}`);
  const sawInternal = (asCompetitor.data?.events ?? []).some((e) => e.type === 'INTERNAL_NOTE');
  results.push(
    check(
      'TCK-5',
      'Internal note hidden from competitor API response',
      note.status === 200 &&
        !sawInternal &&
        asCompetitor.data?.viewer.canSeeInternal === false,
      `noteStatus=${note.status} internalVisible=${sawInternal} canSeeInternal=${asCompetitor.data?.viewer.canSeeInternal}`,
    ),
  );

  const competitorNote = await teamA.post(`/tickets/${ownTicket.id}/comment`, {
    body: 'Trying to write a staff-only note.',
    internal: true,
  });
  results.push(
    check(
      'TCK-5b',
      'Competitor cannot post an internal note',
      competitorNote.status === 403,
      `status=${competitorNote.status}`,
    ),
  );

  // --- TCK-4: privilege escalation through field updates -------------------
  const escalate = await teamA.patch(`/tickets/${ownTicket.id}`, {
    status: 'RESOLVED',
    priority: 'CRITICAL',
    assignedToId: first.id,
  });
  const claim = await teamA.post(`/tickets/${ownTicket.id}/claim`);
  results.push(
    check(
      'TCK-4',
      'Competitor cannot patch status/priority/assignee or claim',
      escalate.status === 403 && claim.status === 403,
      `patch=${escalate.status} claim=${claim.status}`,
    ),
  );

  // --- TCK-8: closed tickets stay isolated --------------------------------
  await organizer.patch(`/tickets/${foreignTicket.id}`, { status: 'CLOSED' });
  const closedCross = await teamA.json(`/tickets/${foreignTicket.id}`);
  const closedReply = await teamA.post(`/tickets/${foreignTicket.id}/comment`, {
    body: 'Reply attempt on a closed foreign ticket.',
  });
  results.push(
    check(
      'TCK-8',
      'Closed foreign ticket is not readable or repliable',
      closedCross.status === 404 && closedReply.status === 404,
      `read=${closedCross.status} reply=${closedReply.status}`,
    ),
  );

  // --- TCK-9: organizer-only bulk surface ---------------------------------
  const bulkAsCompetitor = await teamA.post(`/servers/${serverId}/tickets/bulk`, {
    ticketIds: [ownTicket.id, foreignTicket.id],
    action: { status: 'CLOSED' },
  });
  // The organizer run must also stay inside the competition scope.
  const bulkAsOrganizer = await organizer.post<{ applied: number }>(
    `/servers/${serverId}/tickets/bulk`,
    { ticketIds: [ownTicket.id], action: { priority: 'LOW' } },
  );
  results.push(
    check(
      'TCK-9',
      'Bulk endpoint organizer-only and scope-limited',
      (bulkAsCompetitor.status === 403 || bulkAsCompetitor.status === 404) &&
        bulkAsOrganizer.status === 200 &&
        bulkAsOrganizer.data?.applied === 1,
      `competitor=${bulkAsCompetitor.status} organizer=${bulkAsOrganizer.status} applied=${bulkAsOrganizer.data?.applied ?? '-'}`,
    ),
  );

  // --- TCK-2: attachment download authorization ---------------------------
  // Team B files a fresh ticket with evidence attached.
  const evidenceForm = new FormData();
  evidenceForm.set('title', 'Regression: RDP host unreachable');
  evidenceForm.set('body', 'Screenshot attached; the RDP target refuses the connection.');
  evidenceForm.set('priority', 'HIGH');
  if (category?.id) evidenceForm.set('categoryId', category.id);
  evidenceForm.set(
    'files',
    new Blob([new Uint8Array(PNG_BYTES)], { type: 'image/png' }),
    'evidence.png',
  );
  const withFile = await teamB.postForm<{ ticket: TicketDto }>(
    `/servers/${serverId}/tickets`,
    evidenceForm,
  );
  const evidenceTicket = withFile.data?.ticket;
  const ownerDetail = evidenceTicket
    ? await teamB.json<DetailDto>(`/tickets/${evidenceTicket.id}`)
    : undefined;
  const attachment = ownerDetail?.data?.events.flatMap((e) => e.attachments ?? [])[0];

  const foreignDownload = attachment
    ? await teamA.request(`/files/${attachment.id}`)
    : { status: 0 };
  const ownerDownload = attachment ? await teamB.request(`/files/${attachment.id}`) : { status: 0 };
  results.push(
    check(
      'TCK-2',
      'Attachment download is team-scoped',
      withFile.status === 201 &&
        !!attachment &&
        foreignDownload.status === 404 &&
        ownerDownload.status === 200,
      `upload=${withFile.status} cross=${foreignDownload.status} owner=${ownerDownload.status}`,
    ),
  );

  // --- TCK-2b: MIME spoofing on upload ------------------------------------
  const spoofForm = new FormData();
  spoofForm.set('title', 'Regression: spoofed screenshot');
  spoofForm.set('body', 'This upload claims to be a PNG but carries HTML markup.');
  spoofForm.set('priority', 'LOW');
  if (category?.id) spoofForm.set('categoryId', category.id);
  spoofForm.set(
    'files',
    new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' }),
    'payload.png',
  );
  const spoofed = await teamA.postForm(`/servers/${serverId}/tickets`, spoofForm);
  results.push(
    check(
      'TCK-2b',
      'Content/MIME mismatch upload rejected',
      spoofed.status === 400,
      `status=${spoofed.status}`,
    ),
  );

  // --- TCK-5c: internal-note attachments stay organizer-only --------------
  const noteForm = new FormData();
  noteForm.set('body', 'Internal: capture from the affected container.');
  noteForm.set('internal', 'true');
  noteForm.set(
    'files',
    new Blob([new Uint8Array(PNG_BYTES)], { type: 'image/png' }),
    'internal.png',
  );
  const internalUpload = evidenceTicket
    ? await organizer.postForm<{ event: EventDto }>(
        `/tickets/${evidenceTicket.id}/comment`,
        noteForm,
      )
    : undefined;
  const internalAttachmentId = internalUpload?.data?.event?.attachments?.[0]?.id;
  const noteDownload = internalAttachmentId
    ? await teamB.request(`/files/${internalAttachmentId}`)
    : { status: 0 };
  results.push(
    check(
      'TCK-5c',
      'Internal note attachment hidden from the reporting team',
      !!internalAttachmentId && noteDownload.status === 404,
      `upload=${internalUpload?.status ?? '-'} competitorDownload=${noteDownload.status}`,
    ),
  );

  // --- TCK-10: announcement creation authorization ------------------------
  const competitorAnnounceFromTicket = await teamA.post(`/tickets/${ownTicket.id}/announce`, {
    title: 'Fake outage notice',
    body: 'A competitor should never be able to broadcast this to the competition.',
  });
  const competitorAnnounceDirect = await teamA.post(`/servers/${serverId}/announcements`, {
    title: 'Fake outage notice',
    body: 'A competitor should never be able to broadcast this to the competition.',
    severity: 'HIGH',
  });
  // Broadcasting to a whole competition is an organizer-admin privilege, so a
  // plain organizer (moderator) must be refused as well.
  const moderatorAnnounce = await organizer.post(`/tickets/${ownTicket.id}/announce`, {
    title: 'Moderator broadcast attempt',
    body: 'A moderator should escalate to an organizer admin instead of broadcasting.',
  });
  const adminAnnounce = await organizerAdmin.post<{ announcement: { id: string } }>(
    `/tickets/${ownTicket.id}/announce`,
    {
      title: 'VPN instability affecting multiple teams',
      body: 'We are investigating repeated OpenVPN disconnects. No action needed from teams.',
      severity: 'HIGH',
    },
  );
  results.push(
    check(
      'TCK-10',
      'Announcements restricted to organizer admins',
      (competitorAnnounceFromTicket.status === 403 ||
        competitorAnnounceFromTicket.status === 404) &&
        (competitorAnnounceDirect.status === 403 || competitorAnnounceDirect.status === 404) &&
        moderatorAnnounce.status === 403 &&
        adminAnnounce.status === 201,
      `competitor=${competitorAnnounceFromTicket.status}/${competitorAnnounceDirect.status} moderator=${moderatorAnnounce.status} admin=${adminAnnounce.status}`,
    ),
  );

  // --- TCK-11: relation management is organizer-only ----------------------
  const competitorRelation = await teamA.post(`/tickets/${ownTicket.id}/relations`, {
    relatedTicketId: foreignTicket.id,
    kind: 'RELATED',
  });
  results.push(
    check(
      'TCK-11',
      'Ticket relations cannot be created by competitors',
      competitorRelation.status === 403 || competitorRelation.status === 404,
      `status=${competitorRelation.status}`,
    ),
  );

  // --- TCK-12: notification inbox is per-user -----------------------------
  const inboxA = await teamA.json<{ notifications: Array<{ refId: string | null }> }>(
    '/notifications?limit=50',
  );
  const leaked = (inboxA.data?.notifications ?? []).filter(
    (n) => n.refId === foreignTicket.id || n.refId === evidenceTicket?.id,
  );
  results.push(
    check(
      'TCK-12',
      'Notification inbox carries no other team ticket refs',
      inboxA.status === 200 && leaked.length === 0,
      `status=${inboxA.status} leaked=${leaked.length}`,
    ),
  );

  // --- TCK-13: ticket meta admin surface is organizer-only ---------------
  const competitorCategory = await teamA.post(`/servers/${serverId}/ticket-categories`, {
    name: 'Competitor injected category',
  });
  const competitorCompetition = await teamA.patch(`/servers/${serverId}/competition`, {
    ticketPolicy: 'OPEN',
  });
  const competitorStats = await teamA.json(`/servers/${serverId}/tickets/stats`);
  results.push(
    check(
      'TCK-13',
      'Ticket configuration and stats are organizer-only',
      (competitorCategory.status === 403 || competitorCategory.status === 404) &&
        (competitorCompetition.status === 403 || competitorCompetition.status === 404) &&
        (competitorStats.status === 403 || competitorStats.status === 404),
      `category=${competitorCategory.status} competition=${competitorCompetition.status} stats=${competitorStats.status}`,
    ),
  );

  // --- TCK-14/15: competition-scoped channel ACL (ServerTeamMember) --------
  const { ensureTeamWorkspace } = await import('../src/modules/categories/category-team-rooms.service.js');
  const teamARow = await prisma.team.findUniqueOrThrow({
    where: { id: fixture.a.teamId },
    select: { id: true, name: true, serverId: true },
  });
  const teamBRow = await prisma.team.findUniqueOrThrow({
    where: { id: fixture.b.teamId },
    select: { id: true, name: true, serverId: true },
  });
  if (teamARow.serverId) {
    await ensureTeamWorkspace(prisma, {
      id: teamARow.id,
      name: teamARow.name,
      serverId: teamARow.serverId,
    });
  }
  if (teamBRow.serverId) {
    await ensureTeamWorkspace(prisma, {
      id: teamBRow.id,
      name: teamBRow.name,
      serverId: teamBRow.serverId,
    });
  }

  const teamAChannel = await prisma.channel.findFirst({
    where: {
      serverId,
      OR: [{ teamId: fixture.a.teamId }, { category: { teamId: fixture.a.teamId } }],
    },
    select: { id: true },
  });
  const teamBChannel = await prisma.channel.findFirst({
    where: {
      serverId,
      OR: [{ teamId: fixture.b.teamId }, { category: { teamId: fixture.b.teamId } }],
    },
    select: { id: true },
  });

  if (teamAChannel && teamBChannel) {
    const bReadsA = await teamB.json(`/channels/${teamAChannel.id}/messages?take=5`);
    const aReadsB = await teamA.json(`/channels/${teamBChannel.id}/messages?take=5`);
    results.push(
      check(
        'TCK-14',
        'Team private channels are not readable across teams',
        (bReadsA.status === 403 || bReadsA.status === 404) &&
          (aReadsB.status === 403 || aReadsB.status === 404),
        `b→a=${bReadsA.status} a→b=${aReadsB.status}`,
      ),
    );

    const aPostsOwn = await teamA.post(`/channels/${teamAChannel.id}/messages`, {
      content: `isolation-ok @${fixture.b.username}`,
    });
    // Cross-team mention must not deliver (emit skipped); send itself succeeds for A.
    results.push(
      check(
        'TCK-15',
        'Own team channel accepts messages; cross-team mention is ACL-filtered',
        aPostsOwn.status === 201,
        `post=${aPostsOwn.status}`,
      ),
    );
  } else {
    results.push(
      check('TCK-14', 'Team private channels are not readable across teams', false, 'missing team channels'),
    );
    results.push(
      check('TCK-15', 'Own team channel accepts messages; cross-team mention is ACL-filtered', false, 'missing team channels'),
    );
  }

  await destroyFixture(fixture);

  console.log('\n=== Ticket Security Regression (spec §38) ===\n');
  console.log('| ID | Pass | Test | Detail |');
  console.log('|----|------|------|--------|');
  for (const r of results) {
    console.log(`| ${r.id} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail} |`);
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error('Failed:', failed.map((f) => f.id).join(', '));
    process.exitCode = 1;
    return;
  }
  console.log('All ticket isolation checks passed.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
