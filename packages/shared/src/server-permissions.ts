/** Per-server role permission keys (Discord-style server settings). */
export const SERVER_PERM_KEYS = [
  'manageChannels',
  'manageServer',
  'managePermissions',
  'manageRoles',
  'manageCustomization',
  'kickMembers',
  'banMembers',
  'timeoutMembers',
  'assignRoles',
  'changeNickname',
  'manageNicknames',
  'changeAvatar',
  'removeProfilePicture',
  'viewChannel',
  'sendMessage',
  'manageMessages',
  'inviteOthers',
  'sendEmbeds',
  'uploadFiles',
  'changeAppearance',
  'useReactions',
  'connect',
] as const;

export type ServerPermKey = (typeof SERVER_PERM_KEYS)[number];

export type ServerPermissionsMap = Partial<Record<ServerPermKey, boolean>>;

export const SERVER_ROLE_DEFAULT_PERMISSIONS: ServerPermissionsMap = {
  changeNickname: true,
  changeAvatar: true,
  viewChannel: true,
  sendMessage: true,
  inviteOthers: true,
  sendEmbeds: true,
  uploadFiles: true,
  useReactions: true,
  connect: true,
};

export function parseServerPermissions(json: string | null | undefined): ServerPermissionsMap {
  if (!json) return {};
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const out: ServerPermissionsMap = {};
    for (const key of SERVER_PERM_KEYS) {
      if (typeof raw[key] === 'boolean') out[key] = raw[key];
    }
    return out;
  } catch {
    return {};
  }
}

/** Permission groups for server role editor UI. */
export const SERVER_PERM_CATEGORIES: ReadonlyArray<{
  id: 'server' | 'members' | 'channels' | 'messages' | 'roles' | 'profile';
  keys: readonly ServerPermKey[];
}> = [
  {
    id: 'server',
    keys: ['manageServer', 'manageCustomization', 'viewChannel', 'connect'],
  },
  {
    id: 'members',
    keys: ['kickMembers', 'banMembers', 'timeoutMembers', 'inviteOthers', 'assignRoles'],
  },
  {
    id: 'channels',
    keys: ['manageChannels'],
  },
  {
    id: 'messages',
    keys: ['sendMessage', 'manageMessages', 'sendEmbeds', 'uploadFiles', 'useReactions'],
  },
  {
    id: 'roles',
    keys: ['manageRoles', 'managePermissions'],
  },
  {
    id: 'profile',
    keys: [
      'changeNickname',
      'manageNicknames',
      'changeAvatar',
      'removeProfilePicture',
      'changeAppearance',
    ],
  },
];

export function mergeServerPermissions(maps: ServerPermissionsMap[]): ServerPermissionsMap {
  const out: ServerPermissionsMap = {};
  for (const key of SERVER_PERM_KEYS) {
    if (maps.some((m) => m[key] === true)) out[key] = true;
  }
  return out;
}
