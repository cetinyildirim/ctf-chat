export const room = {
  channel: (id: string) => `ch:${id}`,
  team: (id: string) => `team:${id}`,
  user: (id: string) => `user:${id}`,
  staff: () => 'staff',
  global: () => 'global',
};
