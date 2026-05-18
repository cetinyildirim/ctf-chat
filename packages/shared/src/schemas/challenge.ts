import { z } from 'zod';
import { ChallengeCategory, ChallengeDifficulty } from '../constants';

const categoryEnum = z.enum(Object.values(ChallengeCategory) as [string, ...string[]]);
const difficultyEnum = z.enum(Object.values(ChallengeDifficulty) as [string, ...string[]]);

export const listChallengesQuerySchema = z.object({
  category: categoryEnum.optional(),
  difficulty: difficultyEnum.optional(),
  q: z.string().max(80).optional(),
  solved: z.enum(['true', 'false']).optional(),
});

export const requestHintSchema = z.object({
  hintId: z.string().cuid(),
});
