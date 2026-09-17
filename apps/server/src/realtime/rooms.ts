export const room = {
  channel: (id: string) => `ch:${id}`,
  /** @deprecated Unscoped — do not join or emit ticket/message traffic here. */
  team: (id: string) => `team:${id}`,
  server: (id: string) => `srv:${id}`,
  user: (id: string) => `user:${id}`,
  /** Platform-wide staff (incidents). Prefer serverStaff for competition traffic. */
  staff: () => 'staff',
  global: () => 'global',
  /**
   * Competition-scoped rooms. The unscoped `team:` room is shared by every
   * competition a team id appears in, so ticket traffic must never use it.
   */
  serverTeam: (serverId: string, teamId: string) => `srv:${serverId}:team:${teamId}`,
  serverStaff: (serverId: string) => `srv:${serverId}:staff`,
};
