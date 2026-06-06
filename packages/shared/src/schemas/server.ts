import { z } from 'zod';
import { ChannelNotifyMode } from '../notifications-channel';

export const createChatServerSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, 'Slug: lowercase letters, numbers, hyphens'),
  description: z.string().max(500).optional().nullable(),
});

export const updateChatServerSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
});

export const patchServerMemberSchema = z.object({
  nickname: z.string().min(1).max(32).optional().nullable(),
});

export const createServerInviteSchema = z.object({
  channelId: z.string().cuid().optional().nullable(),
  maxUses: z.number().int().min(1).max(1000).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
});

export const banServerMemberSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
});

const notifyVals = Object.values(ChannelNotifyMode) as [string, ...string[]];

export const patchServerNotifySchema = z.object({
  notifyMode: z.enum(notifyVals),
});
