import { z } from 'zod';

export const adminCreateTeamSchema = z.object({
  name: z.string().min(2).max(80),
  tagline: z.union([z.string().max(240), z.literal('')]).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const adminPatchTeamSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  tagline: z.union([z.string().max(240), z.literal(''), z.null()]).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const adminAssignMemberSchema = z.object({
  /** User id (cuid) or @username (without @). */
  userId: z.string().min(1).max(128).optional(),
  username: z.string().min(1).max(32).optional(),
}).refine((d) => !!(d.userId?.trim() || d.username?.trim()), {
  message: 'userId or username required',
});

export const adminSetCaptainSchema = z.object({
  userId: z.string().cuid().nullable(),
});
