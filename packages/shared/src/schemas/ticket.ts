import { z } from 'zod';
import {
  TICKET_PAGE_SIZE,
  TICKET_PAGE_SIZE_MAX,
  TicketPriority,
  TicketRelationKind,
  TicketStatus,
} from '../constants';

const priorityEnum = z.enum(
  Object.values(TicketPriority) as [string, ...string[]],
) as z.ZodEnum<['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']>;

const statusEnum = z.enum(Object.values(TicketStatus) as [string, ...string[]]) as z.ZodEnum<
  ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_COMPETITOR', 'RESOLVED', 'CLOSED', 'REOPENED']
>;

const relationKindEnum = z.enum(
  Object.values(TicketRelationKind) as [string, ...string[]],
) as z.ZodEnum<['RELATED', 'DUPLICATE', 'PARENT', 'CHILD']>;

/**
 * Ticket creation. `teamId` is deliberately absent: the server derives the team
 * from the authenticated user's membership in the target competition.
 */
export const createTicketSchema = z.object({
  title: z.string().trim().min(4, 'Title too short').max(120),
  body: z.string().trim().min(10, 'Describe the issue (min 10 chars)').max(4000),
  priority: priorityEnum.default('MEDIUM'),
  categoryId: z.string().cuid().optional().nullable(),
  challengeId: z.string().cuid().optional().nullable(),
  tagIds: z.array(z.string().cuid()).max(10).optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const ticketCommentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  internal: z.boolean().default(false),
});
export type TicketCommentInput = z.infer<typeof ticketCommentSchema>;

export const ticketStatusSchema = z.object({
  status: statusEnum,
});

export const ticketSeveritySchema = z.object({
  severity: priorityEnum,
});

export const ticketPrioritySchema = z.object({
  priority: priorityEnum,
});

/** Organizer field updates. Every key is optional; at least one must be present. */
export const patchTicketSchema = z
  .object({
    status: statusEnum.optional(),
    priority: priorityEnum.optional(),
    categoryId: z.string().cuid().nullable().optional(),
    challengeId: z.string().cuid().nullable().optional(),
    assignedToId: z.string().cuid().nullable().optional(),
    tagIds: z.array(z.string().cuid()).max(10).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'No changes supplied',
  });
export type PatchTicketInput = z.infer<typeof patchTicketSchema>;

export const reopenTicketSchema = z.object({
  body: z.string().trim().min(10, 'Explain why the ticket is reopened').max(4000),
});

const csvList = (max: number) =>
  z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, max),
    )
    .optional();

export const ticketQuerySchema = z.object({
  status: csvList(6),
  priority: csvList(4),
  categoryId: z.string().cuid().optional(),
  challengeId: z.string().cuid().optional(),
  assignedToId: z.string().optional(),
  teamId: z.string().cuid().optional(),
  tagId: z.string().cuid().optional(),
  /** `mine` = opened by me, `team` = my team, `all` = everything I may see. */
  scope: z.enum(['mine', 'team', 'all']).default('all'),
  q: z.string().trim().max(120).optional(),
  unassigned: z.coerce.boolean().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(['updated', 'created', 'priority']).default('updated'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(TICKET_PAGE_SIZE_MAX).default(TICKET_PAGE_SIZE),
});
export type TicketQueryInput = z.infer<typeof ticketQuerySchema>;

export const ticketBulkSchema = z.object({
  ticketIds: z.array(z.string().cuid()).min(1).max(100),
  action: z.object({
    status: statusEnum.optional(),
    priority: priorityEnum.optional(),
    assignedToId: z.string().cuid().nullable().optional(),
    addTagIds: z.array(z.string().cuid()).max(10).optional(),
  }),
});
export type TicketBulkInput = z.infer<typeof ticketBulkSchema>;

export const ticketRelationSchema = z.object({
  relatedTicketId: z.string().cuid(),
  kind: relationKindEnum,
});

/** Turning a ticket into a competition-wide announcement (spec §26). */
export const ticketAnnounceSchema = z.object({
  title: z.string().trim().min(4).max(140),
  body: z.string().trim().min(10).max(4000),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  expiresAt: z.string().datetime().optional().nullable(),
  /** Also post a public reply on the source ticket. */
  replyOnTicket: z.boolean().default(true),
});
export type TicketAnnounceInput = z.infer<typeof ticketAnnounceSchema>;

export const ticketCategorySchema = z.object({
  name: z.string().trim().min(2).max(64),
  key: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{2,32}$/, 'Key must be UPPER_SNAKE_CASE')
    .optional(),
  position: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
  requiresChallenge: z.boolean().optional(),
});

export const ticketTagSchema = z.object({
  name: z.string().trim().min(2).max(32),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});
