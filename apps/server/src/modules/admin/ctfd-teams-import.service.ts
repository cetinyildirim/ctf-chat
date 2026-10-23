import crypto from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { Role } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { hashPassword } from '../../lib/password.js';
import { createTeamWithSlug } from '../../lib/team-create.js';
import { assignUserToServerTeam } from '../../lib/team-membership.js';
import { assignServerRoleToMember } from '../../lib/assign-default-server-role.js';
import { serverMemberJoinFields } from '../../lib/server-membership.js';

export interface CtfdTeamsImportCredential {
  teamName: string;
  username: string;
  email: string;
  password: string;
  role: 'captain' | 'member';
}

export interface CtfdTeamsImportResult {
  teamsCreated: number;
  teamsReused: number;
  usersCreated: number;
  usersUpdated: number;
  serverMembersAdded: number;
  skipped: number;
  credentials: CtfdTeamsImportCredential[];
}

export type CtfdTeamsPreviewMemberStatus =
  | 'create'
  | 'create_username_suffix'
  | 'update_existing'
  | 'update_server_member';

export interface CtfdTeamsPreviewMember {
  key: string;
  displayName: string;
  email: string;
  isCaptain: boolean;
  status: CtfdTeamsPreviewMemberStatus;
  plannedUsername: string;
}

export type CtfdTeamsPreviewTeamStatus = 'create' | 'reuse';

export interface CtfdTeamsPreviewTeam {
  key: string;
  name: string;
  teamStatus: CtfdTeamsPreviewTeamStatus;
  members: CtfdTeamsPreviewMember[];
}

export interface CtfdTeamsPreview {
  teams: CtfdTeamsPreviewTeam[];
  totalTeams: number;
  totalMembers: number;
}

type ParsedMember = {
  displayName: string;
  email: string;
  teamName: string;
  isCaptain: boolean;
  serverRoleId?: string;
};

const TEAM_COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#e879f9'];

function normKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '_');
}

function rowMap(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[normKey(k)] = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
  }
  return out;
}

/** Exact column match only — avoids team_name matching as user name. */
function pickExact(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return '';
}

function pickMember(row: Record<string, string>, field: string): string {
  return row[`member_${field}`] ?? '';
}

function truthy(val: string): boolean {
  return ['true', '1', 'yes', 'y'].includes(val.toLowerCase());
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

export function parseMembersFromCsv(csvText: string): ParsedMember[] {
  let records: Record<string, string>[];
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
  } catch {
    return [];
  }

  const members: ParsedMember[] = [];
  let currentTeam = '';

  for (const raw of records) {
    const row = rowMap(raw);

    const memberName = pickMember(row, 'name') || pickExact(row, 'member_name');
    const memberEmail = pickMember(row, 'email') || pickExact(row, 'member_email');
    const userName = pickExact(row, 'name', 'user_name', 'username');
    const userEmail = pickExact(row, 'email', 'user_email');
    const teamName = pickExact(row, 'team_name', 'team');
    const scoreTeam = pickExact(row, 'team');
    const isCaptain = truthy(pickExact(row, 'team_captain', 'captain'));

    if (memberName || memberEmail) {
      const tn = currentTeam || teamName || scoreTeam;
      if (!tn) continue;
      const email = normalizeEmail(memberEmail || userEmail);
      if (!isValidEmail(email)) continue;
      members.push({
        displayName: memberName || email.split('@')[0] || 'User',
        email,
        teamName: tn,
        isCaptain,
      });
      continue;
    }

    if (scoreTeam && (pickExact(row, 'member_name') || pickExact(row, 'member_email'))) {
      const mn = pickExact(row, 'member_name');
      const me = normalizeEmail(pickExact(row, 'member_email'));
      if (!isValidEmail(me)) continue;
      members.push({
        displayName: mn || me.split('@')[0] || 'User',
        email: me,
        teamName: scoreTeam,
        isCaptain: false,
      });
      continue;
    }

    if (userName && userEmail && teamName) {
      const email = normalizeEmail(userEmail);
      if (!isValidEmail(email)) continue;
      members.push({
        displayName: userName,
        email,
        teamName,
        isCaptain,
      });
      continue;
    }

    if (userName && !teamName && !memberName) {
      currentTeam = userName;
    }
  }

  const deduped = new Map<string, ParsedMember>();
  for (const m of members) {
    deduped.set(`${m.email}::${m.teamName}`, m);
  }
  return [...deduped.values()];
}

function memberKey(email: string, teamName: string): string {
  return `${email.toLowerCase()}::${teamName}`;
}

function baseUsername(displayName: string, email: string): string {
  let base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '')
    .slice(0, 24);
  if (base.length < 3) {
    base = email
      .split('@')[0]!
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '')
      .slice(0, 24);
  }
  if (base.length < 3) base = `user${crypto.randomBytes(3).toString('hex')}`;
  return base;
}

function planUsernameInMemory(
  displayName: string,
  email: string,
  takenUsernames: Set<string>,
  existingUser?: { username: string },
): { username: string; suffixed: boolean } {
  if (existingUser) {
    return { username: existingUser.username, suffixed: false };
  }

  let candidate = baseUsername(displayName, email);
  let n = 0;
  let suffixed = false;
  while (takenUsernames.has(candidate)) {
    n += 1;
    suffixed = true;
    candidate = `${baseUsername(displayName, email).slice(0, 20)}-${n}`;
  }
  takenUsernames.add(candidate);
  return { username: candidate, suffixed };
}

function resolveMemberStatus(
  hasUser: boolean,
  onServer: boolean,
  suffixed: boolean,
): CtfdTeamsPreviewMemberStatus {
  if (!hasUser) return suffixed ? 'create_username_suffix' : 'create';
  if (onServer) return 'update_server_member';
  return 'update_existing';
}

export async function previewCtfdTeamsCsv(csvText: string, serverId: string): Promise<CtfdTeamsPreview> {
  const parsed = parseMembersFromCsv(csvText);
  const byTeam = new Map<string, ParsedMember[]>();
  for (const m of parsed) {
    const list = byTeam.get(m.teamName) ?? [];
    list.push(m);
    byTeam.set(m.teamName, list);
  }

  const emails = [...new Set(parsed.map((m) => m.email))];
  const teamNames = [...byTeam.keys()];

  const [users, serverMembers, existingTeams, allUsernames] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, username: true },
    }),
    prisma.serverMember.findMany({
      where: { serverId, user: { email: { in: emails } } },
      select: { userId: true },
    }),
    prisma.team.findMany({
      where: { serverId, name: { in: teamNames } },
      select: { name: true },
    }),
    prisma.user.findMany({ select: { username: true } }),
  ]);

  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const onServerUserIds = new Set(serverMembers.map((m) => m.userId));
  const existingTeamNames = new Set(existingTeams.map((t) => t.name));
  const takenUsernames = new Set(allUsernames.map((u) => u.username));
  const plannedByEmail = new Map<string, { username: string; suffixed: boolean }>();

  const teams: CtfdTeamsPreviewTeam[] = [...byTeam.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, teamMembers]) => ({
      key: name,
      name,
      teamStatus: existingTeamNames.has(name) ? ('reuse' as const) : ('create' as const),
      members: teamMembers
        .sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain))
        .map((m) => {
          const user = userByEmail.get(m.email);
          let username: string;
          let suffixed: boolean;
          if (user) {
            ({ username, suffixed } = planUsernameInMemory(
              m.displayName,
              m.email,
              takenUsernames,
              user,
            ));
          } else {
            const planned = plannedByEmail.get(m.email);
            if (planned) {
              username = planned.username;
              suffixed = planned.suffixed;
            } else {
              ({ username, suffixed } = planUsernameInMemory(
                m.displayName,
                m.email,
                takenUsernames,
              ));
              plannedByEmail.set(m.email, { username, suffixed });
            }
          }
          return {
            key: memberKey(m.email, m.teamName),
            displayName: m.displayName,
            email: m.email,
            isCaptain: m.isCaptain,
            plannedUsername: username,
            status: resolveMemberStatus(!!user, user ? onServerUserIds.has(user.id) : false, suffixed),
          };
        }),
    }));

  return {
    teams,
    totalTeams: teams.length,
    totalMembers: parsed.length,
  };
}

export function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pickChar = (chars: string) => chars[crypto.randomInt(chars.length)]!;
  const chars = [pickChar(upper), pickChar(lower), pickChar(digits)];
  for (let i = 0; i < 10; i++) chars.push(pickChar(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

async function uniqueUsername(displayName: string, email: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.username;

  let candidate = baseUsername(displayName, email);
  let n = 0;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    n += 1;
    candidate = `${baseUsername(displayName, email).slice(0, 20)}-${n}`;
  }
  return candidate;
}

export async function importCtfdTeamsCsv(csvText: string, serverId: string): Promise<CtfdTeamsImportResult> {
  return importCtfdTeamMembers(parseMembersFromCsv(csvText), serverId);
}

export async function importCtfdTeamMembers(
  members: ParsedMember[],
  serverId: string,
): Promise<CtfdTeamsImportResult> {
  const parsed = members;
  const result: CtfdTeamsImportResult = {
    teamsCreated: 0,
    teamsReused: 0,
    usersCreated: 0,
    usersUpdated: 0,
    serverMembersAdded: 0,
    skipped: 0,
    credentials: [],
  };

  if (parsed.length === 0) return result;

  const joinFields = await serverMemberJoinFields(serverId);
  const byTeam = new Map<string, ParsedMember[]>();
  for (const m of parsed) {
    const list = byTeam.get(m.teamName) ?? [];
    list.push(m);
    byTeam.set(m.teamName, list);
  }

  let colorIdx = 0;

  for (const [teamName, teamMembers] of byTeam) {
    let team = await prisma.team.findFirst({ where: { serverId, name: teamName } });
    if (team) {
      result.teamsReused += 1;
    } else {
      team = await createTeamWithSlug(prisma, {
        serverId,
        name: teamName,
        color: TEAM_COLORS[colorIdx % TEAM_COLORS.length]!,
      });
      result.teamsCreated += 1;
      colorIdx += 1;
    }

    const sorted = [...teamMembers].sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain));

    for (const member of sorted) {
      try {
        const plainPassword = generatePassword();
        const passwordHash = await hashPassword(plainPassword);
        const username = await uniqueUsername(member.displayName, member.email);

        let user = await prisma.user.findUnique({ where: { email: member.email } });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, displayName: member.displayName.trim().slice(0, 40) },
          });
          result.usersUpdated += 1;
        } else {
          user = await prisma.user.create({
            data: {
              email: member.email,
              username,
              displayName: member.displayName.trim().slice(0, 40),
              passwordHash,
              role: Role.TEAM_MEMBER,
            },
          });
          result.usersCreated += 1;
        }

        const existingMember = await prisma.serverMember.findUnique({
          where: { userId_serverId: { userId: user.id, serverId } },
        });
        if (!existingMember) {
          await prisma.serverMember.create({
            data: { userId: user.id, serverId, ...joinFields },
          });
          result.serverMembersAdded += 1;
        } else if (joinFields.mustChangePassword && !existingMember.mustChangePassword) {
          await prisma.serverMember.update({
            where: { userId_serverId: { userId: user.id, serverId } },
            data: { mustChangePassword: true },
          });
        }

        await assignServerRoleToMember(user.id, serverId, member.serverRoleId);

        await assignUserToServerTeam(prisma, {
          userId: user.id,
          serverId,
          teamId: team.id,
          asCaptain: member.isCaptain,
        });

        result.credentials.push({
          teamName,
          username: user.username,
          email: user.email,
          password: plainPassword,
          role: member.isCaptain ? 'captain' : 'member',
        });
      } catch (err) {
        console.error('ctfd teams import row failed', member.email, err);
        result.skipped += 1;
      }
    }
  }

  result.credentials.sort(
    (a, b) => a.teamName.localeCompare(b.teamName) || a.username.localeCompare(b.username),
  );

  return result;
}
