import { z } from 'zod';
import { IncidentSeverity, IncidentStatus } from '../constants';

const severityEnum = z.enum(
  Object.values(IncidentSeverity) as [string, ...string[]],
) as z.ZodEnum<['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']>;

const statusEnum = z.enum(
  Object.values(IncidentStatus) as [string, ...string[]],
) as z.ZodEnum<['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'POSTMORTEM']>;

export const createIncidentSchema = z.object({
  title: z.string().min(4).max(140),
  description: z.string().min(10).max(4000),
  severity: severityEnum.default('MEDIUM'),
  assignedToId: z.string().cuid().optional().nullable(),
  serverId: z.string().cuid().optional().nullable(),
  channelId: z.string().cuid().optional().nullable(),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export const updateIncidentSchema = z.object({
  title: z.string().min(4).max(140).optional(),
  description: z.string().min(10).max(4000).optional(),
  severity: severityEnum.optional(),
  status: statusEnum.optional(),
  assignedToId: z.string().cuid().optional().nullable(),
  channelId: z.string().cuid().optional().nullable(),
});
