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

export const patchRegistrationSettingsSchema = z.object({
  /** Null clears the override and falls back to the platform default server. */
  defaultRegistrationServerId: z.string().cuid().nullable(),
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

export const joinTeamByInviteSchema = z.object({
  inviteCode: z.string().trim().min(4).max(64),
  /** Optional disambiguation when the same code exists on multiple servers. */
  serverId: z.string().cuid().optional(),
});

export type PlatformBranding = {
  platformTitle: string;
  platformTagline: string;
  workspaceLabel: string;
  workspaceTitle: string;
  uploadMaxMb: number;
};

export type RegistrationSettings = {
  defaultRegistrationServerId: string | null;
  /** Resolved server that will actually be used (configured or fallback). */
  effectiveServerId: string | null;
  effectiveServerName: string | null;
};
