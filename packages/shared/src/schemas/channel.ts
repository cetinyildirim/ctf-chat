import { z } from 'zod';
import { ChannelNotifyMode } from '../notifications-channel';
import { ChannelType } from '../constants';

const channelTypeEnum = z.enum(Object.values(ChannelType) as [string, ...string[]]);

export const createChannelSchema = z.object({
  name: z.string().min(2).max(48),
  topic: z.string().max(200).optional().nullable(),
  type: channelTypeEnum,
  categoryId: z.string().cuid().optional().nullable(),
  isPrivate: z.boolean().default(false),
  iconKey: z.string().max(64).optional().nullable(),
});
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

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
