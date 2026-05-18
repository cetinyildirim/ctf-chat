import { z } from 'zod';
import { IncidentSeverity } from '../constants';

const severityEnum = z.enum(Object.values(IncidentSeverity) as [string, ...string[]]);

export const createAnnouncementSchema = z.object({
  title: z.string().min(4).max(140),
  body: z.string().min(10).max(4000),
  severity: severityEnum.default('INFO'),
  scheduledFor: z.string().datetime().optional().nullable(),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
