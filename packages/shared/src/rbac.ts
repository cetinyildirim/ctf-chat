/**
 * Role-Based Access Control matrix for the SYDT CTF platform.
 *
 * Roles are ordered from least to most privileged. Permissions are flat,
 * granular capability flags that map cleanly to UI gates AND server guards.
 *
 * The `rolePermissions` map is the single source of truth, used identically
 * on the server (`requirePermission` middleware) and the client
 * (`<Can permission="..." />` component + `useCan` hook).
 */

export const Role = {
  OBSERVER: 'OBSERVER',
  SPECTATOR: 'SPECTATOR',
  TEAM_MEMBER: 'TEAM_MEMBER',
  TEAM_CAPTAIN: 'TEAM_CAPTAIN',
  MODERATOR: 'MODERATOR',
  CHALLENGE_AUTHOR: 'CHALLENGE_AUTHOR',
  COMP_ADMIN: 'COMP_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES = Object.values(Role) as Role[];

export const Permission = {
  // Channels
  CHANNEL_VIEW_PUBLIC: 'CHANNEL_VIEW_PUBLIC',
  CHANNEL_VIEW_STAFF: 'CHANNEL_VIEW_STAFF',
  CHANNEL_CREATE: 'CHANNEL_CREATE',
  CHANNEL_DELETE: 'CHANNEL_DELETE',
  CHANNEL_LOCK: 'CHANNEL_LOCK',
  CHANNEL_REORDER: 'CHANNEL_REORDER',
  CATEGORY_MANAGE: 'CATEGORY_MANAGE',

  // Messages
  MESSAGE_SEND: 'MESSAGE_SEND',
  MESSAGE_EDIT_OWN: 'MESSAGE_EDIT_OWN',
  MESSAGE_DELETE_OWN: 'MESSAGE_DELETE_OWN',
  MESSAGE_DELETE_ANY: 'MESSAGE_DELETE_ANY',
  MESSAGE_PIN: 'MESSAGE_PIN',
  MESSAGE_REACT: 'MESSAGE_REACT',

  // Announcements
  ANNOUNCEMENT_CREATE: 'ANNOUNCEMENT_CREATE',
  ANNOUNCEMENT_SCHEDULE: 'ANNOUNCEMENT_SCHEDULE',

  // Incidents
  INCIDENT_VIEW: 'INCIDENT_VIEW',
  INCIDENT_CREATE: 'INCIDENT_CREATE',
  INCIDENT_MANAGE: 'INCIDENT_MANAGE',

  // Tickets
  TICKET_CREATE: 'TICKET_CREATE',
  TICKET_VIEW_OWN: 'TICKET_VIEW_OWN',
  /** Captain-level: every ticket of the own team, including teammates'. */
  TICKET_VIEW_TEAM: 'TICKET_VIEW_TEAM',
  TICKET_VIEW_ALL: 'TICKET_VIEW_ALL',
  TICKET_CLAIM: 'TICKET_CLAIM',
  TICKET_ASSIGN: 'TICKET_ASSIGN',
  TICKET_RESOLVE: 'TICKET_RESOLVE',
  TICKET_INTERNAL_NOTE: 'TICKET_INTERNAL_NOTE',
  TICKET_BULK: 'TICKET_BULK',
  /** Manage categories, tags and competition ticket settings. */
  TICKET_MANAGE_META: 'TICKET_MANAGE_META',
  TICKET_ANNOUNCE: 'TICKET_ANNOUNCE',

  // Users / Moderation
  USER_MUTE: 'USER_MUTE',
  USER_BAN: 'USER_BAN',
  USER_VIEW_ALL: 'USER_VIEW_ALL',

  // Teams
  TEAM_MANAGE: 'TEAM_MANAGE',
  TEAM_MANAGE_OWN: 'TEAM_MANAGE_OWN',

  // Challenges
  CHALLENGE_VIEW: 'CHALLENGE_VIEW',
  CHALLENGE_AUTHOR: 'CHALLENGE_AUTHOR',
  CHALLENGE_REQUEST_HINT: 'CHALLENGE_REQUEST_HINT',

  // Admin / Stats
  ADMIN_DASHBOARD: 'ADMIN_DASHBOARD',
  STATS_VIEW: 'STATS_VIEW',
  AUDIT_LOG_VIEW: 'AUDIT_LOG_VIEW',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const set = (...p: Permission[]): Set<Permission> => new Set(p);

/**
 * Permission inheritance is encoded explicitly (no implicit hierarchy):
 * - SUPER_ADMIN gets everything
 * - Higher roles compose lower-role permissions via spreads
 */
const observer: Permission[] = [
  Permission.CHANNEL_VIEW_PUBLIC,
  Permission.CHALLENGE_VIEW,
];

const spectator: Permission[] = [
  ...observer,
  Permission.MESSAGE_REACT,
  // Open registration lands as SPECTATOR; they still need to open and track
  // their own support tickets for infra / score problems.
  Permission.TICKET_CREATE,
  Permission.TICKET_VIEW_OWN,
  // Self-registered users must be able to chat and DM; per-channel posting is
  // still governed by server roles (`sendMessage`), channel locks and mutes.
  Permission.MESSAGE_SEND,
  Permission.MESSAGE_EDIT_OWN,
  Permission.MESSAGE_DELETE_OWN,
];

const teamMember: Permission[] = [
  ...spectator,
  // Competitors see their own team's tickets; the team is always resolved from
  // the competition membership, never from the request.
  Permission.TICKET_VIEW_TEAM,
  Permission.CHALLENGE_REQUEST_HINT,
];

const teamCaptain: Permission[] = [
  ...teamMember,
  Permission.TEAM_MANAGE_OWN,
];

const moderator: Permission[] = [
  ...teamCaptain,
  Permission.CHANNEL_VIEW_STAFF,
  Permission.MESSAGE_DELETE_ANY,
  Permission.MESSAGE_PIN,
  Permission.USER_MUTE,
  Permission.USER_VIEW_ALL,
  Permission.TICKET_VIEW_ALL,
  Permission.TICKET_CLAIM,
  Permission.TICKET_ASSIGN,
  Permission.TICKET_RESOLVE,
  Permission.TICKET_INTERNAL_NOTE,
  Permission.TICKET_BULK,
  Permission.INCIDENT_VIEW,
  Permission.STATS_VIEW,
];

const challengeAuthor: Permission[] = [
  ...moderator,
  Permission.CHALLENGE_AUTHOR,
];

const compAdmin: Permission[] = [
  ...challengeAuthor,
  Permission.CATEGORY_MANAGE,
  Permission.CHANNEL_CREATE,
  Permission.CHANNEL_DELETE,
  Permission.CHANNEL_LOCK,
  Permission.CHANNEL_REORDER,
  Permission.ANNOUNCEMENT_CREATE,
  Permission.ANNOUNCEMENT_SCHEDULE,
  Permission.TICKET_MANAGE_META,
  Permission.TICKET_ANNOUNCE,
  Permission.INCIDENT_CREATE,
  Permission.INCIDENT_MANAGE,
  Permission.USER_BAN,
  Permission.TEAM_MANAGE,
  Permission.ADMIN_DASHBOARD,
  Permission.AUDIT_LOG_VIEW,
];

const superAdmin: Permission[] = Object.values(Permission);

export const rolePermissions: Record<Role, Set<Permission>> = {
  OBSERVER: set(...observer),
  SPECTATOR: set(...spectator),
  TEAM_MEMBER: set(...teamMember),
  TEAM_CAPTAIN: set(...teamCaptain),
  MODERATOR: set(...moderator),
  CHALLENGE_AUTHOR: set(...challengeAuthor),
  COMP_ADMIN: set(...compAdmin),
  SUPER_ADMIN: set(...superAdmin),
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return rolePermissions[role]?.has(permission) ?? false;
}

export function canAny(role: Role | null | undefined, ...permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export function canAll(role: Role | null | undefined, ...permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

export function permissionsFor(role: Role): Permission[] {
  return Array.from(rolePermissions[role] ?? new Set<Permission>());
}

export const ROLE_LABELS: Record<Role, string> = {
  OBSERVER: 'Observer',
  SPECTATOR: 'Spectator',
  TEAM_MEMBER: 'Operator',
  TEAM_CAPTAIN: 'Team Captain',
  MODERATOR: 'Moderator',
  CHALLENGE_AUTHOR: 'Challenge Author',
  COMP_ADMIN: 'Competition Admin',
  SUPER_ADMIN: 'Super Admin',
};

export const ROLE_RANK: Record<Role, number> = {
  OBSERVER: 0,
  SPECTATOR: 1,
  TEAM_MEMBER: 2,
  TEAM_CAPTAIN: 3,
  MODERATOR: 4,
  CHALLENGE_AUTHOR: 5,
  COMP_ADMIN: 6,
  SUPER_ADMIN: 7,
};

export function isStaff(role: Role | null | undefined): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK.MODERATOR;
}

export function isAdmin(role: Role | null | undefined): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK.COMP_ADMIN;
}

/** Role used for permission checks; staff platform role is never downgraded by team membership */
export function effectivePermissionRole(user: {
  role: Role;
  platformRole?: Role | null;
}): Role {
  if (user.platformRole && isStaff(user.platformRole)) return user.platformRole;
  if (isStaff(user.role)) return user.role;
  return user.role;
}
