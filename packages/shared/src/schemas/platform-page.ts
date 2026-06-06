import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createPlatformPageSchema = z.object({
  title: z.string().min(1).max(120),
  slug: z.string().max(80).optional(),
  content: z.string().max(100_000).optional(),
  published: z.boolean().optional(),
});

export const updatePlatformPageSchema = createPlatformPageSchema.partial();

export type CreatePlatformPageInput = z.infer<typeof createPlatformPageSchema>;
export type UpdatePlatformPageInput = z.infer<typeof updatePlatformPageSchema>;
