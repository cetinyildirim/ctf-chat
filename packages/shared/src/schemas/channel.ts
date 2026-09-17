import { z } from 'zod';
import { ChannelNotifyMode } from '../notifications-channel';
import { ChannelType } from '../constants';

const channelTypeEnum = z.enum(Object.values(ChannelType) as [string, ...string[]]);

export const createChannelSchema = z.object({
  name: z.string().min(2).max(48),
  topic: z.string().max(200).optional().nullable(),
  type: channelTypeEnum,
  categoryId: z.string().cuid().optional().nullable(),
  serverId: z.string().cuid().optional(),
  isPrivate: z.boolean().default(false),
  iconKey: z.string().max(64).optional().nullable(),
});
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

/** Team members create a private channel under their team category. */
export const createTeamChannelSchema = z.object({
  categoryId: z.string().cuid(),
  name: z.string().trim().min(2).max(48),
  topic: z.string().max(200).optional(),
});
export type CreateTeamChannelInput = z.infer<typeof createTeamChannelSchema>;

export const updateChannelSchema = z.object({
  name: z.string().min(2).max(48).optional(),
  topic: z.string().max(200).optional().nullable(),
  type: channelTypeEnum.optional(),
  isLocked: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  categoryId: z.string().cuid().optional().nullable(),
});

const notifyVals = Object.values(ChannelNotifyMode) as [string, ...string[]];

export const patchChannelNotifySchema = z.object({
  notifyMode: z.enum(notifyVals),
});
