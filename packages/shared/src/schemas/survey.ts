import { z } from 'zod';

export const SurveyQuestionType = {
  SINGLE: 'SINGLE',
  MULTI: 'MULTI',
  TEXT: 'TEXT',
} as const;

const surveyOptionInput = z.object({
  text: z.string().min(1).max(500),
});

const surveyQuestionInput = z.object({
  text: z.string().min(1).max(2000),
  type: z.enum(['SINGLE', 'MULTI', 'TEXT']).default('SINGLE'),
  required: z.boolean().default(true),
  options: z.array(surveyOptionInput).max(20).optional(),
});

export const createSurveySchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(4000).optional(),
  requireBeforeContinue: z.boolean().default(false),
  isActive: z.boolean().default(true),
  questions: z.array(surveyQuestionInput).min(1).max(30),
});

export const patchSurveySchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  requireBeforeContinue: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const surveyAnswerInput = z.object({
  questionId: z.string().cuid(),
  optionIds: z.array(z.string().cuid()).max(20).optional(),
  textValue: z.string().max(8000).optional(),
});

export const submitSurveyResponseSchema = z.object({
  answers: z.array(surveyAnswerInput).min(1).max(50),
});
