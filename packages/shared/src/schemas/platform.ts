import { z } from 'zod';

export const patchUploadMaxSchema = z.object({
  uploadMaxMb: z.number().int().min(1).max(500),
});

export const patchPlatformBrandingSchema = z.object({
  platformTitle: z.string().min(1).max(80).optional(),
  platformTagline: z.string().min(1).max(160).optional(),
  workspaceLabel: z.string().min(1).max(40).optional(),
  workspaceTitle: z.string().min(1).max(80).optional(),
});

export const createTeamByUserSchema = z.object({
  serverId: z.string().cuid(),
  name: z.string().min(2).max(48),
  tagline: z.string().max(120).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const leaveServerTeamSchema = z.object({
  serverId: z.string().cuid(),
});

export type PlatformBranding = {
  platformTitle: string;
  platformTagline: string;
  workspaceLabel: string;
  workspaceTitle: string;
  uploadMaxMb: number;
};
