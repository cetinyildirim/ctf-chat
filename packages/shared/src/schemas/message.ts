import { z } from 'zod';
import { MAX_MESSAGE_LENGTH } from '../constants';

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Cannot send an empty message')
    .max(MAX_MESSAGE_LENGTH, `Max ${MAX_MESSAGE_LENGTH} characters`),
  replyToId: z.string().cuid().optional().nullable(),
  attachmentIds: z.array(z.string()).max(10).optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const editMessageSchema = z.object({
  content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});
export type EditMessageInput = z.infer<typeof editMessageSchema>;

export const reactMessageSchema = z.object({
  emoji: z.string().min(1).max(16),
});
export type ReactMessageInput = z.infer<typeof reactMessageSchema>;

export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  direction: z.enum(['backward', 'forward']).default('backward'),
});
