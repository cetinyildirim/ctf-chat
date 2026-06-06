import { z } from 'zod';
import { SERVER_PERM_KEYS } from '../server-permissions';

const permsSchema = z
  .record(z.enum(SERVER_PERM_KEYS as unknown as [string, ...string[]]), z.boolean())
  .optional();

export const createServerRoleSchema = z.object({
  name: z.string().min(1).max(64),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  position: z.number().int().min(0).max(999).optional(),
  hoist: z.boolean().optional(),
  permissions: permsSchema,
});

export const updateServerRoleSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  position: z.number().int().min(0).max(999).optional(),
  hoist: z.boolean().optional(),
  permissions: permsSchema,
});

export const setMemberRolesSchema = z.object({
  roleIds: z.array(z.string().cuid()).max(1),
});
