import { z } from 'zod';

export const ctfdChallengeImportItemSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string(),
  value: z.string(),
  state: z.string(),
  ctfdId: z.string().optional(),
});

export const applyCtfdChallengesSchema = z.object({
  serverId: z.string().cuid(),
  channels: z.array(ctfdChallengeImportItemSchema).min(1),
});

export const ctfdTeamImportMemberSchema = z.object({
  key: z.string().min(1),
  teamName: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  isCaptain: z.boolean(),
  serverRoleId: z.string().cuid().optional(),
});

export const applyCtfdTeamsSchema = z.object({
  serverId: z.string().cuid(),
  members: z.array(ctfdTeamImportMemberSchema).min(1),
});

export type CtfdChallengeImportItem = z.infer<typeof ctfdChallengeImportItemSchema>;
export type ApplyCtfdChallengesInput = z.infer<typeof applyCtfdChallengesSchema>;
export type CtfdTeamImportMember = z.infer<typeof ctfdTeamImportMemberSchema>;
export type ApplyCtfdTeamsInput = z.infer<typeof applyCtfdTeamsSchema>;
