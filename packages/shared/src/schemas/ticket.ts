import { z } from 'zod';
import { TicketSeverity, TicketStatus } from '../constants';

const severityEnum = z.enum(
  Object.values(TicketSeverity) as [string, ...string[]],
) as z.ZodEnum<['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']>;

const statusEnum = z.enum(
  Object.values(TicketStatus) as [string, ...string[]],
) as z.ZodEnum<['OPEN', 'CLAIMED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']>;

export const createTicketSchema = z.object({
  title: z.string().min(4, 'Title too short').max(120),
  body: z.string().min(10, 'Describe the issue (min 10 chars)').max(4000),
  severity: severityEnum.default('MEDIUM'),
  challengeId: z.string().cuid().optional().nullable(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const ticketCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  internal: z.boolean().default(false),
});
export type TicketCommentInput = z.infer<typeof ticketCommentSchema>;

export const ticketStatusSchema = z.object({
  status: statusEnum,
});

export const ticketSeveritySchema = z.object({
  severity: severityEnum,
});
