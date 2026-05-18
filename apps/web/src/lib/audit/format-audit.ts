import type { AuditLogEntry } from '@sydt/shared';
import type { Dict } from '@/i18n/dict';

function metaStr(meta: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const v = meta?.[key];
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function actorLabel(entry: AuditLogEntry): string {
  if (entry.actor) return `${entry.actor.displayName} (@${entry.actor.username})`;
  return '—';
}

function formatMetaBlock(entry: AuditLogEntry, t: Dict): string {
  const m = entry.meta;
  if (!m) return '';
  const parts: string[] = [];
  const add = (label: string, key: string) => {
    const v = metaStr(m, key);
    if (v !== undefined && v !== '') parts.push(`${label}: ${v}`);
  };
  add(t.auditFieldName, 'name');
  add(t.auditFieldUsername, 'username');
  add(t.auditFieldDisplayName, 'displayName');
  add(t.auditFieldTeam, 'teamName');
  add(t.auditFieldTitle, 'title');
  add(t.auditFieldChannel, 'channelName');
  add(t.auditFieldMode, 'mode');
  add(t.auditFieldSeverity, 'severity');
  add(t.auditFieldRecipientCount, 'recipientCount');
  add(t.auditFieldMuteMinutes, 'muteMinutes');
  add(t.auditFieldMutedUntil, 'mutedUntil');
  add(t.auditFieldMutedSince, 'mutedSince');
  add(t.auditFieldBanned, 'isBanned');
  add(t.auditFieldUploadMb, 'uploadMaxMb');
  add(t.auditFieldUserId, 'userId');
  add(t.auditFieldCaptainId, 'captainId');
  add(t.auditFieldAnnouncementId, 'announcementId');
  add(t.auditFieldCode, 'code');
  add(t.auditFieldSummary, 'summary');
  add(t.auditFieldFields, 'fields');
  if (m.byUser === true) parts.push(t.auditFieldByUser);
  if (m.byCaptain === true) parts.push(t.auditFieldByCaptain);
  const skip = new Set([
    'name',
    'username',
    'displayName',
    'teamName',
    'title',
    'channelName',
    'mode',
    'severity',
    'recipientCount',
    'muteMinutes',
    'mutedUntil',
    'mutedSince',
    'isBanned',
    'uploadMaxMb',
    'userId',
    'captainId',
    'announcementId',
    'code',
    'summary',
    'fields',
    'byUser',
    'byCaptain',
  ]);
  for (const [k, v] of Object.entries(m)) {
    if (skip.has(k) || v === null || v === undefined || v === '') continue;
    parts.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
  }
  if (!parts.length) return '';
  return `\n${t.auditMetaPrefix}: ${parts.join(' · ')}`;
}

type Template = (entry: AuditLogEntry, t: Dict) => string;

const templates: Record<string, Template> = {
  'user.login': (e, t) => t.auditUserLogin.replace('{{actor}}', actorLabel(e)),
  'user.logout': (e, t) => t.auditUserLogout.replace('{{actor}}', actorLabel(e)),
  'user.register': (e, t) => t.auditUserRegister.replace('{{actor}}', actorLabel(e)),
  'user.profile': (e, t) =>
    t.auditUserProfile
      .replace('{{actor}}', actorLabel(e))
      .replace('{{detail}}', metaStr(e.meta, 'summary') ?? metaStr(e.meta, 'fields') ?? '—'),
  'user.avatar': (e, t) => t.auditUserAvatar.replace('{{actor}}', actorLabel(e)),
  'user.avatar.clear': (e, t) => t.auditUserAvatarClear.replace('{{actor}}', actorLabel(e)),
  'user.moderation': (e, t) =>
    t.auditUserModeration
      .replace('{{actor}}', actorLabel(e))
      .replace('{{user}}', metaStr(e.meta, 'username') ?? metaStr(e.meta, 'displayName') ?? e.target ?? '?'),
  'user.report': (e, t) =>
    t.auditUserReport
      .replace('{{actor}}', actorLabel(e))
      .replace('{{user}}', metaStr(e.meta, 'username') ?? '?')
      .replace('{{reason}}', metaStr(e.meta, 'reason') ?? '?'),
  'channel.create': (e, t) =>
    t.auditChannelCreate
      .replace('{{actor}}', actorLabel(e))
      .replace('{{name}}', metaStr(e.meta, 'name') ?? e.target ?? '?'),
  'channel.update': (e, t) =>
    t.auditChannelUpdate
      .replace('{{actor}}', actorLabel(e))
      .replace('{{name}}', metaStr(e.meta, 'name') ?? e.target ?? '?'),
  'channel.delete': (e, t) =>
    t.auditChannelDelete
      .replace('{{actor}}', actorLabel(e))
      .replace('{{name}}', metaStr(e.meta, 'name') ?? '?'),
  'channel.notify': (e, t) =>
    t.auditChannelNotify
      .replace('{{actor}}', actorLabel(e))
      .replace('{{mode}}', metaStr(e.meta, 'mode') ?? '?')
      .replace('{{channel}}', metaStr(e.meta, 'channelName') ?? e.target ?? '?'),
  'category.create': (e, t) =>
    t.auditCategoryCreate.replace('{{actor}}', actorLabel(e)).replace('{{name}}', metaStr(e.meta, 'name') ?? '?'),
  'category.update': (e, t) =>
    t.auditCategoryUpdate.replace('{{actor}}', actorLabel(e)).replace('{{name}}', metaStr(e.meta, 'name') ?? '?'),
  'category.delete': (e, t) =>
    t.auditCategoryDelete.replace('{{actor}}', actorLabel(e)).replace('{{name}}', metaStr(e.meta, 'name') ?? '?'),
  'team.create': (e, t) =>
    t.auditTeamCreate.replace('{{actor}}', actorLabel(e)).replace('{{name}}', metaStr(e.meta, 'name') ?? '?'),
  'team.update': (e, t) =>
    t.auditTeamUpdate
      .replace('{{actor}}', actorLabel(e))
      .replace('{{name}}', metaStr(e.meta, 'name') ?? '?'),
  'team.delete': (e, t) => t.auditTeamDelete.replace('{{actor}}', actorLabel(e)),
  'team.member_add': (e, t) =>
    t.auditTeamMemberAdd
      .replace('{{actor}}', actorLabel(e))
      .replace('{{user}}', metaStr(e.meta, 'username') ?? metaStr(e.meta, 'userId') ?? '?'),
  'team.member_remove': (e, t) =>
    t.auditTeamMemberRemove
      .replace('{{actor}}', actorLabel(e))
      .replace('{{user}}', metaStr(e.meta, 'username') ?? metaStr(e.meta, 'userId') ?? '?'),
  'team.captain': (e, t) =>
    t.auditTeamCaptain.replace('{{actor}}', actorLabel(e)).replace('{{name}}', metaStr(e.meta, 'name') ?? '?'),
  'team.logo': (e, t) =>
    t.auditTeamLogo.replace('{{actor}}', actorLabel(e)).replace('{{name}}', metaStr(e.meta, 'name') ?? '?'),
  'team.logo.clear': (e, t) =>
    t.auditTeamLogoClear.replace('{{actor}}', actorLabel(e)).replace('{{name}}', metaStr(e.meta, 'name') ?? '?'),
  'team.invite_regen': (e, t) => t.auditTeamInviteRegen.replace('{{actor}}', actorLabel(e)),
  'friend.request': (e, t) =>
    t.auditFriendRequest
      .replace('{{actor}}', actorLabel(e))
      .replace('{{target}}', metaStr(e.meta, 'username') ?? '?'),
  'friend.accept': (e, t) =>
    t.auditFriendAccept.replace('{{actor}}', actorLabel(e)).replace('{{target}}', metaStr(e.meta, 'username') ?? '?'),
  'friend.remove': (e, t) => t.auditFriendRemove.replace('{{actor}}', actorLabel(e)),
  'message.delete': (e, t) => t.auditMessageDelete.replace('{{actor}}', actorLabel(e)),
  'message.pin': (e, t) => t.auditMessagePin.replace('{{actor}}', actorLabel(e)),
  'ticket.create': (e, t) =>
    t.auditTicketCreate.replace('{{actor}}', actorLabel(e)).replace('{{code}}', metaStr(e.meta, 'code') ?? '?'),
  'admin.import.ctfd': (e, t) => t.auditImportCtfd.replace('{{actor}}', actorLabel(e)),
  'admin.settings.upload': (e, t) =>
    t.auditSettingsUpload
      .replace('{{actor}}', actorLabel(e))
      .replace('{{mb}}', metaStr(e.meta, 'uploadMaxMb') ?? '?'),
  'admin.settings.branding': (e, t) => t.auditSettingsBranding.replace('{{actor}}', actorLabel(e)),
  'admin.broadcast.mass_dm': (e, t) =>
    t.auditBroadcastMassDm
      .replace('{{actor}}', actorLabel(e))
      .replace('{{title}}', metaStr(e.meta, 'title') ?? '?')
      .replace('{{count}}', metaStr(e.meta, 'recipientCount') ?? '?'),
  'admin.broadcast.announcement': (e, t) =>
    t.auditBroadcastAnnouncement
      .replace('{{actor}}', actorLabel(e))
      .replace('{{title}}', metaStr(e.meta, 'title') ?? '?')
      .replace('{{count}}', metaStr(e.meta, 'recipientCount') ?? '?'),
  'announcement.create': (e, t) =>
    t.auditAnnouncementCreate.replace('{{actor}}', actorLabel(e)).replace('{{title}}', metaStr(e.meta, 'title') ?? '?'),
  'survey.create': (e, t) =>
    t.auditSurveyCreate.replace('{{actor}}', actorLabel(e)).replace('{{title}}', metaStr(e.meta, 'title') ?? '?'),
  'survey.respond': (e, t) =>
    t.auditSurveyRespond.replace('{{actor}}', actorLabel(e)).replace('{{title}}', metaStr(e.meta, 'title') ?? '?'),
};

export function formatAuditEntry(entry: AuditLogEntry, t: Dict): string {
  const fn = templates[entry.action];
  const base = fn
    ? fn(entry, t)
    : t.auditGeneric
        .replace('{{actor}}', actorLabel(entry))
        .replace('{{action}}', entry.action)
        .replace('{{target}}', entry.target ?? '—');
  return base + formatMetaBlock(entry, t);
}

/** Human-readable label for the target column (entity id + context from meta). */
export function formatAuditTarget(entry: AuditLogEntry, t: Dict): { label: string; detail: string | null } {
  const id = entry.target?.trim();
  if (!id) return { label: '—', detail: null };

  const name =
    metaStr(entry.meta, 'name') ??
    metaStr(entry.meta, 'channelName') ??
    metaStr(entry.meta, 'username') ??
    metaStr(entry.meta, 'displayName') ??
    metaStr(entry.meta, 'title');

  const prefix = entry.action.split('.')[0] ?? '';
  const kindMap: Record<string, string> = {
    user: t.auditTargetKindUser,
    channel: t.auditTargetKindChannel,
    team: t.auditTargetKindTeam,
    category: t.auditTargetKindCategory,
    ticket: t.auditTargetKindTicket,
    survey: t.auditTargetKindSurvey,
    message: t.auditTargetKindMessage,
    admin: t.auditTargetKindAdmin,
    announcement: t.auditTargetKindAnnouncement,
  };
  const kind = kindMap[prefix] ?? t.auditTargetKindRecord;

  if (name) {
    return { label: `${kind}: ${name}`, detail: id };
  }
  return { label: `${kind}`, detail: id };
}
