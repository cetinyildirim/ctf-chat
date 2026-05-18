import { z } from 'zod';

export const createUserReportSchema = z.object({
  reportedUserId: z.string().cuid(),
  reason: z.string().min(3).max(80),
  details: z.string().min(10).max(2000),
  contextType: z.enum(['CHANNEL', 'MESSAGE', 'PROFILE', 'OTHER']).optional(),
  contextId: z.string().max(64).optional(),
});

export const patchUserReportSchema = z.object({
  status: z.enum(['OPEN', 'REVIEWED', 'DISMISSED']),
});
