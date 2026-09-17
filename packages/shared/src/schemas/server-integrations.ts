import { z } from 'zod';
import { createAnnouncementSchema } from './announcement';

export const patchServerIntegrationsSchema = z.object({
  themePrimary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  themeAccent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  emailNotifyEnabled: z.boolean().optional(),
  emailReplyTo: z.string().email().optional().nullable(),
  ctfdBaseUrl: z.string().url().max(500).optional().nullable(),
  ctfdAccessToken: z.string().max(256).optional().nullable(),
});

export const testCtfdConnectionSchema = z.object({
  ctfdBaseUrl: z.string().url().max(500).optional(),
  ctfdAccessToken: z.string().max(256).optional().nullable(),
});

export const createServerWebhookSchema = z.object({
  label: z.string().min(2).max(64),
  url: z.string().url().max(500),
  secret: z.string().max(128).optional().nullable(),
  events: z.array(z.string().min(3).max(64)).optional(),
  enabled: z.boolean().optional(),
});

export const createServerAnnouncementSchema = createAnnouncementSchema.extend({
  channelId: z.string().cuid().optional().nullable(),
});
