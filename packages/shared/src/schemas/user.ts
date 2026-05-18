import { z } from 'zod';

export const updateMeSchema = z.object({
  locale: z.enum(['tr', 'en']).optional(),
  displayName: z.string().min(2).max(80).optional(),
  bio: z.union([z.string().max(500), z.literal('')]).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  defaultNotifyMode: z.enum(['ALL', 'MENTIONS_ONLY', 'NONE']).optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
