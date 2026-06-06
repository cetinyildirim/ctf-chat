import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name required').max(80),
  position: z.number().int().min(0).optional(),
  staffOnly: z.boolean().optional(),
  serverId: z.string().cuid(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  position: z.number().int().min(0).optional(),
  staffOnly: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
