import { z } from 'zod';
import { CompetitionStatus, TicketPolicy } from '../constants';

const statusEnum = z.enum(
  Object.values(CompetitionStatus) as [string, ...string[]],
) as z.ZodEnum<['UPCOMING', 'LIVE', 'PAUSED', 'FINISHED']>;

const policyEnum = z.enum(Object.values(TicketPolicy) as [string, ...string[]]) as z.ZodEnum<
  ['OPEN', 'ORGANIZER_ONLY', 'CLOSED']
>;

export const patchCompetitionSchema = z
  .object({
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    timezone: z.string().trim().min(2).max(64).optional(),
    status: statusEnum.optional(),
    ticketPolicy: policyEnum.optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'No changes supplied',
  })
  .refine(
    (v) => !(v.startsAt && v.endsAt) || new Date(v.startsAt) < new Date(v.endsAt),
    { message: 'startsAt must be before endsAt', path: ['endsAt'] },
  );
export type PatchCompetitionInput = z.infer<typeof patchCompetitionSchema>;
